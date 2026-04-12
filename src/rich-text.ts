import type { InlineSpan, RichLine, RichFragment, PdfDocument } from './types.js'
import { buildFontKey } from './measure.js'

/** Lazily-loaded Pretext module */
let _pretext: typeof import('@chenglou/pretext') | null = null

async function getPretext() {
  if (!_pretext) {
    _pretext = await import('@chenglou/pretext')
  }
  return _pretext
}

/**
 * Measure the natural (pixel) width of a single text token using Pretext.
 * Uses a very large maxWidth so no wrapping occurs.
 */
async function measureTokenWidth(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: 400 | 700,
  fontStyle: 'normal' | 'italic'
): Promise<number> {
  if (!text) return 0

  const { prepareWithSegments, layoutWithLines } = await getPretext()

  const weightPrefix = fontWeight === 700 ? 'bold ' : ''
  const stylePrefix = fontStyle === 'italic' ? 'italic ' : ''
  const fontString = `${stylePrefix}${weightPrefix}${fontSize}px ${fontFamily}`

  const prepared = prepareWithSegments(text, fontString, { whiteSpace: 'pre-wrap' })
  const result = layoutWithLines(prepared, 99999, fontSize * 1.5)
  const lines: Array<{ text: string; width: number }> = result.lines ?? []

  return lines[0]?.width ?? 0
}

/**
 * Compose mixed-format spans into laid-out RichLine[] for rendering.
 *
 * Note: RichParagraphElement.tabularNumbers is available but not yet threaded
 * into this function. Wire it in Wave 3 by adding a `tabularNumbers` parameter
 * and applying drawTabularText per-fragment during render.
 *
 * Algorithm:
 * 1. Tokenize all spans into (word, fontConfig) pairs — split on whitespace boundaries
 * 2. Measure each token's width using Pretext
 * 3. Greedily pack tokens onto lines respecting contentWidth
 * 4. Apply alignment offsets
 *
 * Restriction: all spans must use the same fontSize (enforced by validate.ts).
 */
export async function measureRichText(
  spans: InlineSpan[],
  fontSize: number,
  lineHeight: number,
  contentWidth: number,
  align: 'left' | 'center' | 'right',
  doc: PdfDocument
): Promise<RichLine[]> {
  const baseFont = doc.defaultFont ?? 'Inter'

  // ── Step 1: Tokenize spans into word-tokens ─────────────────────────────────
  interface Token {
    text: string
    fontKey: string
    fontFamily: string
    fontWeight: 400 | 700
    fontStyle: 'normal' | 'italic'
    fontSize: number
    color: string
    underline: boolean
    strikethrough: boolean
    url: string | undefined
    isHardBreak: boolean
    width: number // filled in step 2
    yOffset: number | undefined
    footnoteRef: string | undefined
  }

  const tokens: Token[] = []

  for (const span of spans) {
    const fontFamily = span.fontFamily ?? baseFont
    const fontWeight = span.fontWeight ?? 400
    const fontStyle = span.fontStyle ?? 'normal'
    const color = span.color ?? '#000000'
    const spanFontSize = span.fontSize ?? fontSize  // Phase 5B.4: per-span font size
    // Phase 6B: urls auto-apply blue color + underline when no explicit override
    const effectiveColor = span.url && !span.color ? '#0070f3' : (span.color ?? '#000000')
    const underline = span.url ? true : (span.underline ?? false)
    const strikethrough = span.strikethrough ?? false
    const url = span.url
    const fontKey = buildFontKey(fontFamily, fontWeight, fontStyle)

    // Phase 8H: verticalAlign (superscript/subscript) → yOffset + smaller fontSize
    let spanEffectiveFontSize = spanFontSize
    let yOffset: number | undefined
    if (span.verticalAlign === 'superscript') {
      yOffset = spanEffectiveFontSize * 0.4
      spanEffectiveFontSize = spanEffectiveFontSize * 0.65
    } else if (span.verticalAlign === 'subscript') {
      yOffset = -spanEffectiveFontSize * 0.2
      spanEffectiveFontSize = spanEffectiveFontSize * 0.65
    }

    // Split on newlines first to respect hard breaks, then on spaces
    const parts = span.text.split('\n')
    for (let pi = 0; pi < parts.length; pi++) {
      if (pi > 0) {
        // Inject a hard-break sentinel
        tokens.push({ text: '', fontKey, fontFamily, fontWeight, fontStyle, fontSize: spanEffectiveFontSize, color: effectiveColor, underline, strikethrough, url, isHardBreak: true, width: 0, yOffset, footnoteRef: span.footnoteRef })
      }
      const part = parts[pi]!
      if (part === '') continue

      // Split into words (keeping the space as part of the preceding word)
      // e.g. "hello world" → ["hello ", "world"]
      const words = part.split(/(?<=\s)|(?=\s)/).filter(w => w.length > 0)

      // Merge each word with trailing space into one token
      const merged: string[] = []
      let current = ''
      for (const w of words) {
        if (w.trim() === '') {
          current += w // accumulate spaces
        } else {
          if (current) { merged.push(current); current = '' }
          current = w
        }
      }
      if (current) merged.push(current)

      for (const word of merged) {
        tokens.push({ text: word, fontKey, fontFamily, fontWeight, fontStyle, fontSize: spanEffectiveFontSize, color: effectiveColor, underline, strikethrough, url, isHardBreak: false, width: 0, yOffset, footnoteRef: span.footnoteRef })
      }
    }
  }

  // ── Step 2: Measure each token's width ─────────────────────────────────────
  await Promise.all(
    tokens.map(async (token) => {
      if (token.isHardBreak) return
      token.width = await measureTokenWidth(token.text, token.fontSize, token.fontFamily, token.fontWeight, token.fontStyle)
    })
  )

  // ── Step 3: Greedy line packing ─────────────────────────────────────────────
  const composedLines: Array<{ fragments: Array<Omit<RichFragment, 'x'>>; totalWidth: number; lineHeight: number }> = []
  let currentFragments: Array<Omit<RichFragment, 'x'> & { _x: number }> = []
  let currentX = 0
  let currentLineWidth = 0

  function finalizeLine() {
    if (currentFragments.length === 0) return
    // Trim trailing whitespace from last fragment and adjust totalWidth
    const last = currentFragments[currentFragments.length - 1]!
    const trimmedText = last.text.trimEnd()
    const trimmedChars = last.text.length - trimmedText.length
    // Estimate trimmed width proportionally (avoids async re-measurement)
    const trimmedWidthDelta = trimmedChars > 0 && last.text.length > 0
      ? last.width * (trimmedChars / last.text.length)
      : 0
    const trimmedWidth = last.width - trimmedWidthDelta
    const trimmedFragment = { ...last, text: trimmedText, width: trimmedWidth }
    const fragments = [...currentFragments.slice(0, -1), trimmedFragment]

    // Phase 5B.4: Compute per-line lineHeight = max(fragment.fontSize) * lineHeightRatio
    const maxFontSize = fragments.length > 0
      ? Math.max(...fragments.map(f => f.fontSize))
      : fontSize
    const lineHeightRatio = lineHeight / fontSize
    const thisLineHeight = maxFontSize * lineHeightRatio

    composedLines.push({
      fragments: fragments.map(f => ({ text: f.text, fontKey: f.fontKey, fontSize: f.fontSize, color: f.color, width: f.width, underline: f.underline ?? false, strikethrough: f.strikethrough ?? false, ...(f.url !== undefined ? { url: f.url } : {}), ...((f as any).yOffset !== undefined ? { yOffset: (f as any).yOffset } : {}), ...((f as any).footnoteRef !== undefined ? { footnoteRef: (f as any).footnoteRef } : {}) })),
      totalWidth: currentLineWidth - trimmedWidthDelta,
      lineHeight: thisLineHeight,
    })
    currentFragments = []
    currentX = 0
    currentLineWidth = 0
  }

  for (const token of tokens) {
    if (token.isHardBreak) {
      // End the current line. If currentFragments is non-empty, saves the line.
      // If empty, this is a blank line from consecutive \n — push an empty line.
      if (currentFragments.length > 0) {
        finalizeLine()
      } else {
        composedLines.push({ fragments: [], totalWidth: 0, lineHeight: lineHeight })
      }
      continue
    }

    // Skip leading spaces at line start
    const isLeadingSpace = currentX === 0 && token.text.trim() === ''
    if (isLeadingSpace) continue

    // Check if token overflows current line
    if (currentLineWidth + token.width > contentWidth + 0.01 && currentX > 0) {
      finalizeLine()
      // Skip leading space at new line start
      if (token.text.trim() === '') continue
    }

    currentFragments.push({
      text: token.text,
      fontKey: token.fontKey,
      fontSize: token.fontSize,
      color: token.color,
      width: token.width,
      underline: token.underline,
      strikethrough: token.strikethrough,
      ...(token.url !== undefined ? { url: token.url } : {}),
      ...(token.yOffset !== undefined ? { yOffset: token.yOffset } : {}),
      _x: currentX,
    })
    currentX += token.width
    currentLineWidth += token.width
  }
  finalizeLine()

  // ── Step 4: Compute x positions with alignment ─────────────────────────────
  const richLines: RichLine[] = composedLines.map(({ fragments, totalWidth, lineHeight: composedLineHeight }) => {
    let offset = 0
    if (align === 'center') offset = Math.max(0, (contentWidth - totalWidth) / 2)
    else if (align === 'right') offset = Math.max(0, contentWidth - totalWidth)

    // Recompute fragment x positions from left
    let x = offset
    const positionedFragments: RichFragment[] = fragments.map(f => {
      const fragment: RichFragment = { text: f.text, fontKey: f.fontKey, fontSize: f.fontSize, color: f.color, x, width: f.width, underline: f.underline ?? false, strikethrough: f.strikethrough ?? false, ...(f.url !== undefined ? { url: f.url } : {}), ...(f.yOffset !== undefined ? { yOffset: f.yOffset } : {}), ...(f.footnoteRef !== undefined ? { footnoteRef: f.footnoteRef } : {}) }
      x += f.width
      return fragment
    })

    return { fragments: positionedFragments, totalWidth, lineHeight: composedLineHeight }
  })

  return richLines
}
