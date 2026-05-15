/**
 * measure.ts — Measurement orchestrator
 * Entry point for the measurement pipeline. Exports public measurement functions.
 */

import type {
  PdfDocument, ContentElement
} from './types.js'
import type {
  MeasuredBlock, ImageMap
} from './types-internal.js'
import { PretextPdfError } from './errors.js'
import { measureBlock } from './measure-blocks.js'
import { getPretext, HyphenatorOpts, getHyphenator } from './measure-text.js'
import { LINE_HEIGHT_BODY } from './render-utils.js'
import type { PluginDefinition } from './plugin-types.js'
import { findPlugin, runPluginMeasure } from './plugin-registry.js'

// Re-export for backward compatibility with tests
export { measureBlock }

/**
 * Build the canonical font key: family-weight-style
 * Used by both measure.ts and render.ts for font lookup
 */
export function buildFontKey(
  family: string,
  weight: 400 | 700 = 400,
  style: 'normal' | 'italic' = 'normal'
): string {
  return `${family}-${weight}-${style}`
}

/**
 * Measure a short header/footer string — returns total height in pt.
 */
export async function measureHeaderFooterHeight(
  text: string,
  fontSize: number,
  fontFamily: string,
  contentWidth: number,
  lineHeight: number
): Promise<number> {
  if (!text || text.trim() === '') return 0

  const { prepareWithSegments, layoutWithLines } = await getPretext()

  const sampleText = text
    .replace('{{pageNumber}}', '99')
    .replace('{{totalPages}}', '99')

  const fontString = `${fontSize}px ${fontFamily}`
  const prepared = prepareWithSegments(sampleText, fontString, {})
  const result = layoutWithLines(prepared, contentWidth, lineHeight)

  return result.lineCount * lineHeight
}

/**
 * Build measured TOC entry blocks from draft headings (two-pass TOC generation).
 * Each entry is placed on a specific page.
 */
export async function buildTocEntryBlocks(
  headings: Array<{ text: string; level: 1 | 2 | 3 | 4; pageIndex: number }>,
  tocElement: import('./types.js').TocElement,
  contentWidth: number,
  doc: PdfDocument,
): Promise<MeasuredBlock[]> {
  const { measureText } = await import('./measure-text.js')

  const minLevel = tocElement.minLevel ?? 1
  const maxLevel = tocElement.maxLevel ?? 3
  const fontSize = tocElement.fontSize ?? doc.defaultFontSize ?? 12
  const titleFontSize = tocElement.titleFontSize ?? (fontSize + 4)
  const lineHeight = fontSize * LINE_HEIGHT_BODY
  const levelIndent = tocElement.levelIndent ?? 16
  const leader = tocElement.leader ?? '.'
  const fontFamily = tocElement.fontFamily ?? doc.defaultFont ?? 'Inter'
  const fontWeight = 400
  const fontKey = buildFontKey(fontFamily, fontWeight, 'normal')
  const blocks: MeasuredBlock[] = []

  // Title block (if showTitle !== false)
  if (tocElement.showTitle !== false) {
    const title = tocElement.title ?? 'Table of Contents'
    const titleLines = await measureText(title, titleFontSize, fontFamily, 700, contentWidth, titleFontSize * LINE_HEIGHT_BODY, undefined)
    blocks.push({
      element: { type: 'toc-entry', text: title, pageNumber: -1, level: 1, levelIndent: 0, leader: '', fontFamily, fontWeight: 700 } as import('./types.js').TocEntryElement,
      height: titleLines.length * (titleFontSize * LINE_HEIGHT_BODY),
      lines: titleLines,
      fontSize: titleFontSize,
      lineHeight: titleFontSize * LINE_HEIGHT_BODY,
      fontKey: buildFontKey(fontFamily, 700, 'normal'),
      spaceAfter: lineHeight,
      spaceBefore: 0,
      tocEntryData: { entryX: 0, pageStr: '', leaderChar: '' },
    } satisfies MeasuredBlock)
  }

  // Entry blocks — one per heading in range
  for (const h of headings) {
    if (h.level < minLevel || h.level > maxLevel) continue
    const indent = (h.level - minLevel) * levelIndent
    const pageStr = String(h.pageIndex + 1) // 1-based page numbers
    const entryTextWidth = contentWidth - indent - 30 // reserve 30pt for page number area
    const lines = await measureText(h.text, fontSize, fontFamily, fontWeight, entryTextWidth, lineHeight, undefined)
    blocks.push({
      element: { type: 'toc-entry', text: h.text, pageNumber: h.pageIndex + 1, level: h.level, levelIndent: indent, leader, fontFamily, fontWeight } as import('./types.js').TocEntryElement,
      height: lines.length * lineHeight,
      lines,
      fontSize,
      lineHeight,
      fontKey,
      spaceAfter: tocElement.entrySpacing ?? 4,
      spaceBefore: 0,
      tocEntryData: { entryX: indent, pageStr, leaderChar: leader },
    } satisfies MeasuredBlock)
  }

  return blocks
}

/**
 * Stage 3: Measure all document content elements.
 * Handles image key resolution, list flattening, SVG wrapping, hyphenation initialization.
 *
 * Returns array of MeasuredBlock (includes flattened lists + SVG-wrapped images).
 */
export async function measureAllBlocks(
  doc: PdfDocument,
  contentWidth: number,
  imageMap: ImageMap,
  pageContentHeight: number,
  plugins?: PluginDefinition[]
): Promise<MeasuredBlock[]> {
  const { measureImageWithKey, measureFloatImageBlock } = await import('./measure-blocks.js')

  const results: MeasuredBlock[] = []

  // Initialize hyphenator if enabled
  let hyphenatorOpts: HyphenatorOpts | undefined
  if (doc.hyphenation) {
    const { language, minWordLength = 6, leftMin = 2, rightMin = 3 } = doc.hyphenation
    const instance = await getHyphenator(language)
    hyphenatorOpts = { instance, minWordLength, leftMin, rightMin }
  }

  for (let i = 0; i < doc.content.length; i++) {
    const el = doc.content[i]!

    if (el.type === 'image') {
      // Images need their specific imageMap key (keyed by content index in assets.ts)
      const imageKey = `img-${i}`
      // Skip images that failed to load (not in imageMap) — they were already logged as warnings
      if (!imageMap.has(imageKey)) {
        continue
      }
      if (el.float) {
        const block = await measureFloatImageBlock(el, imageKey, imageMap, contentWidth, pageContentHeight, doc)
        results.push(block)
      } else {
        const block = await measureImageWithKey(el, imageKey, imageMap, contentWidth, pageContentHeight)
        results.push(block)
      }
    } else if (el.type === 'svg' || el.type === 'qr-code' || el.type === 'barcode' || el.type === 'chart') {
      const prefix = el.type === 'svg' ? 'svg' : el.type === 'qr-code' ? 'qr' : el.type === 'barcode' ? 'barcode' : 'chart'
      const svgKey = `${prefix}-${i}`
      // Skip elements whose image failed to generate (not in imageMap)
      if (!imageMap.has(svgKey)) {
        continue
      }
      const elWidth  = 'width'  in el ? el.width  : el.type === 'qr-code' ? el.size : undefined
      const elHeight = 'height' in el ? el.height : el.type === 'qr-code' ? el.size : undefined
      // Synthetic ImageElement reuses existing measurement logic (aspect ratio, clamping, height validation)
      const syntheticImage: import('./types.js').ImageElement = {
        type: 'image',
        src: '',  // unused by measureImageWithKey — it reads from imageMap only
        ...(elWidth  !== undefined ? { width:  elWidth  } : {}),
        ...(elHeight !== undefined ? { height: elHeight } : {}),
        ...(el.align !== undefined ? { align:  el.align } : {}),
        spaceAfter:  el.spaceAfter  ?? 8,
        spaceBefore: el.spaceBefore ?? 8,
      }
      const block = await measureImageWithKey(syntheticImage, svgKey, imageMap, contentWidth, pageContentHeight)
      // measureImageWithKey returns a block with element = syntheticImage. We overwrite it with
      // the original element (svg/qr-code/barcode/chart) so render.ts routes to the right renderer.
      // The cast bypasses MeasuredBlock.element's readonly constraint via unknown.
      // This is safe because this is the single construction site and the field is never mutated elsewhere.
      ;(block as unknown as Record<string, unknown>).element = el
      results.push(block)
    } else if (el.type === 'float-group') {
      const { measureFloatGroup } = await import('./measure-blocks.js')
      const imageKey = `float-group-${i}`
      // Skip float-groups if their image failed to load
      if (!imageMap.has(imageKey)) {
        continue
      }
      const block = await measureFloatGroup(el, imageKey, imageMap, contentWidth, pageContentHeight, doc, hyphenatorOpts)
      results.push(block)
    } else {
      const plugin = plugins ? findPlugin(plugins, el.type) : undefined
      if (plugin) {
        const pluginImageKey = `${plugin.type}-${i}`
        const hasAsset = imageMap.has(pluginImageKey)
        const block = await runPluginMeasure(
          plugin,
          el as unknown as Record<string, unknown>,
          { contentWidth, contentHeight: pageContentHeight, doc },
          hasAsset ? pluginImageKey : undefined
        )
        results.push(block)
      } else {
        const result = await measureBlock(el, contentWidth, doc, hyphenatorOpts)
        if (Array.isArray(result)) {
          results.push(...result)
        } else {
          results.push(result)
        }
      }
    }
  }

  return results
}
