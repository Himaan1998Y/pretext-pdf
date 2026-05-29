import { PDFDocument, PDFHexString, PDFName, PDFString } from '@cantoo/pdf-lib'
import type { PdfDocument, Margins, RenderOptions } from './types-public/index.js'
import type { PageGeometry, FontMap, ImageMap, MeasuredBlock } from './types-internal.js'
import { PretextPdfError } from './errors.js'
import { resolvePageDimensions } from './page-sizes.js'
import { validate } from './validate/index.js'
import { loadFonts } from './fonts.js'
import { loadImages } from './assets.js'
import { measureAllBlocks, measureHeaderFooterHeight } from './measure.js'
import { LINE_HEIGHT_COMPACT } from './render-utils.js'
import { renderDocument } from './render.js'
import { runTocTwoPass } from './pipeline-toc.js'
import { runFootnoteTwoPass } from './pipeline-footnotes.js'

// ─── Stage 1: Validate ────────────────────────────────────────────────────────

export function stageValidate(doc: PdfDocument, options?: RenderOptions): void {
  validate(doc, options)
}

// ─── Stage 2a: Init (geometry + pdfDoc + metadata) ───────────────────────────

export async function stageInit(doc: PdfDocument): Promise<{
  pdfDoc: PDFDocument
  geo: Omit<PageGeometry, 'contentHeight' | 'headerHeight' | 'footerHeight'>
  defaultFont: string
}> {
  const [pageWidth, pageHeight] = resolvePageDimensions(doc.pageSize)
  const margins: Margins = {
    top:    doc.margins?.top    ?? 72,
    bottom: doc.margins?.bottom ?? 72,
    left:   doc.margins?.left   ?? 72,
    right:  doc.margins?.right  ?? 72,
  }
  const contentWidth = pageWidth - margins.left - margins.right

  if (contentWidth <= 0) {
    throw new PretextPdfError('PAGE_TOO_SMALL', `Content width is ${contentWidth}pt after applying margins. Reduce margins or increase page size.`)
  }

  const pdfDoc = await PDFDocument.create()

  if (doc.metadata) {
    const m = doc.metadata
    if (m.language) {
      // /Lang is a text string per PDF 32000 §14.9.2. PDFString (literal string) is correct
      // here — matching pdf-lib's own setLanguage() behavior. BCP47 tags are validated to
      // ASCII letters/digits/hyphens only (no parentheses), so literal-string injection risk
      // is zero. PDFHexString.fromText() would add a UTF-16 BOM that some readers misparse.
      pdfDoc.catalog.set(PDFName.of('Lang'), PDFString.of(m.language))
    }
    // Write all Info dict entries via PDFHexString to prevent PDF literal-string
    // injection through unbalanced parentheses in user-controlled content (B3).
    // getInfoDict() is an internal @cantoo/pdf-lib method — cast intentional (M7).
    // If the method is removed in a future library version, fall back to the
    // convenience setXxx() methods (which may use literal strings) rather than
    // silently dropping standard metadata.
    try {
      const infoDict = (pdfDoc as unknown as { getInfoDict(): import('@cantoo/pdf-lib').PDFDict }).getInfoDict()
      if (m.title)    infoDict.set(PDFName.of('Title'),    PDFHexString.fromText(m.title))
      if (m.author)   infoDict.set(PDFName.of('Author'),   PDFHexString.fromText(m.author))
      if (m.subject)  infoDict.set(PDFName.of('Subject'),  PDFHexString.fromText(m.subject))
      if (m.keywords) infoDict.set(PDFName.of('Keywords'), PDFHexString.fromText(m.keywords.join(' ')))
      infoDict.set(PDFName.of('Creator'),   PDFHexString.fromText(m.creator ?? 'pretext-pdf'))
      if (m.producer) infoDict.set(PDFName.of('Producer'), PDFHexString.fromText(m.producer))
      if (m.accessibility) infoDict.set(PDFName.of('Accessibility'), PDFHexString.fromText(JSON.stringify(m.accessibility)))
      if (m.semantic)      infoDict.set(PDFName.of('Semantic'),       PDFHexString.fromText(JSON.stringify(m.semantic)))
    } catch (err) {
      // getInfoDict() is not part of the official @cantoo/pdf-lib API surface — log before falling back.
      console.warn('[pretext-pdf] metadata write via PDFHexString failed, using fallback:', err instanceof Error ? err.message : String(err))
      // Fallback: convenience methods may use literal strings but are better than no metadata.
      if (m.title)    pdfDoc.setTitle(m.title)
      if (m.author)   pdfDoc.setAuthor(m.author)
      if (m.subject)  pdfDoc.setSubject(m.subject)
      if (m.keywords) pdfDoc.setKeywords(m.keywords)
      pdfDoc.setCreator(m.creator ?? 'pretext-pdf')
      if (m.producer) pdfDoc.setProducer(m.producer)
    }
  }

  const creationDate = doc.renderDate
    ? (doc.renderDate instanceof Date ? doc.renderDate : new Date(doc.renderDate))
    : new Date()
  pdfDoc.setCreationDate(creationDate)
  pdfDoc.setModificationDate(creationDate)

  return {
    pdfDoc,
    geo: { pageWidth, pageHeight, margins, contentWidth },
    defaultFont: doc.defaultFont ?? 'Inter',
  }
}

// ─── Stage 2b: Load assets (fonts + images in parallel) ──────────────────────

export async function stageLoadAssets(
  doc: PdfDocument,
  pdfDoc: PDFDocument,
  contentWidth: number,
  plugins?: import('./plugin-types.js').PluginDefinition[],
  logger?: import('./types-public/index.js').Logger,
): Promise<{ fontMap: FontMap; imageMap: ImageMap }> {
  // Sequential: both mutate pdfDoc's cross-reference table — concurrent mutation causes intermittent xref corruption.
  const fontMap = await loadFonts(doc, pdfDoc)
  const imageMap = await loadImages(doc, pdfDoc, contentWidth, plugins, logger)
  return { fontMap, imageMap }
}

// ─── Stage 2c: Finalize geometry (header/footer heights) ─────────────────────

export async function stageFinalizeGeo(
  doc: PdfDocument,
  partialGeo: Omit<PageGeometry, 'contentHeight' | 'headerHeight' | 'footerHeight'>,
  defaultFont: string,
): Promise<PageGeometry> {
  const { pageHeight, margins, contentWidth } = partialGeo

  const headerHeight = doc.header
    ? await measureHeaderFooterHeight(
        doc.header.text,
        doc.header.fontSize ?? 10,
        doc.header.fontFamily ?? defaultFont,
        contentWidth,
        (doc.header.fontSize ?? 10) * LINE_HEIGHT_COMPACT
      ) + 8
    : 0

  const footerHeight = doc.footer
    ? await measureHeaderFooterHeight(
        doc.footer.text,
        doc.footer.fontSize ?? 10,
        doc.footer.fontFamily ?? defaultFont,
        contentWidth,
        (doc.footer.fontSize ?? 10) * LINE_HEIGHT_COMPACT
      ) + 8
    : 0

  const contentHeight = pageHeight - margins.top - margins.bottom - headerHeight - footerHeight

  if (contentHeight <= 0) {
    throw new PretextPdfError(
      'PAGE_TOO_SMALL',
      `Content height is ${contentHeight}pt after applying margins + header/footer. Try reducing margins, header/footer font size, or increasing page size.`
    )
  }

  return { ...partialGeo, headerHeight, footerHeight, contentHeight }
}

// ─── Stage 3: Measure ─────────────────────────────────────────────────────────

export async function stageMeasure(
  doc: PdfDocument,
  contentWidth: number,
  imageMap: ImageMap,
  contentHeight: number,
  plugins?: import('./plugin-types.js').PluginDefinition[]
): Promise<MeasuredBlock[]> {
  let measuredBlocks = await measureAllBlocks(doc, contentWidth, imageMap, contentHeight, plugins)
  measuredBlocks = await runTocTwoPass(measuredBlocks, doc, contentWidth, contentHeight)
  return measuredBlocks
}

// ─── Stage 4: Paginate ────────────────────────────────────────────────────────

export function stagePaginate(
  measuredBlocks: MeasuredBlock[],
  contentHeight: number,
  doc: PdfDocument,
): ReturnType<typeof runFootnoteTwoPass> {
  const paginateConfig = { minOrphanLines: 2, minWidowLines: 2 }
  return runFootnoteTwoPass(measuredBlocks, contentHeight, paginateConfig, doc)
}

// ─── Stage 5: Render ──────────────────────────────────────────────────────────

export async function stageRender(
  paginatedDoc: ReturnType<typeof stagePaginate>,
  doc: PdfDocument,
  fontMap: FontMap,
  imageMap: ImageMap,
  pdfDoc: PDFDocument,
  geo: PageGeometry,
  plugins?: import('./plugin-types.js').PluginDefinition[],
  logger?: import('./types-public/index.js').Logger,
): Promise<Uint8Array> {
  return renderDocument(paginatedDoc, doc, fontMap, imageMap, pdfDoc, geo, plugins, logger)
}

// ─── Composed pipeline ────────────────────────────────────────────────────────

/**
 * Run all 5 stages in sequence and return raw PDF bytes.
 * Post-processing (signature, encryption) is applied by the public render() in index.ts.
 */
export async function runPipeline(doc: PdfDocument, options?: RenderOptions): Promise<Uint8Array> {
  // Node canvas polyfill MUST be installed before any Pretext import (measure.ts uses it)
  if (typeof OffscreenCanvas === 'undefined' && typeof window === 'undefined') {
    const { installNodePolyfill } = await import('./node-polyfill.js')
    await installNodePolyfill()
  }

  const plugins = options?.plugins
  const logger = options?.logger

  stageValidate(doc, options)

  const { pdfDoc, geo: partialGeo, defaultFont } = await stageInit(doc)
  const { fontMap, imageMap } = await stageLoadAssets(doc, pdfDoc, partialGeo.contentWidth, plugins, logger)
  const geo = await stageFinalizeGeo(doc, partialGeo, defaultFont)
  const measuredBlocks = await stageMeasure(doc, geo.contentWidth, imageMap, geo.contentHeight, plugins)
  const paginatedDoc = stagePaginate(measuredBlocks, geo.contentHeight, doc)
  return stageRender(paginatedDoc, doc, fontMap, imageMap, pdfDoc, geo, plugins, logger)
}
