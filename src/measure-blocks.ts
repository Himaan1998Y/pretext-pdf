/**
 * measure-blocks.ts — Per-element-type measurement functions
 * All the specific measurer functions for different content types.
 */

import type {
  ContentElement, ColumnDef, TableElement, PdfDocument
} from './types.js'
import type {
  MeasuredBlock, MeasuredTableData,
  MeasuredTableRow, MeasuredTableCell, MeasuredImageData, ListItemData,
  ImageMap, PretextLine, CalloutData
} from './types-internal.js'
import { PretextPdfError } from './errors.js'
import { measureRichText } from './rich-text.js'
import { buildFontKey } from './measure.js'
import { measureText, HyphenatorOpts, getPretext, detectAndReorderRTL } from './measure-text.js'
import { LINE_HEIGHT_BODY, LINE_HEIGHT_COMPACT } from './render-utils.js'

/** Heading level size multipliers and defaults */
const HEADING_DEFAULTS = {
  1: { sizeMultiplier: 2.0,  fontWeight: 700 as const, spaceAfter: 16, spaceBefore: 28 },
  2: { sizeMultiplier: 1.5,  fontWeight: 700 as const, spaceAfter: 12, spaceBefore: 24 },
  3: { sizeMultiplier: 1.25, fontWeight: 700 as const, spaceAfter: 8,  spaceBefore: 20 },
  4: { sizeMultiplier: 1.1,  fontWeight: 700 as const, spaceAfter: 6,  spaceBefore: 16 },
}

/**
 * Resolve preset callout style colors
 */
function resolveCalloutColors(style?: string): { bg: string; border: string } {
  switch (style) {
    case 'info':    return { bg: '#EFF6FF', border: '#3B82F6' }
    case 'warning': return { bg: '#FFFBEB', border: '#F59E0B' }
    case 'tip':     return { bg: '#F0FDF4', border: '#22C55E' }
    case 'note':    return { bg: '#F9FAFB', border: '#9CA3AF' }
    default:        return { bg: '#F8F9FA', border: '#0070F3' }
  }
}

export async function measureBlock(
  element: ContentElement,
  contentWidth: number,
  doc: PdfDocument,
  hyphenatorOpts?: HyphenatorOpts,
): Promise<MeasuredBlock | MeasuredBlock[]> {
  const baseFontSize = doc.defaultFontSize ?? 12
  const baseFont = doc.defaultFont ?? 'Inter'

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
        spaceAfter: (element as import('./types.js').CommentElement).spaceAfter ?? 0,
        spaceBefore: 0,
      }
    }

    case 'form-field': {
      const el = element as import('./types.js').FormFieldElement
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
      // Detect and reorder RTL text
      const { visual: visualText, isRTL, logical: logicalText } = await detectAndReorderRTL(element.text, element.dir)

      const fontSize = element.fontSize ?? doc.defaultParagraphStyle?.fontSize ?? baseFontSize
      // smallCaps renders at 80% of fontSize — measure at the same size to avoid
      // overestimating block height and wasting vertical space
      const effectiveFontSize = element.smallCaps === true ? fontSize * 0.8 : fontSize
      const lineHeight = element.lineHeight ?? doc.defaultParagraphStyle?.lineHeight ?? doc.defaultLineHeight ?? (effectiveFontSize * LINE_HEIGHT_BODY)
      const fontFamily = element.fontFamily ?? doc.defaultParagraphStyle?.fontFamily ?? baseFont
      const fontWeight = element.fontWeight ?? doc.defaultParagraphStyle?.fontWeight ?? 400
      const fontKey = buildFontKey(fontFamily, fontWeight, 'normal')

      const columns = element.columns ?? 1
      const columnGap = element.columnGap ?? 24
      let measureWidth = contentWidth
      let columnData: { columnCount: number; columnGap: number; columnWidth: number; linesPerColumn: number } | undefined

      // Multi-column layout
      let computedColumnWidth = contentWidth
      if (columns > 1) {
        if (columns > 6) {
          throw new PretextPdfError('VALIDATION_ERROR', `columns must be 1–6, got ${columns}`)
        }
        computedColumnWidth = (contentWidth - (columns - 1) * columnGap) / columns
        if (computedColumnWidth < 50) {
          throw new PretextPdfError('COLUMN_WIDTH_TOO_NARROW', `Column width would be ${computedColumnWidth.toFixed(1)}pt, which is below the minimum 50pt. Reduce columns, increase columnGap, or increase page width.`)
        }
        measureWidth = computedColumnWidth
      }

      const opts = hyphenatorOpts && element.hyphenate !== false ? hyphenatorOpts : undefined

      // Compensate for letterSpacing: render adds `spacing` pts after each character,
      // but pretext doesn't know about it. Reduce measureWidth so line-breaks happen
      // before the rendered text would overflow. Formula: scale by avgCharWidth /
      // (avgCharWidth + spacing), where avgCharWidth ≈ 0.5 * effectiveFontSize.
      const letterSpacingValue = element.letterSpacing ?? doc.defaultParagraphStyle?.letterSpacing ?? 0
      if (letterSpacingValue > 0) {
        const avgCharWidth = effectiveFontSize * 0.5
        measureWidth = Math.max(10, measureWidth * avgCharWidth / (avgCharWidth + letterSpacingValue))
      }

      // Measure post-reorder (visual-order) text because the renderer draws characters in
      // visual order; measuring the logical string for an RTL run would pick break points
      // that don't match what is actually drawn, producing wrong line widths.
      //
      // smallCaps uppercases at render time. Measure the same uppercase text so
      // line-break widths match what the renderer actually draws.
      const measureText_ = element.smallCaps === true ? visualText.toUpperCase() : visualText
      const lines = await measureText(measureText_, effectiveFontSize, fontFamily, fontWeight, measureWidth, lineHeight, opts)

      if (columns > 1) {
        const linesPerColumn = Math.max(1, Math.ceil(lines.length / columns))
        columnData = { columnCount: columns, columnGap, columnWidth: computedColumnWidth, linesPerColumn }
      }

      // Construct result with or without columnData depending on columns value
      const paraSpaceAfter = element.spaceAfter ?? doc.defaultParagraphStyle?.spaceAfter ?? 0
      const paraSpaceBefore = element.spaceBefore ?? doc.defaultParagraphStyle?.spaceBefore ?? 0
      if (columnData) {
        return {
          element,
          height: columnData.linesPerColumn * lineHeight,
          lines,
          fontSize,
          lineHeight,
          fontKey,
          spaceAfter: paraSpaceAfter,
          spaceBefore: paraSpaceBefore,
          columnData,
          isRTL,
          ...(isRTL && { logicalText }),  // NEW: Only store logical text when RTL
        }
      } else {
        return {
          element,
          height: lines.length * lineHeight,
          lines,
          fontSize,
          lineHeight,
          fontKey,
          spaceAfter: paraSpaceAfter,
          spaceBefore: paraSpaceBefore,
          isRTL,
          ...(isRTL && { logicalText }),  // NEW: Only store logical text when RTL
        }
      }
    }

    case 'heading': {
      // Detect and reorder RTL text
      const { visual: visualText, isRTL, logical: logicalText } = await detectAndReorderRTL(element.text, element.dir)

      const defaults = HEADING_DEFAULTS[element.level]
      const baseHeadingFontSize = doc.defaultParagraphStyle?.fontSize ?? baseFontSize
      const fontSize = element.fontSize ?? (baseHeadingFontSize * defaults.sizeMultiplier)
      // smallCaps renders at 80% — measure at effective size
      const effectiveFontSize = element.smallCaps === true ? fontSize * 0.8 : fontSize
      const lineHeight = element.lineHeight ?? doc.defaultParagraphStyle?.lineHeight ?? doc.defaultLineHeight ?? (effectiveFontSize * LINE_HEIGHT_COMPACT)
      const fontFamily = element.fontFamily ?? doc.defaultParagraphStyle?.fontFamily ?? baseFont
      const fontWeight = element.fontWeight ?? doc.defaultParagraphStyle?.fontWeight ?? defaults.fontWeight
      const fontKey = buildFontKey(fontFamily, fontWeight, 'normal')

      const opts = hyphenatorOpts && element.hyphenate !== false ? hyphenatorOpts : undefined

      // Compensate for letterSpacing (same logic as paragraph above)
      const headingLetterSpacing = element.letterSpacing ?? doc.defaultParagraphStyle?.letterSpacing ?? 0
      const headingMeasureWidth = headingLetterSpacing > 0
        ? Math.max(10, contentWidth * (effectiveFontSize * 0.5) / (effectiveFontSize * 0.5 + headingLetterSpacing))
        : contentWidth

      // Measure post-reorder (visual-order) text because the renderer draws characters in
      // visual order; measuring the logical string for an RTL run would pick break points
      // that don't match what is actually drawn, producing wrong line widths.
      //
      // smallCaps uppercases at render time. Measure the same uppercase text so
      // line-break widths match what the renderer actually draws.
      const headingMeasureText = element.smallCaps === true ? visualText.toUpperCase() : visualText
      const lines = await measureText(headingMeasureText, effectiveFontSize, fontFamily, fontWeight, headingMeasureWidth, lineHeight, opts)

      return {
        element,
        height: lines.length * lineHeight,
        lines,
        fontSize,
        lineHeight,
        fontKey,
        spaceAfter: element.spaceAfter ?? doc.defaultParagraphStyle?.spaceAfter ?? defaults.spaceAfter,
        spaceBefore: element.spaceBefore ?? doc.defaultParagraphStyle?.spaceBefore ?? defaults.spaceBefore,
        isRTL,
        ...(isRTL && { logicalText }),  // NEW: Only store logical text when RTL
      }
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

    case 'list': {
      return measureList(element, contentWidth, doc, baseFontSize, hyphenatorOpts)
    }

    case 'table': {
      return measureTable(element, contentWidth, doc, baseFontSize, hyphenatorOpts)
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
      const lines: PretextLine[] = richLines.map(rl => ({
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
      const fontSize = element.fontSize ?? Math.max(baseFontSize - 2, 8)
      const lineHeight = element.lineHeight ?? (fontSize * LINE_HEIGHT_COMPACT)
      const padding = element.padding ?? 8
      // Text area is narrower by padding on both sides
      const textWidth = contentWidth - 2 * padding

      // Code blocks: never hyphenate — breaks would corrupt source code meaning
      // Code blocks: always measure in logical (LTR) order — reordering breaks syntax
      const lines = await measureText(element.text, fontSize, element.fontFamily, 400, Math.max(textWidth, 1), lineHeight)

      // height = lines * lineHeight + padding top + padding bottom
      const height = (lines.length || 1) * lineHeight + 2 * padding

      // Syntax highlighting: tokenize if language is set
      let codeHighlightTokens: Array<Array<{ text: string; color: string }>> | undefined
      if (element.language) {
        codeHighlightTokens = await tokenizeCodeForHighlighting(
          element.text,
          element.language,
          element.color ?? '#24292f',
          lines.length,
          element.highlightTheme
        )
      }

      return {
        element,
        height,
        lines,
        fontSize,
        lineHeight,
        fontKey: buildFontKey(element.fontFamily, 400, 'normal'),
        spaceAfter: element.spaceAfter ?? 12,
        spaceBefore: element.spaceBefore ?? 12,
        codePadding: padding,
        ...(codeHighlightTokens ? { codeHighlightTokens } : {}),
        isRTL: false, // Code blocks always LTR
      }
    }

    case 'blockquote': {
      // Detect and reorder RTL text
      const { visual: visualText, isRTL, logical: logicalText } = await detectAndReorderRTL(element.text, element.dir)

      const fontSize = element.fontSize ?? baseFontSize
      const lineHeight = element.lineHeight ?? doc.defaultLineHeight ?? (fontSize * LINE_HEIGHT_BODY)
      const fontFamily = element.fontFamily ?? baseFont
      const fontWeight = element.fontWeight ?? 400
      const fontStyle = element.fontStyle ?? 'normal'
      const fontKey = buildFontKey(fontFamily, fontWeight, fontStyle)
      const borderWidth = element.borderWidth ?? 3
      const paddingH = element.paddingH ?? element.padding ?? 16
      const paddingV = element.paddingV ?? element.padding ?? 10

      // Text area excludes left border + horizontal padding on both sides
      const textWidth = contentWidth - borderWidth - 2 * paddingH

      // Measure post-reorder (visual-order) text because the renderer draws characters in
      // visual order; measuring the logical string for an RTL run would pick break points
      // that don't match what is actually drawn, producing wrong line widths.
      const lines = await measureText(visualText, fontSize, fontFamily, fontWeight, Math.max(textWidth, 1), lineHeight, hyphenatorOpts)

      // height = lines * lineHeight + padding top + padding bottom
      const height = (lines.length || 1) * lineHeight + 2 * paddingV

      return {
        element,
        height,
        lines,
        fontSize,
        lineHeight,
        fontKey,
        spaceAfter: element.spaceAfter ?? 12,
        spaceBefore: element.spaceBefore ?? 0,
        blockquotePaddingV: paddingV,
        blockquotePaddingH: paddingH,
        blockquoteBorderWidth: borderWidth,
        isRTL,
        ...(isRTL && { logicalText }),  // NEW: Only store logical text when RTL
      }
    }
    case 'callout': {
      const el = element as import('./types.js').CalloutElement
      const fs = el.fontSize ?? baseFontSize
      const lh = el.lineHeight ?? (fs * LINE_HEIGHT_BODY)
      const ph = el.paddingH ?? el.padding ?? 16
      const pv = el.paddingV ?? el.padding ?? 10
      const family = el.fontFamily ?? baseFont
      const colors = resolveCalloutColors(el.style)
      const borderColor = el.borderColor ?? colors.border
      const backgroundColor = el.backgroundColor ?? colors.bg
      const color = el.color ?? '#1F2937'
      const titleColor = el.titleColor ?? borderColor

      // Measure title height (one line assumed, bold)
      let titleHeight = 0
      if (el.title) {
        titleHeight = fs * LINE_HEIGHT_COMPACT + 4  // compact line height + 4pt separator
      }

      // Measure content text
      const innerWidth = contentWidth - ph * 2
      const lines = await measureText(el.content, fs, family, el.fontWeight ?? 400, Math.max(innerWidth, 1), lh, hyphenatorOpts)
      const contentTextHeight = lines.length * lh

      const totalHeight = pv + titleHeight + contentTextHeight + pv

      // Construct calloutData via a typed literal so TypeScript enforces the
      // full contract at the producer site (every field present, correct type).
      const calloutData: CalloutData = {
        titleHeight, paddingH: ph, paddingV: pv,
        borderColor, backgroundColor, titleColor, color,
        ...(el.title !== undefined ? { titleText: el.title } : {}),
      }

      return {
        element,
        height: totalHeight,
        lines,
        fontSize: fs,
        lineHeight: lh,
        fontKey: buildFontKey(family, el.fontWeight ?? 400, 'normal'),
        spaceAfter: el.spaceAfter ?? 12,
        spaceBefore: el.spaceBefore ?? 0,
        calloutData,
      }
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
      } satisfies import('./types-internal.js').MeasuredBlock
    }
    case 'toc-entry': {
      // Internal type - should never be measured directly by user input
      throw new PretextPdfError('VALIDATION_ERROR', 'toc-entry is an internal type and cannot be used in document content')
    }
    case 'footnote-def': {
      const fn = element as import('./types.js').FootnoteDefElement
      const baseFontSize = doc.defaultFontSize ?? 12
      const fontSize = fn.fontSize ?? Math.max(8, baseFontSize - 2)
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
        undefined
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

// ─── HR is trivial (handled inline above) ────────────────────────────────────

// ─── Image measurement ────────────────────────────────────────────────────────

/** Measure an image element with its known imageMap key */
export async function measureImageWithKey(
  element: import('./types.js').ImageElement,
  imageKey: string,
  imageMap: ImageMap,
  contentWidth: number,
  pageContentHeight: number
): Promise<MeasuredBlock> {
  const pdfImage = imageMap.get(imageKey)
  if (!pdfImage) {
    throw new PretextPdfError(
      'IMAGE_LOAD_FAILED',
      `Image "${imageKey}": not found in imageMap. This is an internal error — please report it.`
    )
  }

  // Natural dimensions (in original pixels — aspect ratio is what matters, not the pixel count)
  const naturalWidth = pdfImage.width
  const naturalHeight = pdfImage.height

  // Resolve render dimensions (in pt)
  let renderWidth: number
  let renderHeight: number

  if (element.width !== undefined && element.height !== undefined) {
    // Both provided: use as-is
    renderWidth = element.width
    renderHeight = element.height
  } else if (element.width !== undefined) {
    // Width only: scale height
    renderWidth = element.width
    renderHeight = renderWidth * (naturalHeight / naturalWidth)
  } else if (element.height !== undefined) {
    // Height only: scale width
    renderHeight = element.height
    renderWidth = renderHeight * (naturalWidth / naturalHeight)
  } else {
    // Neither: fit to content width
    renderWidth = contentWidth
    renderHeight = renderWidth * (naturalHeight / naturalWidth)
  }

  // Clamp to content width
  if (renderWidth > contentWidth) {
    const scale = contentWidth / renderWidth
    renderWidth = contentWidth
    renderHeight = renderHeight * scale
  }

  // Validate height doesn't exceed page
  if (renderHeight > pageContentHeight) {
    throw new PretextPdfError(
      'IMAGE_TOO_TALL',
      `Image "${imageKey}" would render at ${renderHeight.toFixed(1)}pt tall, which exceeds the page content area (${pageContentHeight.toFixed(1)}pt). ` +
      `Reduce 'height' or increase page size/reduce margins.`
    )
  }

  const imageData: MeasuredImageData = {
    imageKey,
    renderWidth,
    renderHeight,
    align: element.align ?? 'left',
  }

  return {
    element,
    height: renderHeight,
    lines: [],
    fontSize: 0,
    lineHeight: 0,
    fontKey: '',
    spaceAfter: element.spaceAfter ?? 0,
    spaceBefore: element.spaceBefore ?? 0,
    imageData,
  }
}

// ─── Float image block measurement ───────────────────────────────────────────

export async function measureFloatImageBlock(
  element: import('./types.js').ImageElement,
  imageKey: string,
  imageMap: ImageMap,
  contentWidth: number,
  pageContentHeight: number,
  doc: import('./types.js').PdfDocument,
): Promise<MeasuredBlock> {
  const floatWidth = element.floatWidth ?? (contentWidth * 0.35)
  const floatGap = element.floatGap ?? 12
  const textColWidth = contentWidth - floatWidth - floatGap

  if (textColWidth < 50) {
    throw new PretextPdfError('COLUMN_WIDTH_TOO_NARROW',
      `Float image: text column would be ${textColWidth.toFixed(1)}pt (minimum 50pt). ` +
      `Reduce floatWidth or increase page width.`)
  }

  // Measure the image at floatWidth using a synthetic element
  const syntheticEl: import('./types.js').ImageElement = {
    type: 'image',
    src: element.src,
    ...(element.format !== undefined ? { format: element.format } : {}),
    width: floatWidth,
    align: 'left',
    spaceAfter: 0,
    spaceBefore: 0,
  }
  const imageBlock = await measureImageWithKey(syntheticEl, imageKey, imageMap, floatWidth, pageContentHeight)
  const imageRenderWidth = imageBlock.imageData!.renderWidth
  const imageRenderHeight = imageBlock.imageData!.renderHeight

  // Measure the float text (plain or rich)
  const fontSize = element.floatFontSize ?? doc.defaultFontSize ?? 12
  const lineHeight = fontSize * LINE_HEIGHT_BODY
  const fontFamily = element.floatFontFamily ?? doc.defaultFont ?? 'Inter'
  const fontKey = buildFontKey(fontFamily, 400, 'normal')

  let textLines: import('./types-internal.js').PretextLine[] = []
  let richFloatLines: import('./types-internal.js').RichLine[] | undefined

  if (element.floatSpans) {
    richFloatLines = await measureRichText(element.floatSpans, fontSize, lineHeight, textColWidth, 'left', doc)
  } else {
    textLines = await measureText(
      element.floatText!,
      fontSize,
      fontFamily,
      400,
      textColWidth,
      lineHeight,
      undefined,
    )
  }

  // Column X positions
  const imageColX = element.float === 'left' ? 0 : textColWidth + floatGap
  const textColX = element.float === 'left' ? floatWidth + floatGap : 0

  const textHeight = richFloatLines
    ? richFloatLines.reduce((sum, l) => sum + l.lineHeight, 0)
    : textLines.length * lineHeight
  const compositeHeight = Math.max(imageRenderHeight, textHeight)

  return {
    element,
    height: compositeHeight,
    lines: [],
    fontSize: 0,
    lineHeight: 0,
    fontKey: '',
    spaceAfter: element.spaceAfter ?? 0,
    spaceBefore: element.spaceBefore ?? 0,
    floatData: {
      imageKey,
      imageRenderWidth,
      imageRenderHeight,
      imageColX,
      textColX,
      textColWidth,
      textLines,
      ...(richFloatLines ? { richFloatLines } : {}),
      textFontKey: fontKey,
      textFontSize: fontSize,
      textLineHeight: lineHeight,
      textColor: element.floatColor ?? '#000000',
    },
  }
}

// ─── Float group measurement (multi-paragraph float) ────────────────────────────

export async function measureFloatGroup(
  element: import('./types.js').FloatGroupElement,
  imageKey: string,
  imageMap: ImageMap,
  contentWidth: number,
  pageContentHeight: number,
  doc: PdfDocument,
  hyphenatorOpts?: HyphenatorOpts,
): Promise<MeasuredBlock> {
  const floatWidth = element.floatWidth ?? (contentWidth * 0.35)
  const floatGap = element.floatGap ?? 12
  const textColWidth = contentWidth - floatWidth - floatGap

  if (textColWidth < 50) {
    throw new PretextPdfError('COLUMN_WIDTH_TOO_NARROW',
      `Float group: text column would be ${textColWidth.toFixed(1)}pt (minimum 50pt). ` +
      `Reduce floatWidth or increase page width.`)
  }

  // Measure the image at floatWidth
  const syntheticImageEl: import('./types.js').ImageElement = {
    type: 'image',
    src: '',
    ...(element.image.height !== undefined ? { height: element.image.height } : {}),
    align: 'left',
    spaceAfter: 0,
    spaceBefore: 0,
  }
  const imageBlock = await measureImageWithKey(syntheticImageEl, imageKey, imageMap, floatWidth, pageContentHeight)
  const imageRenderWidth = imageBlock.imageData!.renderWidth
  const imageRenderHeight = imageBlock.imageData!.renderHeight

  // Measure each content element in the text column
  const baseFontSize = doc.defaultFontSize ?? 12
  const textItems: Array<{
    lines: PretextLine[]
    richLines?: import('./types-internal.js').RichLine[]
    fontSize: number
    lineHeight: number
    fontKey: string
    fontWeight: 400 | 700
    spaceAfter: number
    yOffsetFromTop: number
  }> = []
  let totalTextHeight = 0

  for (const contentEl of element.content) {
    const measuredEl = await measureBlock(contentEl, textColWidth, doc, hyphenatorOpts)

    // Handle arrays (lists return MeasuredBlock[])
    const blocks = Array.isArray(measuredEl) ? measuredEl : [measuredEl]

    for (const block of blocks) {
      const fontSize = block.fontSize || baseFontSize
      const lineHeight = block.lineHeight || (fontSize * LINE_HEIGHT_BODY)

      // Extract text from lines or rich-lines
      let lines: import('./types-internal.js').PretextLine[] = []
      if (block.richLines && block.richLines.length > 0) {
        // Rich paragraph: extract plain text from rich lines (plain-text fallback)
        lines = block.richLines.map(rl => ({
          text: rl.fragments.map(f => f.text).join(''),
          width: rl.totalWidth,
        }))
      } else {
        lines = block.lines
      }

      const yOffsetFromTop = totalTextHeight
      const item: typeof textItems[0] = {
        lines,
        fontSize: block.fontSize,
        lineHeight: block.lineHeight,
        fontKey: block.fontKey,
        fontWeight: 400,
        spaceAfter: block.spaceAfter,
        yOffsetFromTop,
      }
      if (block.richLines) {
        item.richLines = block.richLines
      }
      textItems.push(item)

      totalTextHeight += block.height + block.spaceAfter
    }
  }

  // Remove trailing spaceAfter (it's not needed at the end)
  if (textItems.length > 0) {
    totalTextHeight -= textItems[textItems.length - 1]!.spaceAfter
  }

  // Column X positions
  const imageColX = element.float === 'left' ? 0 : textColWidth + floatGap
  const textColX = element.float === 'left' ? floatWidth + floatGap : 0

  const compositeHeight = Math.max(imageRenderHeight, totalTextHeight)

  return {
    element,
    height: compositeHeight,
    lines: [],
    fontSize: 0,
    lineHeight: 0,
    fontKey: '',
    spaceAfter: element.spaceAfter ?? 12,
    spaceBefore: element.spaceBefore ?? 0,
    floatGroupData: {
      imageKey,
      imageRenderWidth,
      imageRenderHeight,
      imageColX,
      textColX,
      textColWidth,
      textItems,
      totalTextHeight,
    },
  }
}

// ─── List measurement (returns MeasuredBlock[]) ───────────────────────────────

async function measureList(
  element: import('./types.js').ListElement,
  contentWidth: number,
  doc: PdfDocument,
  baseFontSize: number,
  hyphenatorOpts?: HyphenatorOpts
): Promise<MeasuredBlock[]> {
  const baseFontFamily = doc.defaultFont ?? 'Inter'
  const fontSize = element.fontSize ?? baseFontSize
  const lineHeight = element.lineHeight ?? doc.defaultLineHeight ?? (fontSize * LINE_HEIGHT_BODY)
  const indent = element.indent ?? 20
  const itemSpaceAfter = element.itemSpaceAfter ?? 4
  const fontKey = buildFontKey(baseFontFamily, 400, 'normal')

  const blocks: MeasuredBlock[] = []

  // Flatten items and nested items (up to 2 levels deep)
  const nestedStyle = element.nestedNumberingStyle ?? 'continue'
  let orderedIndex = 1
  const allItems: Array<{ text: string; marker: string; depth: number; isFirstInList: boolean; fontWeight: 400 | 700 }> = []

  for (let i = 0; i < element.items.length; i++) {
    const item = element.items[i]!
    const isFirst = i === 0

    const marker = element.style === 'ordered'
      ? `${orderedIndex}.`
      : (element.marker ?? '•')
    orderedIndex++

    allItems.push({ text: item.text, marker, depth: 0, isFirstInList: isFirst, fontWeight: item.fontWeight ?? 400 })

    // Nested items (depth 1)
    if (item.items && item.items.length > 0) {
      // 'restart': nested ordered items count from 1, parent counter unaffected
      // 'continue': nested items share the parent counter (existing behavior)
      let nestedIndex = nestedStyle === 'restart' ? 1 : orderedIndex
      for (let ni = 0; ni < item.items.length; ni++) {
        const nested = item.items[ni]!
        const nestedMarker = element.style === 'ordered'
          ? `${nestedIndex}.`
          : '◦'  // hollow bullet for depth-1 unordered
        nestedIndex++
        if (nestedStyle === 'continue') orderedIndex++
        allItems.push({ text: nested.text, marker: nestedMarker, depth: 1, isFirstInList: false, fontWeight: nested.fontWeight ?? 400 })

        // Nested items (depth 2)
        if (nested.items && nested.items.length > 0) {
          let deepIndex = nestedStyle === 'restart' ? 1 : nestedIndex
          for (let di = 0; di < nested.items.length; di++) {
            const deep = nested.items[di]!
            const deepMarker = element.style === 'ordered'
              ? `${deepIndex}.`
              : '▪'  // small filled square for depth-2 unordered
            deepIndex++
            if (nestedStyle === 'continue') orderedIndex++
            allItems.push({ text: deep.text, marker: deepMarker, depth: 2, isFirstInList: false, fontWeight: deep.fontWeight ?? 400 })
          }
        }
      }
    }
  }

  // Compute markerWidth: use explicit override if set, otherwise measure widest marker
  let markerWidth: number
  if (element.markerWidth != null) {
    markerWidth = element.markerWidth
  } else {
    const widestMarker = element.style === 'ordered'
      ? `${allItems.length}.`
      : (element.marker ?? '•')
    const measured = await measureNaturalTextWidth(widestMarker, fontSize, baseFontFamily, 400)
    markerWidth = Math.max(16, measured + 6)
  }

  // Width available for item text (after indent + marker column)
  const textWidth = contentWidth - indent - markerWidth

  if (textWidth <= 0) {
    throw new PretextPdfError(
      'VALIDATION_ERROR',
      `List indent (${indent}pt) + markerWidth (${markerWidth}pt) exceeds contentWidth (${contentWidth}pt). Reduce indent or markerWidth.`
    )
  }

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i]!
    const isLast = i === allItems.length - 1
    const nestedIndent = indent + item.depth * markerWidth
    const nestedTextWidth = textWidth - item.depth * markerWidth

    const lines = await measureText(item.text, fontSize, baseFontFamily, item.fontWeight, nestedTextWidth, lineHeight, hyphenatorOpts)

    const listItemData: ListItemData = {
      marker: item.marker,
      indent: nestedIndent,
      markerWidth,
      color: element.color ?? '#000000',
      fontWeight: item.fontWeight,
    }

    // spaceBefore: only the first item in the entire list gets the list's spaceBefore
    // spaceAfter: itemSpaceAfter between items, list.spaceAfter on the last item
    const spaceBefore = item.isFirstInList ? (element.spaceBefore ?? 0) : 0
    const spaceAfter = isLast ? (element.spaceAfter ?? 0) : itemSpaceAfter

    blocks.push({
      element,        // All items share the parent ListElement (for type checking in renderer)
      height: Math.max(lines.length, 1) * lineHeight,
      lines,
      fontSize,
      lineHeight,
      fontKey,
      spaceAfter,
      spaceBefore,
      listItemData,
    })
  }

  return blocks
}

// ─── Table measurement ────────────────────────────────────────────────────────

type SpanEntry = { originRowIdx: number; originColStart: number; colspan: number; rowspan: number }

/** Build a map from "rowIdx,colIdx" → span origin info for all positions occupied by a rowspan cell from an earlier row. */
function buildSpanGrid(rows: import('./types.js').TableRow[]): Map<string, SpanEntry> {
  const grid = new Map<string, SpanEntry>()
  for (let ri = 0; ri < rows.length; ri++) {
    let ci = 0
    for (const cell of rows[ri]!.cells) {
      while (grid.has(`${ri},${ci}`)) ci++
      const cs = cell.colspan ?? 1
      const rs = cell.rowspan ?? 1
      for (let r2 = ri + 1; r2 < ri + rs; r2++) {
        for (let c2 = ci; c2 < ci + cs; c2++) {
          grid.set(`${r2},${c2}`, { originRowIdx: ri, originColStart: ci, colspan: cs, rowspan: rs })
        }
      }
      ci += cs
    }
  }
  return grid
}

async function measureTable(
  element: TableElement,
  contentWidth: number,
  doc: PdfDocument,
  baseFontSize: number,
  hyphenatorOpts?: HyphenatorOpts
): Promise<MeasuredBlock> {
  const baseFontFamily = doc.defaultFont ?? 'Inter'
  const fontSize = element.fontSize ?? baseFontSize
  const lineHeight = doc.defaultLineHeight ?? (fontSize * LINE_HEIGHT_BODY)
  const cellPaddingH = element.cellPaddingH ?? 8
  const cellPaddingV = element.cellPaddingV ?? 6
  const borderWidth = element.borderWidth ?? 0.5
  const borderColor = element.borderColor ?? '#cccccc'
  const headerBgColor = element.headerBgColor ?? '#f5f5f5'

  // Build span occupancy grid (needed for correct colStart tracking in all passes)
  const spanGrid = buildSpanGrid(element.rows)

  // Pre-pass: measure natural widths for 'auto' columns — run all in parallel
  const hasAutoColumns = element.columns.some(c => c.width === 'auto')
  let naturalWidths: number[] | undefined
  if (hasAutoColumns) {
    naturalWidths = new Array(element.columns.length).fill(0)
    // Collect all auto-column cells first (sequential index tracking, span-grid-aware)
    type AutoCellJob = { colIdx: number; cs: number; fontWeight: 400|700; cellFontSize: number; cellFamily: string; text: string }
    const jobs: AutoCellJob[] = []
    for (let rowIdx = 0; rowIdx < element.rows.length; rowIdx++) {
      const row = element.rows[rowIdx]!
      let colIdx = 0
      for (const cell of row.cells) {
        while (spanGrid.has(`${rowIdx},${colIdx}`)) colIdx++
        const cs = cell.colspan ?? 1
        if (element.columns[colIdx]?.width === 'auto') {
          jobs.push({
            colIdx, cs,
            fontWeight: (cell.fontWeight ?? (row.isHeader ? 700 : 400)) as 400|700,
            cellFontSize: cell.fontSize ?? fontSize,
            cellFamily: cell.fontFamily ?? baseFontFamily,
            text: cell.text,
          })
        }
        colIdx += cs
      }
    }
    // Measure all auto cells in parallel
    const widths = await Promise.all(
      jobs.map(j => measureNaturalTextWidth(j.text, j.cellFontSize, j.cellFamily, j.fontWeight))
    )
    // Assign results back
    for (let i = 0; i < jobs.length; i++) {
      const { colIdx, cs } = jobs[i]!
      const cellNaturalWidth = widths[i]! + 2 * cellPaddingH
      const perColumn = cellNaturalWidth / cs
      for (let si = colIdx; si < colIdx + cs && si < element.columns.length; si++) {
        if (element.columns[si]?.width === 'auto') {
          naturalWidths[si] = Math.max(naturalWidths[si]!, perColumn)
        }
      }
    }
  }

  // Resolve column widths (passes naturalWidths for 'auto' columns)
  const columnWidths = resolveColumnWidths(element.columns, contentWidth, cellPaddingH, borderWidth, naturalWidths)

  // Determine header row count
  const headerRowCount = element.headerRows !== undefined
    ? element.headerRows
    : element.rows.filter(r => r.isHeader).length

  // Measure all rows — parallelize all cell async work across the entire table at once
  // Step 1: Compute all synchronous cell metadata (span-grid-aware colStart tracking)
  type CellMeta = {
    cell: import('./types.js').TableCell
    row: import('./types.js').TableRow
    rowIdx: number
    colStart: number
    cs: number
    rs: number
    col: import('./types.js').ColumnDef
    mergedWidth: number
    fontWeight: 400 | 700
    fontFamily: string
    cellFontSize: number
    cellLineHeight: number
    cellFontKey: string
    textWidth: number
    cellDir: 'ltr' | 'rtl' | 'auto'
  }
  const allCellMeta: CellMeta[] = []
  for (let rowIdx = 0; rowIdx < element.rows.length; rowIdx++) {
    const row = element.rows[rowIdx]!
    let colStart = 0
    for (const cell of row.cells) {
      while (spanGrid.has(`${rowIdx},${colStart}`)) colStart++
      const cs = cell.colspan ?? 1
      const rs = cell.rowspan ?? 1
      const col = element.columns[colStart]!
      let mergedWidth = 0
      for (let si = colStart; si < colStart + cs && si < columnWidths.length; si++) {
        mergedWidth += columnWidths[si]!
        if (si < colStart + cs - 1) mergedWidth += borderWidth
      }
      const fontWeight = (cell.fontWeight ?? (row.isHeader ? 700 : 400)) as 400 | 700
      const fontFamily = cell.fontFamily ?? baseFontFamily
      const cellFontSize = cell.fontSize ?? fontSize
      const cellLineHeight = doc.defaultLineHeight ?? (cellFontSize * LINE_HEIGHT_BODY)
      const cellFontKey = buildFontKey(fontFamily, fontWeight, 'normal')
      const textWidth = mergedWidth - 2 * cellPaddingH - borderWidth
      const cellDir = (cell.dir ?? element.dir ?? 'auto') as 'ltr' | 'rtl' | 'auto'
      allCellMeta.push({ cell, row, rowIdx, colStart, cs, rs, col, mergedWidth, fontWeight, fontFamily, cellFontSize, cellLineHeight, cellFontKey, textWidth, cellDir })
      colStart += cs
    }
  }

  // Step 2: Run all RTL detection + text measurement in parallel across the whole table
  const cellResults = await Promise.all(
    allCellMeta.map(async (m) => {
      const { visual: cellVisualText, isRTL: cellIsRTL } = await detectAndReorderRTL(m.cell.text, m.cellDir)
      const lines = await measureText(cellVisualText, m.cellFontSize, m.fontFamily, m.fontWeight, Math.max(m.textWidth, 1), m.cellLineHeight, hyphenatorOpts)
      return { cellVisualText, cellIsRTL, lines }
    })
  )

  // Step 3: Reassemble into measuredRows with rowspan support
  // Build lookup: (rowIdx, colStart) → (meta, result)
  type CellAtCol = { meta: CellMeta; result: { cellIsRTL: boolean; lines: import('./types-internal.js').PretextLine[] } }
  const cellByKey = new Map<string, CellAtCol>()
  for (let i = 0; i < allCellMeta.length; i++) {
    const m = allCellMeta[i]!
    cellByKey.set(`${m.rowIdx},${m.colStart}`, { meta: m, result: cellResults[i]! })
  }

  // Sub-pass 3a: Compute raw row heights from non-spanning cells only
  const rowHeights: number[] = new Array(element.rows.length).fill(0)
  for (const { meta: m, result } of cellByKey.values()) {
    if (m.rs === 1) {
      const cellContentHeight = Math.max(result.lines.length, 1) * m.cellLineHeight
      rowHeights[m.rowIdx] = Math.max(rowHeights[m.rowIdx]!, cellContentHeight)
    }
  }
  for (let ri = 0; ri < rowHeights.length; ri++) {
    rowHeights[ri] = (rowHeights[ri] ?? 0) + 2 * cellPaddingV
  }

  // Sub-pass 3b: Expand last spanned row if spanning cell needs more space
  for (const { meta: m, result } of cellByKey.values()) {
    if (m.rs > 1) {
      const cellContentHeight = Math.max(result.lines.length, 1) * m.cellLineHeight + 2 * cellPaddingV
      let spanHeight = 0
      for (let r2 = m.rowIdx; r2 < m.rowIdx + m.rs && r2 < rowHeights.length; r2++) {
        spanHeight += rowHeights[r2]!
      }
      if (cellContentHeight > spanHeight) {
        const lastRowIdx = Math.min(m.rowIdx + m.rs - 1, rowHeights.length - 1)
        rowHeights[lastRowIdx]! += cellContentHeight - spanHeight
      }
    }
  }

  // Sub-pass 3c: Build measuredRows, inserting placeholder cells for rowspan continuations
  const measuredRows: MeasuredTableRow[] = []
  const numColumns = element.columns.length

  for (let rowIdx = 0; rowIdx < element.rows.length; rowIdx++) {
    const row = element.rows[rowIdx]!
    const rowHeight = rowHeights[rowIdx]!
    const measuredCells: MeasuredTableCell[] = []
    let hasRowspan = false

    let colCursor = 0
    while (colCursor < numColumns) {
      const spanEntry = spanGrid.get(`${rowIdx},${colCursor}`)
      if (spanEntry) {
        // Only insert ONE placeholder per span group (at the leftmost column of the span)
        if (colCursor === spanEntry.originColStart) {
          const originCell = cellByKey.get(`${spanEntry.originRowIdx},${spanEntry.originColStart}`)
          const pw = originCell?.meta.mergedWidth ?? (columnWidths[colCursor] ?? 0)
          measuredCells.push({
            lines: [], fontSize: 0, lineHeight: 0, fontKey: '', fontFamily: '',
            align: 'left', color: '#000000',
            colspan: spanEntry.colspan, mergedWidth: pw,
            isSpanPlaceholder: true,
          })
          colCursor += spanEntry.colspan
        } else {
          // Mid-span column not at origin — advance past the full span group
          colCursor += spanEntry.colspan
        }
      } else {
        const cellAtCol = cellByKey.get(`${rowIdx},${colCursor}`)
        if (!cellAtCol) { colCursor++; continue }
        const { meta: m, result: { cellIsRTL, lines } } = cellAtCol

        let spanHeight: number | undefined
        if (m.rs > 1) {
          spanHeight = 0
          for (let r2 = rowIdx; r2 < rowIdx + m.rs && r2 < rowHeights.length; r2++) {
            spanHeight += rowHeights[r2]!
          }
          hasRowspan = true
        }

        const align = m.cell.align ?? m.col.align ?? (cellIsRTL ? 'right' : 'left')
        const measuredCell: MeasuredTableCell = {
          lines,
          fontSize: m.cellFontSize,
          lineHeight: m.cellLineHeight,
          fontKey: m.cellFontKey,
          fontFamily: m.fontFamily,
          align,
          color: m.cell.color ?? '#000000',
          colspan: m.cs,
          mergedWidth: m.mergedWidth,
          isRTL: cellIsRTL,
          ...(m.cell.tabularNumbers !== undefined && { tabularNumbers: m.cell.tabularNumbers }),
          ...(m.rs > 1 ? { rowspan: m.rs } : {}),
          ...(spanHeight !== undefined ? { spanHeight } : {}),
        }
        if (m.cell.bgColor !== undefined) measuredCell.bgColor = m.cell.bgColor
        measuredCells.push(measuredCell)
        colCursor += m.cs
      }
    }

    const activeBoundaries = computeActiveBoundaries(measuredCells, numColumns)
    measuredRows.push({
      cells: measuredCells,
      height: rowHeight,
      isHeader: row.isHeader ?? false,
      activeBoundaries,
      ...(hasRowspan ? { hasRowspan: true } : {}),
    })
  }

  // Header rows are the first N rows
  const headerRows = measuredRows.slice(0, headerRowCount)
  const headerRowHeight = headerRows.reduce((sum, r) => sum + r.height, 0)

  // Total table height = sum of all row heights
  const totalHeight = measuredRows.reduce((sum, r) => sum + r.height, 0)

  const tableData: MeasuredTableData = {
    columnWidths,
    rows: measuredRows,
    headerRowCount,
    headerRowHeight,
    cellPaddingH,
    cellPaddingV,
    borderWidth,
    borderColor,
    headerBgColor,
  }

  return {
    element,
    height: totalHeight,
    lines: [],
    fontSize: 0,
    lineHeight: 0,
    fontKey: '',
    spaceAfter: element.spaceAfter ?? 0,
    spaceBefore: element.spaceBefore ?? 0,
    tableData,
  }
}

// ─── Column width resolution ──────────────────────────────────────────────────

/**
 * Resolve column width definitions to concrete pt values.
 * Fixed widths are used as-is. Star widths ('2*', '*') share the remaining space.
 * 'auto' columns use naturalWidths[i] (measured content width) — caller must pre-compute these.
 *
 * naturalWidths is required if any column uses 'auto'. It maps column index → natural text width in pt
 * (the minimum width needed to display cell text on one line, including cellPaddingH on both sides).
 */
export function resolveColumnWidths(
  columns: ColumnDef[],
  contentWidth: number,
  cellPaddingH: number,
  borderWidth: number,
  naturalWidths?: number[]
): number[] {
  const MIN_COLUMN_WIDTH = cellPaddingH * 2 + borderWidth * 2 + 4 // minimum usable pt

  let totalFixed = 0
  let totalStars = 0
  let totalAutoNatural = 0
  let autoCount = 0

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]!
    if (typeof col.width === 'number') {
      totalFixed += col.width
    } else if (col.width === 'auto') {
      // Auto columns reserve their natural width from remaining space
      const natural = naturalWidths?.[i] ?? MIN_COLUMN_WIDTH
      totalAutoNatural += natural
      autoCount++
    } else {
      // '*' → 1 star, '2*' → 2 stars, '1.5*' → 1.5 stars
      const match = col.width.match(/^(\d*\.?\d*)?\*$/)
      const stars = (match && match[1]) ? parseFloat(match[1]) : 1
      totalStars += stars
    }
  }

  const remaining = contentWidth - totalFixed

  if (remaining < -0.01) {
    throw new PretextPdfError(
      'TABLE_COLUMN_OVERFLOW',
      `Table fixed column widths (${totalFixed.toFixed(1)}pt) exceed content width (${contentWidth.toFixed(1)}pt). ` +
      `Reduce column widths or page margins.`
    )
  }

  // How much space is available after fixed columns
  const availableForFlexible = Math.max(0, remaining)

  // Auto columns claim their natural width (capped at available space).
  // Star columns share whatever remains after auto columns.
  // If auto columns overflow, they get proportional shares of available space.
  const autoFits = totalAutoNatural <= availableForFlexible
  const autoUsed = autoFits ? totalAutoNatural : availableForFlexible
  const availableForStars = availableForFlexible - autoUsed
  const starUnit = totalStars > 0 ? Math.max(0, availableForStars) / totalStars : 0

  return columns.map((col, i) => {
    let resolved: number
    if (typeof col.width === 'number') {
      resolved = col.width
    } else if (col.width === 'auto') {
      const natural = naturalWidths?.[i] ?? MIN_COLUMN_WIDTH
      if (autoFits) {
        resolved = natural
      } else {
        // Constrained: proportional share based on natural widths
        resolved = totalAutoNatural > 0
          ? (natural / totalAutoNatural) * availableForFlexible
          : MIN_COLUMN_WIDTH
      }
    } else {
      const match = col.width.match(/^(\d*\.?\d*)?\*$/)
      const stars = (match && match[1]) ? parseFloat(match[1]) : 1
      resolved = stars * starUnit
    }

    if (resolved < MIN_COLUMN_WIDTH) {
      throw new PretextPdfError(
        'TABLE_COLUMN_TOO_NARROW',
        `Table column ${i} resolved to ${resolved.toFixed(1)}pt, minimum is ${MIN_COLUMN_WIDTH.toFixed(1)}pt. ` +
        `Increase the column width or reduce cellPaddingH/borderWidth.`
      )
    }

    return resolved
  })
}

/**
 * Compute which column boundaries have visible vertical lines.
 * A boundary is "active" (visible) if it's not spanned by any merged cell.
 * Returns array of boundary indices (0 = between col 0 and 1, 1 = between col 1 and 2, etc.)
 * where vertical lines should be drawn.
 *
 * Example: 3 columns with a cell spanning cols 0-1 → active boundaries are [1] (only between cols 1-2)
 */
function computeActiveBoundaries(cells: Array<{ colspan?: number }>, colCount: number): number[] {
  // Track which boundaries are "spanned" (internal to a merged cell)
  const spannedBoundaries = new Set<number>()
  let colIdx = 0

  for (const cell of cells) {
    const cs = cell.colspan ?? 1
    // Boundaries internal to this cell's span are: colIdx to colIdx + cs - 1
    // The internal boundaries are colIdx, colIdx+1, ..., colIdx+cs-2
    for (let b = colIdx; b < colIdx + cs - 1; b++) {
      spannedBoundaries.add(b)
    }
    colIdx += cs
  }

  // Active boundaries are all boundaries (0 to colCount-2) that are NOT spanned
  const activeBoundaries: number[] = []
  for (let b = 0; b < colCount - 1; b++) {
    if (!spannedBoundaries.has(b)) {
      activeBoundaries.push(b)
    }
  }

  return activeBoundaries
}

/**
 * Measure the natural (unwrapped) width of text in pt.
 * Uses a very large maxWidth so Pretext never wraps — returns the actual line width.
 */
async function measureNaturalTextWidth(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: 400 | 700
): Promise<number> {
  if (!text || text.trim() === '') return 0

  const { prepareWithSegments, layoutWithLines } = await getPretext()

  const weightPrefix = fontWeight === 700 ? 'bold ' : ''
  const fontString = `${weightPrefix}${fontSize}px ${fontFamily}`

  // Use a very large width to prevent wrapping; also handle multi-line text (\n)
  // by taking the max line width across all lines
  const prepared = prepareWithSegments(text, fontString, { whiteSpace: 'pre-wrap' })
  const result = layoutWithLines(prepared, 99999, fontSize * LINE_HEIGHT_BODY)
  const lines: Array<{ text: string; width: number }> = result.lines ?? []

  return lines.reduce((max, line) => Math.max(max, line.width), 0)
}

// ─── Syntax highlighting ──────────────────────────────────────────────────────

/** Default GitHub-light-inspired highlight theme colors */
const DEFAULT_HIGHLIGHT_THEME: Record<string, string> = {
  keyword:  '#cf222e',
  string:   '#0a3069',
  comment:  '#6e7781',
  number:   '#0550ae',
  function: '#8250df',
  title:    '#8250df',
  built_in: '#0550ae',
  literal:  '#0550ae',
  type:     '#953800',
  meta:     '#cf222e',
  attr:     '#0550ae',
  name:     '#0550ae',
  params:   '#24292f',
  punctuation: '#24292f',
  operator: '#24292f',
  regexp:   '#0a3069',
  variable: '#953800',
  property: '#0550ae',
  tag:      '#116329',
  selector: '#116329',
  subst:    '#24292f',
  'template-tag':    '#cf222e',
  'template-string': '#0a3069',
  symbol:   '#0550ae',
  addition: '#116329',
  deletion: '#cf222e',
  section:  '#0550ae',
}

/** Cached highlight.js module (loaded once, reused across code blocks) */
let _hljsCache: any = null
let _hljsLoadAttempted = false

/**
 * Tokenize source code into per-line colored spans using highlight.js.
 * Returns undefined if highlight.js is not installed (renderer falls back to plain text).
 */
async function tokenizeCodeForHighlighting(
  text: string,
  language: string,
  defaultColor: string,
  measuredLineCount: number,
  customTheme?: Record<string, string | undefined>
): Promise<Array<Array<{ text: string; color: string }>> | undefined> {
  if (!_hljsLoadAttempted) {
    _hljsLoadAttempted = true
    try {
      const mod = await import('highlight.js' as string)
      _hljsCache = mod.default ?? mod
    } catch { /* not installed */ }
  }
  if (!_hljsCache) return undefined
  const hljs = _hljsCache

  const theme: Record<string, string> = { ...DEFAULT_HIGHLIGHT_THEME }
  if (customTheme) {
    for (const [k, v] of Object.entries(customTheme)) {
      if (v !== undefined) theme[k] = v
    }
  }

  let highlighted: string
  try {
    const result = language === 'auto'
      ? hljs.highlightAuto(text)
      : hljs.highlight(text, { language })
    highlighted = result.value
  } catch {
    return undefined
  }

  const tokens = parseHighlightHtml(highlighted, defaultColor, theme)

  // Safety check: tokenizer splits on \n but the layout engine may wrap long lines.
  // If line counts don't match, the colors would be applied to the wrong lines.
  if (tokens.length !== measuredLineCount) return undefined

  return tokens
}

/**
 * Parse highlight.js HTML into per-line token arrays.
 * Handles nested spans (e.g. string interpolation) by tracking a color stack.
 */
function parseHighlightHtml(
  html: string,
  defaultColor: string,
  theme: Record<string, string>
): Array<Array<{ text: string; color: string }>> {
  const lines: Array<Array<{ text: string; color: string }>> = [[]]
  const colorStack: string[] = [defaultColor]

  let i = 0
  while (i < html.length) {
    if (html[i] === '<') {
      const closeTag = html.indexOf('>', i)
      if (closeTag === -1) break
      const tag = html.slice(i, closeTag + 1)

      if (tag.startsWith('<span')) {
        // Extract class: <span class="hljs-keyword"> or <span class="hljs-template-string">
        const classMatch = tag.match(/class="hljs-([\w-]+)"/)
        const cls = classMatch ? classMatch[1]! : ''
        colorStack.push(theme[cls] ?? defaultColor)
      } else if (tag === '</span>') {
        if (colorStack.length > 1) colorStack.pop()
      }
      i = closeTag + 1
    } else if (html[i] === '&') {
      // HTML entities: named (&amp;), hex (&#x3D;), decimal (&#96;)
      const semi = html.indexOf(';', i)
      if (semi !== -1 && semi - i < 10) {
        const entity = html.slice(i, semi + 1)
        let ch: string
        if (entity === '&amp;') ch = '&'
        else if (entity === '&lt;') ch = '<'
        else if (entity === '&gt;') ch = '>'
        else if (entity === '&quot;') ch = '"'
        else if (entity === '&#x27;' || entity === '&apos;') ch = "'"
        else if (entity.startsWith('&#x')) ch = String.fromCodePoint(parseInt(entity.slice(3, -1), 16))
        else if (entity.startsWith('&#')) ch = String.fromCodePoint(parseInt(entity.slice(2, -1), 10))
        else ch = entity // unknown named entity — keep as-is
        lines[lines.length - 1]!.push({ text: ch, color: colorStack[colorStack.length - 1]! })
        i = semi + 1
      } else {
        lines[lines.length - 1]!.push({ text: '&', color: colorStack[colorStack.length - 1]! })
        i++
      }
    } else if (html[i] === '\n') {
      lines.push([])
      i++
    } else {
      // Regular text — accumulate consecutive chars with same color
      const color = colorStack[colorStack.length - 1]!
      let end = i + 1
      while (end < html.length && html[end] !== '<' && html[end] !== '&' && html[end] !== '\n') end++
      lines[lines.length - 1]!.push({ text: html.slice(i, end), color })
      i = end
    }
  }

  // Merge adjacent tokens with the same color on each line (fewer drawText calls)
  for (const line of lines) {
    for (let j = line.length - 1; j > 0; j--) {
      if (line[j]!.color === line[j - 1]!.color) {
        line[j - 1]!.text += line[j]!.text
        line.splice(j, 1)
      }
    }
  }

  return lines
}

// ─── Text measurement (shared by all text-bearing elements) ──────────────────

/**
 * Measure text with automatic word hyphenation (Liang's algorithm via hypher).
 * Splits on \n to preserve paragraph breaks; tokenizes words; greedily packs with hyphenation fallback.
 */
