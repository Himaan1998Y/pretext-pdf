import { PDFDocument, PDFName, PDFString } from '@cantoo/pdf-lib'
import type { PdfDocument, PageGeometry, Margins, ImageMap, EncryptionSpec, FootnoteDefElement, MeasuredBlock } from './types.js'
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
  SignatureSpec,
  BookmarkConfig,
  HyphenationConfig,
  Margins,
  CommentElement,
  CalloutElement,
  AnnotationSpec,
  AssemblyPart,
  FormFieldElement,
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
    if (m.producer) pdfDoc.setProducer(m.producer)
    if (m.language) (pdfDoc as any).catalog.set(PDFName.of('Lang'), PDFString.of(m.language))
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
  const paginateConfig = { minOrphanLines: 2, minWidowLines: 2 }

  // ── Footnote two-pass orchestration ───────────────────────────────────────────
  const footnoteDefElements = doc.content.filter(
    el => el.type === 'footnote-def'
  ) as FootnoteDefElement[]

  let paginatedDoc: import('./types.js').PaginatedDocument

  if (footnoteDefElements.length === 0) {
    // No footnotes — single pass, normal flow
    paginatedDoc = paginate(measuredBlocks, contentHeight, paginateConfig)
  } else {
    // Build a map of def id → measured height (already measured in measuredBlocks)
    const footnoteDefHeightMap = new Map<string, number>()
    for (const block of measuredBlocks) {
      if (block.element.type === 'footnote-def') {
        const def = block.element as FootnoteDefElement
        footnoteDefHeightMap.set(def.id, block.height + (block.spaceAfter ?? 0))
      }
    }

    // Strip footnote-def blocks from the block stream (defs are not placed in flow)
    const flowBlocks = measuredBlocks.filter(b => b.element.type !== 'footnote-def')

    // Build document-order footnote numbering (scan rich-paragraphs in content order)
    const footnoteNumbering = new Map<string, number>()
    let footnoteCounter = 1
    for (const el of doc.content) {
      if (el.type === 'rich-paragraph') {
        for (const span of el.spans) {
          if (span.footnoteRef && !footnoteNumbering.has(span.footnoteRef)) {
            footnoteNumbering.set(span.footnoteRef, footnoteCounter++)
          }
        }
      }
    }

    // PASS 1: Paginate without any footnote zone reservation
    const pass1 = paginate(flowBlocks, contentHeight, paginateConfig)

    // Determine which footnote refs land on which page
    const pageFootnoteRefs = new Map<number, string[]>()
    for (let pageIdx = 0; pageIdx < pass1.pages.length; pageIdx++) {
      const page = pass1.pages[pageIdx]!
      const refsOnPage: string[] = []
      for (const pagedBlock of page.blocks) {
        const el = pagedBlock.measuredBlock.element
        if (el.type === 'rich-paragraph') {
          for (const span of el.spans) {
            if (span.footnoteRef && !refsOnPage.includes(span.footnoteRef)) {
              refsOnPage.push(span.footnoteRef)
            }
          }
        }
      }
      if (refsOnPage.length > 0) {
        pageFootnoteRefs.set(pageIdx, refsOnPage)
      }
    }

    // Build per-page footnote zone heights
    const SEPARATOR_HEIGHT = 16  // separator line + padding above/below
    const footnoteZones = new Map<number, number>()
    for (const [pageIdx, refIds] of pageFootnoteRefs) {
      let zoneHeight = SEPARATOR_HEIGHT
      for (const refId of refIds) {
        zoneHeight += footnoteDefHeightMap.get(refId) ?? 0
      }
      footnoteZones.set(pageIdx, zoneHeight)
    }

    // PASS 2: Paginate with zones reserved
    const pass2Config = { ...paginateConfig, footnoteZones }
    paginatedDoc = paginate(flowBlocks, contentHeight, pass2Config)
    paginatedDoc.footnoteNumbering = footnoteNumbering

    // Annotate each RenderedPage with its footnote items
    for (const [pageIdx, refIds] of pageFootnoteRefs) {
      const page = paginatedDoc.pages[pageIdx]
      if (page) {
        page.footnoteItems = refIds
          .map(id => {
            const def = footnoteDefElements.find(d => d.id === id)
            const num = footnoteNumbering.get(id) ?? 0
            return def ? { def, number: num } : null
          })
          .filter(Boolean) as Array<{ def: FootnoteDefElement; number: number }>
        const zoneHeight = footnoteZones.get(pageIdx)
        if (zoneHeight !== undefined) page.footnoteZoneHeight = zoneHeight
      }
    }
  }

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
  const signedBytes = (doc.signature?.p12) ? await applySignature(rawBytes, doc.signature) : rawBytes
  return doc.encryption ? await applyEncryption(signedBytes, doc.encryption) : signedBytes
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
 * Stage 6b: Apply cryptographic PKCS#7/CMS signature (post-process).
 * Requires the optional peer dep @signpdf/signpdf.
 */
async function applySignature(
  pdfBytes: Uint8Array,
  sig: NonNullable<PdfDocument['signature']>
): Promise<Uint8Array> {
  // Lazy-load @signpdf/signpdf — optional peer dep
  let signpdfMod: any
  try {
    signpdfMod = await import('@signpdf/signpdf' as string)
  } catch {
    throw new PretextPdfError(
      'SIGNATURE_DEP_MISSING',
      'Cryptographic signing requires the @signpdf/signpdf package. Install it: npm install @signpdf/signpdf'
    )
  }

  const { SignPdf, pdflibAddPlaceholder } = signpdfMod

  // Load P12 certificate bytes
  let p12Buffer: Buffer
  try {
    if (sig.p12 instanceof Uint8Array) {
      p12Buffer = Buffer.from(sig.p12)
    } else {
      const { readFileSync } = await import('node:fs')
      p12Buffer = readFileSync(sig.p12 as string)
    }
  } catch (e) {
    throw new PretextPdfError(
      'SIGNATURE_P12_LOAD_FAILED',
      `Failed to load P12 certificate: ${e instanceof Error ? e.message : String(e)}`
    )
  }

  // Re-load into PDFDocument to inject the byte-range placeholder dict
  const pdfDoc = await PDFDocument.load(pdfBytes)

  pdflibAddPlaceholder({
    pdfDoc,
    reason:      sig.reason      ?? 'Signed',
    contactInfo: sig.contactInfo ?? '',
    name:        sig.signerName  ?? '',
    location:    sig.location    ?? '',
  })

  const pdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false })

  const signer = new SignPdf()
  let signedBuffer: Buffer
  try {
    signedBuffer = await signer.sign(
      Buffer.from(pdfWithPlaceholder),
      p12Buffer,
      sig.passphrase !== undefined ? { passphrase: sig.passphrase } : undefined
    )
  } catch (e) {
    throw new PretextPdfError(
      'SIGNATURE_FAILED',
      `PDF signing failed: ${e instanceof Error ? e.message : String(e)}`
    )
  }

  return new Uint8Array(signedBuffer)
}

/**
 * Stage 6: Apply encryption (post-process).
 * @cantoo/pdf-lib is now a direct dependency — no lazy-load needed.
 */
async function applyEncryption(pdfBytes: Uint8Array, enc: NonNullable<PdfDocument['encryption']>): Promise<Uint8Array> {
  const encDoc = await PDFDocument.load(pdfBytes)

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

