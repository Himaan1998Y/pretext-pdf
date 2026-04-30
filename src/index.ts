import path from 'node:path'
import { PDFDocument } from '@cantoo/pdf-lib'
import type { PdfDocument, FootnoteDefElement, RenderOptions } from './types.js'
import { PretextPdfError } from './errors.js'
import { runPipeline } from './pipeline.js'

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
  QrCodeElement,
  BarcodeElement,
  ChartElement,
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
  TocElement,
  FootnoteDefElement,
  FloatGroupElement,
  RenderOptions,
} from './types.js'
export { PretextPdfError } from './errors.js'
export type { ErrorCode } from './errors.js'
export type { NamedPageSize } from './page-sizes.js'
export { createPdf } from './builder.js'
export type { PdfBuilderOptions } from './builder.js'
export { validate } from './validate.js'

let _fnSetCounter = 0

/**
 * Create a set of paired footnote definitions and their IDs for use in rich-paragraph spans.
 *
 * Returns an array where each entry has:
 * - `id`: unique string for use as `InlineSpan.footnoteRef`
 * - `def`: a `FootnoteDefElement` ready to push into `doc.content`
 *
 * @example
 * ```ts
 * const fns = createFootnoteSet([
 *   { text: 'See Smith (2022) for details.' },
 *   { text: 'Ibid., p. 42.' },
 * ])
 * // In content:
 * // { type: 'rich-paragraph', spans: [{ text: 'Text', footnoteRef: fns[0].id }] }
 * // ...fns.map(f => f.def)
 * ```
 */
export function createFootnoteSet(
  items: Array<{ text: string; fontSize?: number; fontFamily?: string; spaceAfter?: number }>
): Array<{ id: string; def: FootnoteDefElement }> {
  const base = _fnSetCounter++
  return items.map((item, i) => {
    const id = `fn-${base}-${i}`
    return { id, def: { type: 'footnote-def' as const, id, ...item } }
  })
}

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
export async function render(doc: PdfDocument, options?: RenderOptions): Promise<Uint8Array> {
  const rawBytes = await runPipeline(doc, options)
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
    let src: PDFDocument
    try {
      src = await PDFDocument.load(bytes)
    } catch (e) {
      throw new PretextPdfError('ASSEMBLY_FAILED', 'Failed to load PDF for merging')
    }
    const pages = await target.copyPages(src, src.getPageIndices())
    pages.forEach((p) => target.addPage(p))
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
    let src: PDFDocument
    try {
      src = await PDFDocument.load(bytes)
    } catch (e) {
      throw new PretextPdfError('ASSEMBLY_FAILED', 'Failed to load PDF part')
    }
    const pages = await target.copyPages(src, src.getPageIndices())
    pages.forEach((p) => target.addPage(p))
  }
  return target.save()
}

// ─── Post-processing (sign + encrypt) ────────────────────────────────────────

async function applySignature(
  pdfBytes: Uint8Array,
  sig: NonNullable<PdfDocument['signature']>
): Promise<Uint8Array> {
  type SignpdfModule = {
    SignPdf: any
    pdflibAddPlaceholder: (opts: { pdfDoc: PDFDocument; reason?: string; location?: string; contactInfo?: string; name?: string }) => void
  }
  let signpdfMod: SignpdfModule
  try {
    signpdfMod = await import('@signpdf/signpdf' as string) as SignpdfModule
  } catch {
    throw new PretextPdfError(
      'SIGNATURE_DEP_MISSING',
      'Cryptographic signing requires the @signpdf/signpdf package. Install it: npm install @signpdf/signpdf'
    )
  }

  const { SignPdf, pdflibAddPlaceholder } = signpdfMod

  let p12Buffer: Buffer
  try {
    if (sig.p12 instanceof Uint8Array) {
      p12Buffer = Buffer.from(sig.p12)
    } else {
      const p12Path = sig.p12 as string
      if (!path.isAbsolute(p12Path)) {
        throw new PretextPdfError('SIGNATURE_P12_LOAD_FAILED', 'P12 path must be absolute')
      }
      const { promises: fs } = await import('node:fs')
      p12Buffer = await fs.readFile(p12Path)
    }
  } catch (e) {
    if (e instanceof PretextPdfError) throw e
    throw new PretextPdfError('SIGNATURE_P12_LOAD_FAILED', 'Failed to load P12 certificate')
  }

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
  return encDoc.save({ useObjectStreams: false })
}

// ─── Schema reflection ────────────────────────────────────────────────────────

/** All element type strings that can appear in a PdfDocument's content array. */
export const ELEMENT_TYPES = [
  'paragraph', 'heading', 'spacer', 'table', 'image', 'svg',
  'qr-code', 'barcode', 'chart', 'list', 'hr', 'page-break',
  'code', 'rich-paragraph', 'blockquote', 'toc', 'toc-entry',
  'comment', 'form-field', 'callout', 'footnote-def', 'float-group',
] as const

export type ElementType = typeof ELEMENT_TYPES[number]
