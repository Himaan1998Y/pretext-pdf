/**
 * measure-blocks/index.ts — Per-element-type measurement dispatcher.
 *
 * Each switch arm in measureBlock() routes to a per-type helper in a sibling
 * module. Public API (measureBlock, measureImageWithKey, measureFloatImageBlock,
 * measureFloatGroup, resolveColumnWidths) is re-exported from here so callers
 * can either import the dispatcher directly or, for legacy paths,
 * `src/measure-blocks.ts` (a one-line barrel onto this file).
 *
 * v1.4.1 (M2): float-group.ts no longer imports measureBlock from this
 * module. Callers (measure.ts orchestrator) pass measureBlock in as a
 * parameter to break the runtime import cycle:
 *   was:  float-group.ts -> ./index.js -> ./float-group.js (cycle)
 *   now:  index.ts re-exports measureFloatGroup; float-group.ts has no
 *         back-edge to index.ts.
 */

import type { ContentElement, PdfDocument } from '../types.js'
import type { MeasuredBlock } from '../types-internal.js'
import { PretextPdfError } from '../errors.js'
import { buildFontKey } from '../measure.js'
import { measureRichText } from '../rich-text.js'
import { HyphenatorOpts, detectAndReorderRTL } from '../measure-text.js'
import { LINE_HEIGHT_BODY } from '../render-utils.js'

import {
  measureParagraph, measureHeading, measureBlockquote,
  measureCallout, measureCode,
} from './text-blocks.js'
import { measureList } from './list.js'
import { measureTable } from './table/measure.js'
import {
  measureSpacer, measurePageBreak, measureComment, measureFormField,
  measureHr, measureToc, measureFootnoteDef,
} from './simple-blocks.js'

// Re-export the table column-width resolver for external consumers / tests.
export { resolveColumnWidths } from './table/columns.js'
// Re-export image + float-group helpers for callers that import them directly.
export { measureImageWithKey, measureFloatImageBlock } from './image.js'
export { measureFloatGroup } from './float-group.js'

export async function measureBlock(
  element: ContentElement,
  contentWidth: number,
  doc: PdfDocument,
  hyphenatorOpts?: HyphenatorOpts,
  wordWidthCache?: Map<string, number>,
): Promise<MeasuredBlock | MeasuredBlock[]> {
  const baseFontSize = doc.defaultFontSize ?? 12
  const baseFont = doc.defaultFont ?? 'Inter'

  // Reject the internal TOC entry type. TocEntryElement is synthesized
  // internally by the TOC pass and never produced from user-supplied content.
  if ((element as { type: unknown }).type === 'toc-entry') {
    throw new PretextPdfError('VALIDATION_ERROR', 'toc-entry is an internal type and cannot be used in document content')
  }

  switch (element.type) {
    case 'spacer': {
      return measureSpacer(element)
    }

    case 'page-break': {
      return measurePageBreak(element)
    }

    case 'comment': {
      return measureComment(element as import('../types.js').CommentElement)
    }

    case 'form-field': {
      return measureFormField(element as import('../types.js').FormFieldElement, baseFontSize, baseFont)
    }

    case 'paragraph': {
      return measureParagraph(element, contentWidth, doc, baseFontSize, baseFont, hyphenatorOpts, wordWidthCache)
    }

    case 'heading': {
      return measureHeading(element, contentWidth, doc, baseFontSize, baseFont, hyphenatorOpts, wordWidthCache)
    }

    case 'hr': {
      return measureHr(element)
    }

    case 'image': {
      // Image elements must be measured via measureAllBlocks() — not measureBlock() directly.
      // measureAllBlocks() resolves the content-index-based imageMap key (img-N) before calling
      // measureImageWithKey(). measureBlock() doesn't have access to the content index.
      throw new PretextPdfError(
        'VALIDATION_ERROR',
        'Image elements cannot be measured via measureBlock() directly — use measureAllBlocks() which resolves the imageMap key correctly.'
      )
    }

    case 'svg': {
      // SVG elements must be measured via measureAllBlocks() — not measureBlock() directly.
      // measureAllBlocks() resolves the content-index-based imageMap key (svg-N) before calling
      // measureImageWithKey(). measureBlock() doesn't have access to the content index.
      throw new PretextPdfError(
        'VALIDATION_ERROR',
        'SVG elements cannot be measured via measureBlock() directly — use measureAllBlocks() which resolves the imageMap key correctly.'
      )
    }

    case 'qr-code':
    case 'barcode':
    case 'chart': {
      // QR/barcode/chart elements measured via measureAllBlocks() which generates the SVG
      // and dispatches through the SVG path. measureBlock() doesn't have content-index context.
      throw new PretextPdfError(
        'VALIDATION_ERROR',
        `'${element.type}' elements cannot be measured via measureBlock() directly — use measureAllBlocks() which generates the underlying SVG.`
      )
    }

    case 'list': {
      return measureList(element, contentWidth, doc, baseFontSize, hyphenatorOpts, wordWidthCache)
    }

    case 'table': {
      return measureTable(element, contentWidth, doc, baseFontSize, hyphenatorOpts, wordWidthCache)
    }

    case 'rich-paragraph': {
      // Detect paragraph-level RTL direction for alignment default
      // Individual spans can override via span.dir, but paragraph.dir sets the default
      const fullText = element.spans.map(s => s.text).join('')
      const { isRTL } = await detectAndReorderRTL(fullText, element.dir)

      const fontSize = element.fontSize ?? baseFontSize
      const lineHeight = element.lineHeight ?? doc.defaultLineHeight ?? (fontSize * LINE_HEIGHT_BODY)
      // 'justify' uses left alignment for measurement (justify is rendering-only)
      const alignRaw = element.align ?? 'left'
      const align = alignRaw === 'justify' ? 'left' : alignRaw as 'left' | 'center' | 'right'

      const columns = element.columns ?? 1
      const columnGap = element.columnGap ?? 24
      let measureWidth = contentWidth
      let columnData: { columnCount: number; columnGap: number; columnWidth: number; linesPerColumn: number } | undefined

      // Multi-column layout
      if (columns > 1) {
        const columnWidth = (contentWidth - (columns - 1) * columnGap) / columns
        if (columnWidth < 50) {
          throw new PretextPdfError('COLUMN_WIDTH_TOO_NARROW', `Column width would be ${columnWidth.toFixed(1)}pt, which is below the minimum 50pt. Reduce columns, increase columnGap, or increase page width.`)
        }
        measureWidth = columnWidth
      }

      const richLines = await measureRichText(
        element.spans,
        fontSize,
        lineHeight,
        measureWidth,
        align,
        doc
      )

      if (columns > 1) {
        const columnWidth = (contentWidth - (columns - 1) * columnGap) / columns
        const linesPerColumn = Math.ceil(richLines.length / columns)
        columnData = { columnCount: columns, columnGap, columnWidth, linesPerColumn }
      }

      // For paginator/renderer compatibility, also produce a flat lines[] array
      // (used for orphan/widow logic and line-count-based pagination).
      // Each RichLine becomes one PretextLine with its totalWidth.
      const lines: import('../types-internal.js').PretextLine[] = richLines.map(rl => ({
        text: rl.fragments.map(f => f.text).join(''),
        width: rl.totalWidth,
      }))

      // Construct result with or without columnData depending on columns value
      // Block height = sum of per-line heights (variable when spans use different font sizes)
      const blockHeight = richLines.reduce((sum, rl) => sum + rl.lineHeight, 0)

      if (columnData) {
        return {
          element,
          height: blockHeight,  // richLines already have per-line heights
          lines,
          fontSize,
          lineHeight,
          fontKey: buildFontKey(doc.defaultFont ?? 'Inter', 400, 'normal'),
          spaceAfter: element.spaceAfter ?? 0,
          spaceBefore: element.spaceBefore ?? 0,
          richLines,
          columnData,
          isRTL,
        }
      } else {
        return {
          element,
          height: blockHeight,  // richLines already have per-line heights
          lines,
          fontSize,
          lineHeight,
          fontKey: buildFontKey(doc.defaultFont ?? 'Inter', 400, 'normal'),
          spaceAfter: element.spaceAfter ?? 0,
          spaceBefore: element.spaceBefore ?? 0,
          richLines,
          isRTL,
        }
      }
    }

    case 'code': {
      return measureCode(element, contentWidth, doc, baseFontSize, wordWidthCache)
    }

    case 'blockquote': {
      return measureBlockquote(element, contentWidth, doc, baseFontSize, baseFont, hyphenatorOpts, wordWidthCache)
    }

    case 'callout': {
      return measureCallout(
        element as import('../types.js').CalloutElement,
        contentWidth, doc, baseFontSize, baseFont, hyphenatorOpts, wordWidthCache,
      )
    }

    case 'toc': {
      return measureToc(element)
    }

    case 'footnote-def': {
      return measureFootnoteDef(element as import('../types.js').FootnoteDefElement, contentWidth, doc, wordWidthCache)
    }

    case 'float-group': {
      // Float groups are handled at the measure.ts orchestrator level, not here
      throw new PretextPdfError('VALIDATION_ERROR', 'float-group cannot be measured by measureBlock — it should be handled by measureAllBlocks in measure.ts')
    }

    default: {
      const unknownType = (element as { type: unknown }).type
      throw new PretextPdfError('VALIDATION_ERROR', `Unknown element type: "${String(unknownType)}"`)
    }
  }
}
