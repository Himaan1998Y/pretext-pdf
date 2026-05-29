/**
 * pretext-pdf/compat — translate a pdfmake document descriptor into a
 * pretext-pdf PdfDocument so existing pdfmake codebases can switch with
 * a one-line change at the entry point.
 *
 *   import { fromPdfmake } from 'pretext-pdf/compat'
 *   import { render } from 'pretext-pdf'
 *
 *   const pdfmakeDoc = { content: [...], styles: {...} }
 *   const pdf = await render(fromPdfmake(pdfmakeDoc))
 *
 * Implementation split across src/compat/:
 *   pdfmake-types.ts — PdfmakeDocument, PdfmakeNode, PdfmakeStyle, CompatOptions, TranslateCtx
 *   translate.ts     — translateNode, translateTextNode, pdfmakeNodeToListItem (internal: translateNodeInner, applyStyleToParagraph, collectSpans)
 *   normalize.ts     — extractFlatText, translateTable, mergeStyles, normalizePageSize/Margins/HeaderFooter
 */
import type { PdfDocument, ContentElement, DocumentMetadata } from './types.js'

/** Strips readonly from every key — only used in compat.ts for internal construction. */
type Mutable<T> = { -readonly [K in keyof T]: T[K] }
import {
  type PdfmakeDocument,
  type CompatOptions,
  type TranslateCtx,
  DEFAULT_HEADING_MAP,
} from './compat/pdfmake-types.js'
import { translateNode } from './compat/translate.js'
import { normalizePageSize, normalizeMargins, normalizeHeaderFooter } from './compat/normalize.js'

export type { PdfmakeDocument, PdfmakeNode, PdfmakeObjectNode, PdfmakeStyle, CompatOptions } from './compat/pdfmake-types.js'

/**
 * Translate a pdfmake document descriptor into a pretext-pdf {@link PdfDocument}.
 * The result can be passed straight to `render()` from the main entry point.
 *
 * @public
 */
export function fromPdfmake(doc: PdfmakeDocument, options: CompatOptions = {}): PdfDocument {
  const headingMap = options.headingMap ?? DEFAULT_HEADING_MAP
  const _warnedFeatures = new Set<string>()
  const onUnsupported = options.onUnsupported ?? ((f: string) => {
    if (!_warnedFeatures.has(f)) {
      _warnedFeatures.add(f)
      console.warn(`[pretext-pdf/compat] Unsupported pdfmake feature skipped: ${f}`)
    }
  })
  const styles = doc.styles ?? {}
  const defaultStyle = doc.defaultStyle ?? {}

  const ctx: TranslateCtx = { styles, defaultStyle, headingMap, onUnsupported }

  const contentArr: import('./compat/pdfmake-types.js').PdfmakeNode[] = Array.isArray(doc.content) ? doc.content : [doc.content]
  const content: ContentElement[] = []
  for (const node of contentArr) {
    const els = translateNode(node, ctx)
    for (const el of els) content.push(el)
  }

  // Use Mutable<> to allow incremental property assignment during construction.
  // The cast to PdfDocument at the return site enforces the full interface contract.
  const result: Mutable<PdfDocument> = { content }

  if (doc.pageSize !== undefined) {
    if (typeof doc.pageSize === 'string') {
      const normalized = normalizePageSize(doc.pageSize)
      if (normalized) result.pageSize = normalized
    } else if (typeof doc.pageSize === 'object' && doc.pageSize.width && doc.pageSize.height) {
      const [w, h] = doc.pageOrientation === 'landscape'
        ? [doc.pageSize.height, doc.pageSize.width]
        : [doc.pageSize.width, doc.pageSize.height]
      result.pageSize = [w, h]
    }
  } else if (doc.pageOrientation === 'landscape') {
    result.pageSize = [842, 595]
  }

  if (doc.pageMargins !== undefined) {
    const m = normalizeMargins(doc.pageMargins)
    if (m) result.margins = m
  }

  if (defaultStyle.font) result.defaultFont = defaultStyle.font
  if (typeof defaultStyle.fontSize === 'number') result.defaultFontSize = defaultStyle.fontSize

  const header = normalizeHeaderFooter(doc.header, onUnsupported, 'header')
  if (header) result.header = header
  const footer = normalizeHeaderFooter(doc.footer, onUnsupported, 'footer')
  if (footer) result.footer = footer

  if (doc.info) {
    const m: Mutable<DocumentMetadata> = {}
    if (doc.info.title) m.title = doc.info.title
    if (doc.info.author) m.author = doc.info.author
    if (doc.info.subject) m.subject = doc.info.subject
    if (doc.info.keywords) m.keywords = doc.info.keywords.split(',').map(k => k.trim()).filter(Boolean)
    if (Object.keys(m).length > 0) result.metadata = m
  }

  if (doc.allowedFileDirs !== undefined) {
    result.allowedFileDirs = [...doc.allowedFileDirs]
  }

  return result as PdfDocument
}
