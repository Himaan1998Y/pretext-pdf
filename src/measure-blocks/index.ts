/**
 * measure-blocks/index.ts — Per-element-type measurement dispatcher.
 *
 * Each switch arm in measureBlock() routes to a per-type helper in a sibling
 * module. Public API (measureBlock, measureImageWithKey, measureFloatImageBlock,
 * measureFloatGroup, resolveColumnWidths) is re-exported from here so callers
 * can either import the dispatcher directly or, for legacy paths,
 * `src/measure-blocks.ts` (a one-line barrel onto this file).
 */

import type { ContentElement, PdfDocument } from '../types.js'
import type { MeasuredBlock } from '../types-internal.js'
import { PretextPdfError } from '../errors.js'
import { buildFontKey } from '../measure.js'
import { measureRichText } from '../rich-text.js'
import { HyphenatorOpts, detectAndReorderRTL, measureText } from '../measure-text.js'
import { LINE_HEIGHT_BODY } from '../render-utils.js'

import {
  measureParagraph, measureHeading, measureBlockquote,
  measureCallout, measureCode,
} from './text-blocks.js'
import { measureList } from './list.js'
import { measureTable } from './table/measure.js'

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
      return {
        element,
        height: element.height,
        lines: [],
        fontSize: 0,
        lineHeight: 0,
        fontKey: '',
        spaceAfter: 0,
        spaceBefore: 0,
      }
    }

    case 'page-break': {
      return {
        element,
        height: 0,
        lines: [],
        fontSize: 0,
        lineHeight: 0,
        fontKey: '',
        spaceAfter: 0,
        spaceBefore: 0,
      }
    }

    case 'comment': {
      return {
        element,
        height: 20,
        lines: [],
        fontSize: 0,
        lineHeight: 0,
        fontKey: '',
        spaceAfter: (element as import('../types.js').CommentElement).spaceAfter ?? 0,
        spaceBefore: 0,
      }
    }

    case 'form-field': {
      const el = element as import('../types.js').FormFieldElement
      const fs = el.fontSize ?? baseFontSize
      const labelHeight = el.label ? fs * LINE_HEIGHT_BODY + 4 : 0
      let fieldHeight = el.height
      if (!fieldHeight) {
        if (el.fieldType === 'text' && el.multiline) fieldHeight = 60
        else if (el.fieldType === 'radio') fieldHeight = 20 * Math.max(1, el.options?.length ?? 1)
        else fieldHeight = 24
      }
      return {
        element,
        height: labelHeight + fieldHeight + (el.spaceAfter ?? 8),
        lines: [],
        fontSize: fs,
        lineHeight: fieldHeight,
        fontKey: buildFontKey(baseFont, 400, 'normal'),
        spaceAfter: el.spaceAfter ?? 8,
        spaceBefore: el.spaceBefore ?? 0,
        formFieldData: { labelHeight, fieldHeight },
      }
    }

    case 'paragraph': {
      return measureParagraph(element, contentWidth, doc, baseFontSize, baseFont, hyphenatorOpts, wordWidthCache)
    }

    case 'heading': {
      return measureHeading(element, contentWidth, doc, baseFontSize, baseFont, hyphenatorOpts, wordWidthCache)
    }

    case 'hr': {
      const spaceAbove = element.spaceAbove ?? element.spaceBefore ?? 12
      const thickness = element.thickness ?? 0.5
      const spaceBelow = element.spaceBelow ?? element.spaceAfter ?? 12
      return {
        element,
        height: spaceAbove + thickness + spaceBelow,
        lines: [],
        fontSize: 0,
        lineHeight: 0,
        fontKey: '',
        spaceAfter: 0,
        spaceBefore: 0,
      }
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
      // Placeholder: zero height. Will be replaced by actual TOC entries in two-pass mode.
      return {
        element,
        height: 0,
        lines: [],
        fontSize: 0,
        lineHeight: 0,
        fontKey: '',
        spaceAfter: element.spaceAfter ?? 0,
        spaceBefore: element.spaceBefore ?? 0,
      } satisfies MeasuredBlock
    }

    case 'footnote-def': {
      const fn = element as import('../types.js').FootnoteDefElement
      const fnBaseFontSize = doc.defaultFontSize ?? 12
      const fontSize = fn.fontSize ?? Math.max(8, fnBaseFontSize - 2)
      const lineHeight = fontSize * LINE_HEIGHT_BODY
      const fontFamily = fn.fontFamily ?? doc.defaultFont ?? 'Inter'
      const fontKey = buildFontKey(fontFamily, 400, 'normal')

      // Measure the def text with a 20pt left indent (for the number prefix space)
      const textLines = await measureText(
        fn.text,
        fontSize,
        fontFamily,
        400,
        contentWidth - 20,  // leave space for "N. " prefix
        lineHeight,
        undefined,
        wordWidthCache
      )

      const height = textLines.length * lineHeight

      return {
        element,
        height,
        lines: textLines,
        fontSize,
        lineHeight,
        fontKey,
        spaceAfter: fn.spaceAfter ?? 4,
        spaceBefore: 0,
      }
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
