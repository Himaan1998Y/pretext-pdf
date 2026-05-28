/**
 * measure-blocks/simple-blocks.ts — Measurement helpers for element types
 * whose measurement is pure metadata (no logic the dispatcher needs to
 * coordinate): spacer, page-break, comment, form-field, hr, toc, footnote-def.
 *
 * Extracted from measure-blocks/index.ts to keep the dispatcher focused on
 * routing. Behavior is identical — only the location changed.
 */

import type {
  ContentElement, PdfDocument, SpacerElement, PageBreakElement,
  CommentElement, FormFieldElement, HorizontalRuleElement, TocElement,
  FootnoteDefElement,
} from '../types.js'
import type { MeasuredBlock } from '../types-internal.js'
import { buildFontKey } from '../font-key.js'
import { measureText } from '../measure-text.js'
import { LINE_HEIGHT_BODY } from '../render-utils.js'

export function measureSpacer(element: SpacerElement): MeasuredBlock {
  return {
    element: element as ContentElement,
    height: element.height,
    lines: [],
    fontSize: 0,
    lineHeight: 0,
    fontKey: '',
    spaceAfter: 0,
    spaceBefore: 0,
  }
}

export function measurePageBreak(element: PageBreakElement): MeasuredBlock {
  return {
    element: element as ContentElement,
    height: 0,
    lines: [],
    fontSize: 0,
    lineHeight: 0,
    fontKey: '',
    spaceAfter: 0,
    spaceBefore: 0,
  }
}

export function measureComment(element: CommentElement): MeasuredBlock {
  return {
    element: element as ContentElement,
    height: 20,
    lines: [],
    fontSize: 0,
    lineHeight: 0,
    fontKey: '',
    spaceAfter: element.spaceAfter ?? 0,
    spaceBefore: 0,
  }
}

export function measureFormField(
  element: FormFieldElement,
  baseFontSize: number,
  baseFont: string,
): MeasuredBlock {
  const fs = element.fontSize ?? baseFontSize
  const labelHeight = element.label ? fs * LINE_HEIGHT_BODY + 4 : 0
  let fieldHeight = element.height
  if (!fieldHeight) {
    if (element.fieldType === 'text' && element.multiline) fieldHeight = 60
    else if (element.fieldType === 'radio') fieldHeight = 20 * Math.max(1, element.options?.length ?? 1)
    else fieldHeight = 24
  }
  return {
    element: element as ContentElement,
    height: labelHeight + fieldHeight + (element.spaceAfter ?? 8),
    lines: [],
    fontSize: fs,
    lineHeight: fieldHeight,
    fontKey: buildFontKey(baseFont, 400, 'normal'),
    spaceAfter: element.spaceAfter ?? 8,
    spaceBefore: element.spaceBefore ?? 0,
    formFieldData: { labelHeight, fieldHeight },
  }
}

export function measureHr(element: HorizontalRuleElement): MeasuredBlock {
  const spaceBefore = element.spaceBefore ?? 12
  const thickness = element.thickness ?? 0.5
  const spaceAfter = element.spaceAfter ?? 12
  return {
    element: element as ContentElement,
    height: spaceBefore + thickness + spaceAfter,
    lines: [],
    fontSize: 0,
    lineHeight: 0,
    fontKey: '',
    spaceAfter: 0,
    spaceBefore: 0,
  }
}

export function measureToc(element: TocElement): MeasuredBlock {
  // Placeholder: zero height. Will be replaced by actual TOC entries in two-pass mode.
  return {
    element: element as ContentElement,
    height: 0,
    lines: [],
    fontSize: 0,
    lineHeight: 0,
    fontKey: '',
    spaceAfter: element.spaceAfter ?? 0,
    spaceBefore: element.spaceBefore ?? 0,
  } satisfies MeasuredBlock
}

export async function measureFootnoteDef(
  element: FootnoteDefElement,
  contentWidth: number,
  doc: PdfDocument,
  wordWidthCache?: Map<string, number>,
): Promise<MeasuredBlock> {
  const fnBaseFontSize = doc.defaultFontSize ?? 12
  const fontSize = element.fontSize ?? Math.max(8, fnBaseFontSize - 2)
  const lineHeight = fontSize * LINE_HEIGHT_BODY
  const fontFamily = element.fontFamily ?? doc.defaultFont ?? 'Inter'
  const fontKey = buildFontKey(fontFamily, 400, 'normal')

  // Measure the def text with a 20pt left indent (for the number prefix space)
  const textLines = await measureText(
    element.text,
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
    element: element as ContentElement,
    height,
    lines: textLines,
    fontSize,
    lineHeight,
    fontKey,
    spaceAfter: element.spaceAfter ?? 4,
    spaceBefore: 0,
  }
}
