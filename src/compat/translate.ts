/** Node-level translation: pdfmake nodes → pretext-pdf ContentElement[] */

import type {
  ContentElement,
  ParagraphElement,
  RichParagraphElement,
  HeadingElement,
  ListElement,
  PageBreakElement,
  ImageElement,
  QrCodeElement,
  InlineSpan,
} from '../types.js'
import { type PdfmakeNode, type PdfmakeObjectNode, type PdfmakeStyle, type TranslateCtx } from './pdfmake-types.js'
import { translateTable, pdfmakeAlignToPretext, normalizeStyleNames, mergeStyles, extractFlatText } from './normalize.js'

export function translateNode(node: PdfmakeNode, ctx: TranslateCtx): ContentElement[] {
  if (typeof node === 'string') {
    return [{ type: 'paragraph', text: node }]
  }
  if (!node || typeof node !== 'object') return []

  if (node.stack) {
    const out: ContentElement[] = []
    for (const child of node.stack) {
      for (const el of translateNode(child, ctx)) out.push(el)
    }
    return out
  }

  if (node.pageBreak === 'before') {
    const inner = translateNodeInner(node, ctx)
    return [{ type: 'page-break' } satisfies PageBreakElement, ...inner]
  }
  if (node.pageBreak === 'after') {
    const inner = translateNodeInner(node, ctx)
    return [...inner, { type: 'page-break' } satisfies PageBreakElement]
  }

  return translateNodeInner(node, ctx)
}

export function translateNodeInner(node: PdfmakeObjectNode, ctx: TranslateCtx): ContentElement[] {
  if (node.ul) {
    return [{
      type: 'list',
      style: 'unordered',
      items: node.ul.map(item => pdfmakeNodeToListItem(item, ctx)),
    } satisfies ListElement]
  }
  if (node.ol) {
    return [{
      type: 'list',
      style: 'ordered',
      items: node.ol.map(item => pdfmakeNodeToListItem(item, ctx)),
    } satisfies ListElement]
  }

  if (node.table) {
    return [translateTable(node.table, ctx)]
  }

  if (typeof node.image === 'string') {
    const imgSrc = node.image
    const lc = imgSrc.trim().toLowerCase()
    const BLOCKED_SCHEMES = ['file://', 'data:', 'javascript:', 'vbscript:', 'blob:', 'about:']
    if (BLOCKED_SCHEMES.some(s => lc.startsWith(s))) return []
    const img: ImageElement = { type: 'image', src: imgSrc }
    if (typeof node.width === 'number') img.width = node.width
    if (typeof node.height === 'number') img.height = node.height
    return [img]
  }

  if (typeof node.qr === 'string') {
    const qr: QrCodeElement = { type: 'qr-code', data: node.qr }
    if (typeof node.fit === 'number') qr.size = node.fit
    else if (Array.isArray(node.fit) && typeof node.fit[0] === 'number') qr.size = node.fit[0]
    return [qr]
  }

  if (node.columns) {
    ctx.onUnsupported('columns (flattened into a stack of children)')
    const out: ContentElement[] = []
    for (const child of node.columns) {
      for (const el of translateNode(child, ctx)) out.push(el)
    }
    return out
  }

  if (node.canvas) {
    ctx.onUnsupported('canvas (skipped)')
    return []
  }

  if (node.text !== undefined) {
    return [translateTextNode(node, ctx)]
  }

  return []
}

export function translateTextNode(node: PdfmakeObjectNode, ctx: TranslateCtx): ContentElement {
  const styleNames = normalizeStyleNames(node.style)
  const merged = mergeStyles(ctx, styleNames, node)

  let headingLevel: 1 | 2 | 3 | 4 | undefined
  for (const name of styleNames) {
    if (ctx.headingMap[name] !== undefined) {
      headingLevel = ctx.headingMap[name]
      break
    }
  }

  const flatText = typeof node.text === 'string' ? node.text : null
  const childArray = Array.isArray(node.text) ? node.text : (node.text && typeof node.text === 'object' ? [node.text] : [])

  if (headingLevel !== undefined) {
    const heading: HeadingElement = {
      type: 'heading',
      level: headingLevel,
      text: flatText ?? extractFlatText(childArray, ctx),
    }
    if (merged.fontSize !== undefined) heading.fontSize = merged.fontSize
    if (merged.color) heading.color = merged.color
    const headingAlign = pdfmakeAlignToPretext(merged.alignment)
    if (headingAlign) heading.align = headingAlign
    if (merged.font) heading.fontFamily = merged.font
    return heading
  }

  if (flatText !== null) {
    const para: ParagraphElement = { type: 'paragraph', text: flatText }
    applyStyleToParagraph(para, merged)
    return para
  }

  const spans: InlineSpan[] = []
  for (const child of childArray) collectSpans(child, ctx, merged, spans)
  if (spans.length === 1 && !spans[0]!.fontWeight && !spans[0]!.fontStyle && !spans[0]!.color && !spans[0]!.href && !spans[0]!.fontSize) {
    const para: ParagraphElement = { type: 'paragraph', text: spans[0]!.text }
    applyStyleToParagraph(para, merged)
    return para
  }
  const rich: RichParagraphElement = { type: 'rich-paragraph', spans }
  if (merged.fontSize !== undefined) rich.fontSize = merged.fontSize
  const richAlign = pdfmakeAlignToPretext(merged.alignment)
  if (richAlign) rich.align = richAlign
  return rich
}

export function applyStyleToParagraph(para: ParagraphElement, s: PdfmakeStyle): void {
  if (s.fontSize !== undefined) para.fontSize = s.fontSize
  if (s.color) para.color = s.color
  if (s.bold) para.fontWeight = 700
  const paraAlign = pdfmakeAlignToPretext(s.alignment)
  if (paraAlign) para.align = paraAlign
  if (s.font) para.fontFamily = s.font
}

export function collectSpans(child: PdfmakeNode, ctx: TranslateCtx, parent: PdfmakeStyle, out: InlineSpan[]): void {
  if (typeof child === 'string') {
    const span: InlineSpan = { text: child }
    if (parent.bold) span.fontWeight = 700
    if (parent.italics) span.fontStyle = 'italic'
    if (parent.color) span.color = parent.color
    if (parent.fontSize !== undefined) span.fontSize = parent.fontSize
    if (parent.font) span.fontFamily = parent.font
    out.push(span)
    return
  }
  if (!child || typeof child !== 'object') return
  const styleNames = normalizeStyleNames(child.style)
  const merged = mergeStyles(ctx, styleNames, child, parent)
  if (Array.isArray(child.text)) {
    for (const grand of child.text) collectSpans(grand, ctx, merged, out)
    return
  }
  if (typeof child.text === 'string') {
    const span: InlineSpan = { text: child.text }
    if (merged.bold) span.fontWeight = 700
    if (merged.italics) span.fontStyle = 'italic'
    if (merged.color) span.color = merged.color
    if (merged.fontSize !== undefined) span.fontSize = merged.fontSize
    if (merged.font) span.fontFamily = merged.font
    if (typeof child.link === 'string') span.href = child.link
    out.push(span)
  }
}

export function pdfmakeNodeToListItem(node: PdfmakeNode, ctx: TranslateCtx): import('../types.js').ListItem {
  if (typeof node === 'string') return { text: node }
  if (node && typeof node === 'object') {
    if (node.ul || node.ol) {
      const items = (node.ul ?? node.ol ?? []).map(i => pdfmakeNodeToListItem(i, ctx))
      return { text: '', items }
    }
    if (typeof node.text === 'string') return { text: node.text }
    if (Array.isArray(node.text)) return { text: extractFlatText(node.text, ctx) }
  }
  return { text: '' }
}
