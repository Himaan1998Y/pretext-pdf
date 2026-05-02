import { PDFDocument } from '@cantoo/pdf-lib'
import type { PdfDocument, FootnoteDefElement, RenderOptions } from './types.js'
import { PretextPdfError } from './errors.js'
import { runPipeline } from './pipeline.js'
import { applyPostProcessing } from './post-process.js'

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
  TocEntryElement,
  FootnoteDefElement,
  FloatGroupElement,
  RenderOptions,
} from './types.js'
export { PretextPdfError } from './errors.js'
export type { ErrorCode } from './errors.js'
export type { NamedPageSize } from './page-sizes.js'
export { createPdf } from './builder.js'
export type { PdfBuilder, PdfBuilderOptions } from './builder.js'
export { validate } from './validate.js'

let _fnSetCounter = 0

/**
 * Create a set of paired footnote definitions and their IDs for use in rich-paragraph spans.
 *
 * Returns an array where each entry has:
 * - `id`: unique string for use as `InlineSpan.footnoteRef`
 * - `def`: a `FootnoteDefElement` ready to push into `doc.content`
 *
 * @remarks
 * IDs are generated using a module-level counter and are unique within a process.
 * They are not stable across separate module loads.
 *
 * @example
 * ```ts
 * const fns = createFootnoteSet([
 *   { text: 'See Smith (2022) for details.' },
 *   { text: 'Ibid., p. 42.' },
 * ])
 * // In content:
 * // \{ type: 'rich-paragraph', spans: [\{ text: 'Text', footnoteRef: fns[0].id \}] \}
 * // ...fns.map(f => f.def)
 * ```
 * @beta
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
 * Works in Node.js (requires `@napi-rs/canvas` peer dep) and in the browser.
 *
 * @example
 * ```ts
 * import { render } from 'pretext-pdf'
 *
 * const pdf = await render(\{
 *   content: [
 *     \{ type: 'heading', level: 1, text: 'Hello World' \},
 *     \{ type: 'paragraph', text: 'This is a paragraph.' \},
 *   ]
 * \})
 * fs.writeFileSync('output.pdf', pdf)
 * ```
 * @public
 */
export async function render(doc: PdfDocument, options?: RenderOptions): Promise<Uint8Array> {
  if (typeof Intl?.Segmenter !== 'function') {
    throw new PretextPdfError('RENDER_FAILED', 'Intl.Segmenter is not available in this runtime. Upgrade to Node.js 18+ or set NODE_ICU_DATA to a full-icu data file.')
  }
  const rawBytes = await runPipeline(doc, options)
  return applyPostProcessing(rawBytes, doc)
}

/**
 * Merge multiple pre-rendered PDFs into a single PDF.
 * @param pdfs - Array of Uint8Array PDF bytes to combine
 * @returns Combined PDF bytes
 * @public
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
 * @param parts - Array of AssemblyPart — each is either a doc to render or raw PDF bytes
 * @returns Combined PDF bytes
 * @public
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

// ─── Schema reflection ────────────────────────────────────────────────────────

export { ELEMENT_TYPES, type ElementType } from './element-types.js'

// ─── Plugin system ────────────────────────────────────────────────────────────

export type {
  PluginDefinition,
  PluginMeasureContext,
  PluginMeasureResult,
  PluginRenderContext,
} from './plugin-types.js'
