import { PDFDocument } from 'pdf-lib'
import type { PdfDocument, PageGeometry, Margins, ImageMap, EncryptionSpec } from './types.js'
import { PretextPdfError } from './errors.js'
import { resolvePageDimensions } from './page-sizes.js'
import { validate } from './validate.js'
import { loadFonts } from './fonts.js'
import { loadImages } from './assets.js'
import { measureAllBlocks, measureHeaderFooterHeight, buildFontKey } from './measure.js'
import { paginate } from './paginate.js'
import { renderDocument } from './render.js'

// ─── Public API ───────────────────────────────────────────────────────────────

export type {
  PdfDocument,
  DocumentMetadata,
  ContentElement,
  ParagraphElement,
  HeadingElement,
  SpacerElement,
  TableElement,
  ColumnDef,
  TableRow,
  TableCell,
  ImageElement,
  SvgElement,
  ListElement,
  ListItem,
  HorizontalRuleElement,
  PageBreakElement,
  CodeBlockElement,
  RichParagraphElement,
  BlockquoteElement,
  InlineSpan,
  RichLine,
  RichFragment,
  FontSpec,
  HeaderFooterSpec,
  WatermarkSpec,
  EncryptionSpec,
  BookmarkConfig,
  HyphenationConfig,
  Margins,
  CommentElement,
  AnnotationSpec,
  AssemblyPart,
} from './types.js'
export { PretextPdfError } from './errors.js'
export type { ErrorCode } from './errors.js'
export type { NamedPageSize } from './page-sizes.js'
export { createPdf } from './builder.js'
export type { PdfBuilderOptions } from './builder.js'

/**
 * Render a PdfDocument to PDF bytes.
 *
 * Works in Node.js (requires @napi-rs/canvas peer dep) and in the browser.
 *
 * @example
 * ```ts
 * import { render } from 'pretext-pdf'
 *
 * const pdf = await render({
 *   content: [
 *     { type: 'heading', level: 1, text: 'Hello World' },
 *     { type: 'paragraph', text: 'This is a paragraph.' },
 *     { type: 'hr' },
 *     { type: 'list', style: 'unordered', items: [{ text: 'Item one' }, { text: 'Item two' }] },
 *   ]
 * })
 * fs.writeFileSync('output.pdf', pdf)
 * ```
 */
export async function render(doc: PdfDocument): Promise<Uint8Array> {
  // ── Install Node.js canvas polyfill FIRST, before any Pretext import ─────────
  // This MUST happen before measure.ts lazily imports @chenglou/pretext.
  if (typeof OffscreenCanvas === 'undefined' && typeof window === 'undefined') {
    const { installNodePolyfill } = await import('./node-polyfill.js')
    await installNodePolyfill()
  }

  // ── Stage 1: Validate ─────────────────────────────────────────────────────────
  validate(doc)

  // ── Resolve page geometry ──────────────────────────────────────────────────────
  const [pageWidth, pageHeight] = resolvePageDimensions(doc.pageSize)
  const margins: Margins = {
    top: 72,
    bottom: 72,
    left: 72,
    right: 72,
    ...doc.margins,
  }
  const contentWidth = pageWidth - margins.left - margins.right

  if (contentWidth <= 0) {
    throw new PretextPdfError('PAGE_TOO_SMALL', `Content width is ${contentWidth}pt after applying margins. Reduce margins or increase page size.`)
  }

  // ── Stage 2: Load Fonts + Images ──────────────────────────────────────────────
  // pdfDoc is created ONCE here and passed to all stages.
  const pdfDoc = await PDFDocument.create()

  // Set PDF metadata before loading anything else
  if (doc.metadata) {
    const m = doc.metadata
    if (m.title)    pdfDoc.setTitle(m.title)
    if (m.author)   pdfDoc.setAuthor(m.author)
    if (m.subject)  pdfDoc.setSubject(m.subject)
    if (m.keywords) pdfDoc.setKeywords(m.keywords)
    pdfDoc.setCreator(m.creator ?? 'pretext-pdf')
  }

  const fontMap = await loadFonts(doc, pdfDoc)
  const imageMap = await loadImages(doc, pdfDoc, contentWidth)

  // ── Measure header/footer heights (needed to compute available content area) ───
  const defaultFont = doc.defaultFont ?? 'Inter'

  const headerHeight = doc.header
    ? await measureHeaderFooterHeight(
        doc.header.text,
        doc.header.fontSize ?? 10,
        doc.header.fontFamily ?? defaultFont,
        contentWidth,
        (doc.header.fontSize ?? 10) * 1.4
      ) + 8 // 8pt padding between header and content
    : 0

  const footerHeight = doc.footer
    ? await measureHeaderFooterHeight(
        doc.footer.text,
        doc.footer.fontSize ?? 10,
        doc.footer.fontFamily ?? defaultFont,
        contentWidth,
        (doc.footer.fontSize ?? 10) * 1.4
      ) + 8
    : 0

  const contentHeight = pageHeight - margins.top - margins.bottom - headerHeight - footerHeight

  if (contentHeight <= 0) {
    throw new PretextPdfError(
      'PAGE_TOO_SMALL',
      `Content height is ${contentHeight}pt after applying margins + header/footer. Try reducing margins, header/footer font size, or increasing page size.`
    )
  }

  // ── Stage 3: Measure ──────────────────────────────────────────────────────────
  // measureAllBlocks handles:
  // - image key resolution (content index → img-N key)
  // - list flattening (1 ListElement → N MeasuredBlocks)
  // - all other elements (direct 1:1 mapping)
  let measuredBlocks = await measureAllBlocks(
    doc,
    contentWidth,
    imageMap,
    contentHeight
  )

  // ── Two-Pass TOC (if document contains a toc element) ───────────────────────────
  const { buildTocEntryBlocks } = await import('./measure.js')
  const tocIndex = doc.content.findIndex(el => el.type === 'toc')
  if (tocIndex !== -1) {
    const tocElement = doc.content[tocIndex] as any // TocElement type

    // Pass 1: paginate without real TOC content to collect heading page numbers
    const draftPaginatedDoc = paginate(measuredBlocks, contentHeight)

    // Build real TOC entry blocks using draft page numbers
    const tocEntryBlocks = await buildTocEntryBlocks(
      draftPaginatedDoc.headings,
      tocElement,
      contentWidth,
      doc,
    )

    // Splice TOC entries into measuredBlocks at the placeholder index
    // The placeholder (zero-height) block at tocIndex is replaced by the entry blocks
    measuredBlocks = [
      ...measuredBlocks.slice(0, tocIndex),
      ...tocEntryBlocks,
      ...measuredBlocks.slice(tocIndex + 1),
    ]
  }
  // ────────────────────────────────────────────────────────────────────────────────

  // ── Stage 4: Paginate (pure function) ─────────────────────────────────────────
  const paginatedDoc = paginate(measuredBlocks, contentHeight, {
    minOrphanLines: 2,
    minWidowLines: 2,
  })

  // ── Stage 5: Render ───────────────────────────────────────────────────────────
  const geo: PageGeometry = {
    pageWidth,
    pageHeight,
    margins,
    contentWidth,
    contentHeight,
    headerHeight,
    footerHeight,
  }

  const rawBytes = await renderDocument(paginatedDoc, doc, fontMap, imageMap, pdfDoc, geo)
  return doc.encryption ? await applyEncryption(rawBytes, doc.encryption) : rawBytes
}

/**
 * Merge multiple pre-rendered PDFs into a single PDF.
 * @param pdfs Array of Uint8Array PDF bytes to combine
 * @returns Combined PDF bytes
 */
export async function merge(pdfs: Uint8Array[]): Promise<Uint8Array> {
  if (!pdfs || pdfs.length === 0) {
    throw new PretextPdfError('ASSEMBLY_EMPTY', 'merge() requires at least one PDF. Received empty array.')
  }
  const target = await PDFDocument.create()
  for (const bytes of pdfs) {
    let src: any
    try {
      src = await PDFDocument.load(bytes)
    } catch (e) {
      throw new PretextPdfError('ASSEMBLY_FAILED', `Failed to load PDF for merging: ${e instanceof Error ? e.message : String(e)}`)
    }
    const pages = await target.copyPages(src, src.getPageIndices())
    pages.forEach((p: any) => target.addPage(p))
  }
  return target.save()
}

/**
 * Assemble a PDF from a mix of new documents and pre-rendered PDF parts.
 * @param parts Array of AssemblyPart — each is either a doc to render or raw PDF bytes
 * @returns Combined PDF bytes
 */
export async function assemble(parts: import('./types.js').AssemblyPart[]): Promise<Uint8Array> {
  if (!parts || parts.length === 0) {
    throw new PretextPdfError('ASSEMBLY_EMPTY', 'assemble() requires at least one part. Received empty array.')
  }
  const target = await PDFDocument.create()
  for (const part of parts) {
    if (!part.doc && !part.pdf) {
      throw new PretextPdfError('VALIDATION_ERROR', 'Each AssemblyPart must have either a doc or pdf property.')
    }
    const bytes = part.pdf ?? await render(part.doc!)
    let src: any
    try {
      src = await PDFDocument.load(bytes)
    } catch (e) {
      throw new PretextPdfError('ASSEMBLY_FAILED', `Failed to load PDF part: ${e instanceof Error ? e.message : String(e)}`)
    }
    const pages = await target.copyPages(src, src.getPageIndices())
    pages.forEach((p: any) => target.addPage(p))
  }
  return target.save()
}

/**
 * Stage 6: Apply encryption (post-process).
 * Lazy-loads @cantoo/pdf-lib only when encryption is needed.
 * Uses dynamic import with 'as string' cast to bypass TypeScript module resolution.
 */
async function applyEncryption(pdfBytes: Uint8Array, enc: NonNullable<PdfDocument['encryption']>): Promise<Uint8Array> {
  // Lazy-load @cantoo/pdf-lib — only imported when encryption is actually needed
  let cantoo: any
  try {
    cantoo = await import('@cantoo/pdf-lib' as string)
  } catch {
    throw new PretextPdfError(
      'ENCRYPTION_NOT_AVAILABLE',
      'doc.encryption requires @cantoo/pdf-lib. Install it: pnpm add @cantoo/pdf-lib'
    )
  }

  const encDoc = await cantoo.PDFDocument.load(pdfBytes)

  encDoc.encrypt({
    userPassword: enc.userPassword ?? '',
    ownerPassword: enc.ownerPassword ?? (await import('node:crypto')).randomUUID(),
    permissions: {
      printing: enc.permissions?.printing ?? true,
      copying: enc.permissions?.copying ?? true,
      modifying: enc.permissions?.modifying ?? false,
      annotating: enc.permissions?.annotating ?? true,
    },
  })

  // useObjectStreams: false is required for Adobe Reader compatibility with encrypted PDFs
  return encDoc.save({ useObjectStreams: false })
}

