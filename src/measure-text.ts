/**
 * measure-text.ts — Low-level text and font measurement primitives
 * No document-element knowledge. Used by all measurement modules.
 */

import { PretextPdfError } from './errors.js'

/** Heading level size multipliers and defaults */
const HEADING_DEFAULTS = {
  1: { sizeMultiplier: 2.0,  fontWeight: 700 as const, spaceAfter: 16, spaceBefore: 28 },
  2: { sizeMultiplier: 1.5,  fontWeight: 700 as const, spaceAfter: 12, spaceBefore: 24 },
  3: { sizeMultiplier: 1.25, fontWeight: 700 as const, spaceAfter: 8,  spaceBefore: 20 },
  4: { sizeMultiplier: 1.1,  fontWeight: 700 as const, spaceAfter: 6,  spaceBefore: 16 },
}

export type HyphenatorOpts = { instance: HypherInstance; minWordLength: number; leftMin: number; rightMin: number }

type HypherInstance = { hyphenate(word: string): string[] }

/** Lazily-loaded Pretext module — must be imported AFTER polyfill is installed */
let _pretext: typeof import('@chenglou/pretext') | null = null

export async function getPretext() {
  if (!_pretext) {
    _pretext = await import('@chenglou/pretext')
  }
  return _pretext
}

// ─── Hyphenation (Liang's algorithm via hypher package) ──────────────────────

export async function getHyphenator(language: string): Promise<HypherInstance> {
  let dict: object
  try {
    const mod = await import(`hyphenation.${language}`)
    dict = (mod as any).default ?? mod
  } catch {
    throw new PretextPdfError(
      'UNSUPPORTED_LANGUAGE',
      `Hyphenation dictionary for "${language}" not found. Install it with: pnpm add hyphenation.${language}`
    )
  }
  // @ts-ignore hypher has no type definitions available
  const { default: Hypher } = await import('hypher')
  return new Hypher(dict)
}

// ─── RTL Text Support (Unicode Bidirectional Algorithm via bidi-js) ────────────

/**
 * Detect text direction and apply Unicode Bidi Algorithm (TR9) for visual reordering.
 * Returns the visual-order text ready for measurement and rendering.
 */
export async function detectAndReorderRTL(
  text: string,
  dirOverride?: 'ltr' | 'rtl' | 'auto'
): Promise<{ visual: string; isRTL: boolean; logical: string }> {
  // Step 1: Explicit override takes priority
  if (dirOverride === 'ltr') {
    return { visual: text, isRTL: false, logical: text }
  }

  if (dirOverride === 'rtl') {
    try {
      // @ts-ignore bidi-js has no type definitions
      const bidiFactory = (await import('bidi-js')).default
      const bidi = typeof bidiFactory === 'function' ? bidiFactory() : bidiFactory
      const { getEmbeddingLevels, getReorderedString } = bidi
      const embedLevelsResult = getEmbeddingLevels(text, 'rtl')
      const visual = getReorderedString(text, embedLevelsResult)
      return { visual, isRTL: true, logical: text }
    } catch (err) {
      console.warn('bidi-js error during RTL reordering:', err)
      return { visual: text, isRTL: false, logical: text }
    }
  }

  // Step 2: Auto-detect dominant direction
  const rtlRanges = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/g
  const rtlCount = (text.match(rtlRanges) ?? []).length
  const ltrCount = (text.match(/[a-zA-Z0-9]/g) ?? []).length

  const isRTL = rtlCount > 0 && rtlCount >= ltrCount

  if (!isRTL) {
    return { visual: text, isRTL: false, logical: text }
  }

  // Step 3: Apply bidi algorithm (TR9) to reorder visually
  try {
    // @ts-ignore bidi-js has no type definitions
    const bidiFactory = (await import('bidi-js')).default
    const bidi = typeof bidiFactory === 'function' ? bidiFactory() : bidiFactory
    const { getEmbeddingLevels, getReorderedString } = bidi
    const embedLevelsResult = getEmbeddingLevels(text, 'rtl')
    const visual = getReorderedString(text, embedLevelsResult)
    return { visual, isRTL: true, logical: text }
  } catch (err) {
    console.warn('bidi-js error during RTL reordering:', err)
    return { visual: text, isRTL: false, logical: text }
  }
}

/**
 * Measure a single word's rendered width using pretext at maxWidth=99999.
 */
export async function measureWord(word: string, fontString: string): Promise<number> {
  const { prepareWithSegments, layoutWithLines } = await getPretext()
  if (!word) return 0
  const prepared = prepareWithSegments(word, fontString, {})
  const result = layoutWithLines(prepared, 99999, 99999)
  const lines: Array<{ text: string; width: number }> = result.lines ?? []
  return lines[0]?.width ?? 0
}

// ─── Core Text Measurement ────────────────────────────────────────────────────

/**
 * Measure unwrapped (single-line) text width using pretext at large maxWidth.
 * Handles multi-line text by returning the max width across all lines.
 */
export async function measureNaturalTextWidth(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: 400 | 700
): Promise<number> {
  if (!text || text.trim() === '') return 0

  const { prepareWithSegments, layoutWithLines } = await getPretext()

  const weightPrefix = fontWeight === 700 ? 'bold ' : ''
  const fontString = `${weightPrefix}${fontSize}px ${fontFamily}`

  const prepared = prepareWithSegments(text, fontString, {})
  const result = layoutWithLines(prepared, 99999, 99999)
  const lines: Array<{ text: string; width: number }> = result.lines ?? []

  return Math.max(0, ...lines.map(l => l.width))
}

/**
 * Full hyphenation path: intelligently splits text into lines with Liang's algorithm.
 * Uses greedy bin packing with hyphenation at word boundaries.
 * Returns lines with actual hyphens added to hyphenated words.
 */
export async function measureTextWithHyphenation(
  text: string,
  fontString: string,
  maxWidth: number,
  opts: HyphenatorOpts
): Promise<Array<{ text: string; width: number }>> {
  const { instance: hypher, minWordLength, leftMin, rightMin } = opts
  const widthCache = new Map<string, number>()

  const measure = async (w: string): Promise<number> => {
    if (widthCache.has(w)) return widthCache.get(w)!
    const width = await measureWord(w, fontString)
    widthCache.set(w, width)
    return width
  }

  let spaceWidth = await measure(' ')
  // Fallback if canvas returns 0 for space
  if (spaceWidth === 0) {
    const aWidth = await measure('a')
    const aaWidth = await measure('a a')
    spaceWidth = aaWidth - 2 * aWidth
    if (spaceWidth <= 0) spaceWidth = aWidth * 0.3 // Reasonable estimate
  }

  const allLines: Array<{ text: string; width: number }> = []

  for (const para of text.split('\n')) {
    if (!para.trim()) {
      allLines.push({ text: '', width: 0 })
      continue
    }

    const words = para.split(/\s+/).filter(w => w.length > 0)
    // Pre-measure all unique words in this paragraph
    const uniqueWords = new Set(words)
    for (const w of uniqueWords) {
      await measure(w)
    }

    const lines: Array<{ text: string; width: number }> = []
    let currentWords: string[] = []
    let currentWidth = 0

    const flush = () => {
      if (currentWords.length > 0) {
        lines.push({ text: currentWords.join(' '), width: currentWidth })
        currentWords = []
        currentWidth = 0
      }
    }

    for (const word of words) {
      const ww = widthCache.get(word)!
      const addW = currentWords.length > 0 ? spaceWidth + ww : ww

      if (currentWidth + addW <= maxWidth || currentWords.length === 0) {
        currentWords.push(word)
        currentWidth += addW
      } else {
        // Try hyphenation
        let hyphenated = false

        if (word.length >= minWordLength) {
          const sylls = hypher.hyphenate(word)

          for (let split = sylls.length - 1; split >= 1; split--) {
            const prefix = sylls.slice(0, split).join('')
            const suffix = sylls.slice(split).join('')
            if (prefix.length < leftMin || suffix.length < rightMin) continue

            const hyphenPart = prefix + '-'
            const hw = await measure(hyphenPart)
            const addHW = currentWords.length > 0 ? spaceWidth + hw : hw

            if (currentWidth + addHW <= maxWidth) {
              currentWords.push(hyphenPart)
              currentWidth += addHW
              flush()
              await measure(suffix)
              currentWords = [suffix]
              currentWidth = widthCache.get(suffix)!
              hyphenated = true
              break
            }
          }
        }

        if (!hyphenated) {
          flush()
          currentWords = [word]
          currentWidth = ww
        }
      }
    }

    flush()
    allLines.push(...lines)
  }

  return allLines
}

/**
 * Core text measurement: delegates to hyphenation path or direct Pretext layout.
 * If no hyphenator is available, falls back to direct layout (text wraps without hyphens).
 */
export async function measureText(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: 400 | 700,
  maxWidth: number,
  lineHeight: number,
  hyphenatorOpts?: HyphenatorOpts
): Promise<Array<{ text: string; width: number }>> {
  if (!text || text.trim() === '') return []

  const { prepareWithSegments, layoutWithLines } = await getPretext()

  const weightPrefix = fontWeight === 700 ? 'bold ' : ''
  const fontString = `${weightPrefix}${fontSize}px ${fontFamily}`

  // If hyphenator is available and text is long, use hyphenation
  if (hyphenatorOpts && text.length > hyphenatorOpts.minWordLength) {
    return await measureTextWithHyphenation(text, fontString, maxWidth, hyphenatorOpts)
  }

  // No hyphenation: use direct pretext layout
  const prepared = prepareWithSegments(text, fontString, {})
  const result = layoutWithLines(prepared, maxWidth, 99999)
  return result.lines ?? []
}
