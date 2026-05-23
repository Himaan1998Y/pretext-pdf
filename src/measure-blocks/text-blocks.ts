/**
 * measure-blocks/text-blocks.ts — Measurement helpers for text-bearing element
 * types: paragraph, heading, blockquote, callout, code.
 *
 * Each helper is extracted from the original switch-statement body in
 * measureBlock(). Behavior is identical — only the location changed.
 */

import type { PdfDocument } from '../types.js'
import type {
  ParagraphElement, HeadingElement, BlockquoteElement,
  CalloutElement, CodeBlockElement,
} from '../types.js'
import type { MeasuredBlock, CalloutData } from '../types-internal.js'
import { PretextPdfError } from '../errors.js'
import { buildFontKey } from '../measure.js'
import { measureText, HyphenatorOpts, detectAndReorderRTL } from '../measure-text.js'
import { LINE_HEIGHT_BODY, LINE_HEIGHT_COMPACT } from '../render-utils.js'
import { HEADING_DEFAULTS, resolveCalloutColors } from './helpers.js'
import { tokenizeCodeForHighlighting } from './highlight.js'

export async function measureParagraph(
  element: ParagraphElement,
  contentWidth: number,
  doc: PdfDocument,
  baseFontSize: number,
  baseFont: string,
  hyphenatorOpts?: HyphenatorOpts,
  wordWidthCache?: Map<string, number>,
): Promise<MeasuredBlock> {
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
  const lines = await measureText(measureText_, effectiveFontSize, fontFamily, fontWeight, measureWidth, lineHeight, opts, wordWidthCache)

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

export async function measureHeading(
  element: HeadingElement,
  contentWidth: number,
  doc: PdfDocument,
  baseFontSize: number,
  baseFont: string,
  hyphenatorOpts?: HyphenatorOpts,
  wordWidthCache?: Map<string, number>,
): Promise<MeasuredBlock> {
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
  const lines = await measureText(headingMeasureText, effectiveFontSize, fontFamily, fontWeight, headingMeasureWidth, lineHeight, opts, wordWidthCache)

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

export async function measureBlockquote(
  element: BlockquoteElement,
  contentWidth: number,
  doc: PdfDocument,
  baseFontSize: number,
  baseFont: string,
  hyphenatorOpts?: HyphenatorOpts,
  wordWidthCache?: Map<string, number>,
): Promise<MeasuredBlock> {
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
  const lines = await measureText(visualText, fontSize, fontFamily, fontWeight, Math.max(textWidth, 1), lineHeight, hyphenatorOpts, wordWidthCache)

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

export async function measureCallout(
  element: CalloutElement,
  contentWidth: number,
  _doc: PdfDocument,
  baseFontSize: number,
  baseFont: string,
  hyphenatorOpts?: HyphenatorOpts,
  wordWidthCache?: Map<string, number>,
): Promise<MeasuredBlock> {
  const el = element
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
  const lines = await measureText(el.content, fs, family, el.fontWeight ?? 400, Math.max(innerWidth, 1), lh, hyphenatorOpts, wordWidthCache)
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

export async function measureCode(
  element: CodeBlockElement,
  contentWidth: number,
  _doc: PdfDocument,
  baseFontSize: number,
  wordWidthCache?: Map<string, number>,
): Promise<MeasuredBlock> {
  const fontSize = element.fontSize ?? Math.max(baseFontSize - 2, 8)
  const lineHeight = element.lineHeight ?? (fontSize * LINE_HEIGHT_COMPACT)
  const padding = element.padding ?? 8
  // Text area is narrower by padding on both sides
  const textWidth = contentWidth - 2 * padding

  // Code blocks: never hyphenate — breaks would corrupt source code meaning
  // Code blocks: always measure in logical (LTR) order — reordering breaks syntax
  const lines = await measureText(element.text, fontSize, element.fontFamily, 400, Math.max(textWidth, 1), lineHeight, undefined, wordWidthCache)

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
