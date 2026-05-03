import type { PdfDocument, FootnoteDefElement, RenderOptions } from './types.js';
export type { ValidationError, ValidationResult, Logger, PdfDocument, DocumentMetadata, ContentElement, ParagraphElement, HeadingElement, SpacerElement, TableElement, ColumnDef, TableRow, TableCell, ImageElement, SvgElement, QrCodeElement, BarcodeElement, ChartElement, ListElement, ListItem, HorizontalRuleElement, PageBreakElement, CodeBlockElement, RichParagraphElement, BlockquoteElement, InlineSpan, RichLine, RichFragment, FontSpec, HeaderFooterSpec, WatermarkSpec, EncryptionSpec, SignatureSpec, BookmarkConfig, HyphenationConfig, Margins, CommentElement, CalloutElement, AnnotationSpec, AssemblyPart, FormFieldElement, TocElement, TocEntryElement, FootnoteDefElement, FloatGroupElement, RenderOptions, } from './types.js';
export { PretextPdfError } from './errors.js';
export type { ErrorCode } from './errors.js';
export type { NamedPageSize } from './page-sizes.js';
export { createPdf } from './builder.js';
export type { PdfBuilder, PdfBuilderOptions } from './builder.js';
export { validate, validateDocument } from './validate.js';
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
export declare function createFootnoteSet(items: Array<{
    text: string;
    fontSize?: number;
    fontFamily?: string;
    spaceAfter?: number;
}>): Array<{
    id: string;
    def: FootnoteDefElement;
}>;
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
export declare function render(doc: PdfDocument, options?: RenderOptions): Promise<Uint8Array>;
/**
 * Merge multiple pre-rendered PDFs into a single PDF.
 * @param pdfs - Array of Uint8Array PDF bytes to combine
 * @returns Combined PDF bytes
 * @public
 */
export declare function merge(pdfs: Uint8Array[]): Promise<Uint8Array>;
/**
 * Assemble a PDF from a mix of new documents and pre-rendered PDF parts.
 * @param parts - Array of AssemblyPart — each is either a doc to render or raw PDF bytes
 * @returns Combined PDF bytes
 * @public
 */
export declare function assemble(parts: import('./types.js').AssemblyPart[]): Promise<Uint8Array>;
export { ELEMENT_TYPES, type ElementType } from './element-types.js';
export type { PluginDefinition, PluginMeasureContext, PluginMeasureResult, PluginRenderContext, } from './plugin-types.js';
//# sourceMappingURL=index.d.ts.map