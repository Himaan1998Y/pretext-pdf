/**
 * Builder API for pretext-pdf
 *
 * Provides a fluent, chainable interface for constructing PDF documents.
 * Accumulates ContentElement[] and delegates final rendering to render().
 */
import type { PdfDocument, ParagraphElement, HeadingElement, TableElement, ImageElement, ListElement, CodeBlockElement, RichParagraphElement, BlockquoteElement, HorizontalRuleElement, CalloutElement, SvgElement, CommentElement, FormFieldElement, FootnoteDefElement, TocElement, InlineSpan, Margins, FontSpec, HeaderFooterSpec, DocumentMetadata } from './types.js';
import type { PluginDefinition } from './plugin-types.js';
/**
 * Options for initializing the PDF builder.
 * Includes all PdfDocument fields except 'content' (which is managed by the builder).
 * @public
 */
export interface PdfBuilderOptions {
    pageSize?: PdfDocument['pageSize'];
    margins?: Partial<Margins>;
    defaultFont?: string;
    defaultFontSize?: number;
    defaultLineHeight?: number;
    fonts?: FontSpec[];
    header?: HeaderFooterSpec;
    footer?: HeaderFooterSpec;
    metadata?: DocumentMetadata;
    defaultParagraphStyle?: PdfDocument['defaultParagraphStyle'];
    sections?: PdfDocument['sections'];
    plugins?: PluginDefinition[];
}
/**
 * Fluent builder returned by {@link createPdf}.
 * @public
 */
export interface PdfBuilder {
    addText(text: string, opts?: Partial<Omit<ParagraphElement, 'type' | 'text'>>): PdfBuilder;
    addHeading(text: string, opts?: Partial<Omit<HeadingElement, 'type' | 'text' | 'level'>> & {
        level?: number;
    }): PdfBuilder;
    addTable(opts: Omit<TableElement, 'type'>): PdfBuilder;
    addImage(src: ImageElement['src'], opts?: Partial<Omit<ImageElement, 'type' | 'src'>>): PdfBuilder;
    addList(opts: Omit<ListElement, 'type'>): PdfBuilder;
    addCode(text: string, opts: Omit<CodeBlockElement, 'type' | 'text'>): PdfBuilder;
    addRichText(spans: InlineSpan[], opts?: Partial<Omit<RichParagraphElement, 'type' | 'spans'>>): PdfBuilder;
    addBlockquote(text: string, opts?: Partial<Omit<BlockquoteElement, 'type' | 'text'>>): PdfBuilder;
    addHr(opts?: Partial<Omit<HorizontalRuleElement, 'type'>>): PdfBuilder;
    addSpacer(height: number): PdfBuilder;
    addPageBreak(): PdfBuilder;
    /** Render an inline SVG string (requires \@napi-rs/canvas peer dep). */
    addSvg(svg: string, opts?: Partial<Omit<SvgElement, 'type' | 'svg'>>): PdfBuilder;
    /** Add a callout box (info / warning / tip / note). */
    addCallout(content: string, opts?: Partial<Omit<CalloutElement, 'type' | 'content'>>): PdfBuilder;
    /** Add an invisible sticky-note comment annotation. */
    addComment(contents: string, opts?: Partial<Omit<CommentElement, 'type' | 'contents'>>): PdfBuilder;
    /** Add an interactive AcroForm field (text, checkbox, radio, dropdown, button). */
    addFormField(opts: Omit<FormFieldElement, 'type'>): PdfBuilder;
    /** Define a reusable footnote (referenced by footnote-ref spans in rich paragraphs). */
    addFootnoteDef(id: string, text: string, opts?: Partial<Omit<FootnoteDefElement, 'type' | 'id' | 'text'>>): PdfBuilder;
    /** Insert an auto-generated Table of Contents. */
    addTableOfContents(opts?: Partial<Omit<TocElement, 'type'>>): PdfBuilder;
    /** Set the default paragraph/heading style applied doc-wide. */
    defaultStyle(style: PdfDocument['defaultParagraphStyle']): PdfBuilder;
    /** Add a per-section header/footer override for the given page range. */
    section(fromPage: number, toPage: number, overrides: {
        header?: HeaderFooterSpec;
        footer?: HeaderFooterSpec;
    }): PdfBuilder;
    toDocument(): PdfDocument;
    build(): Promise<Uint8Array>;
}
/**
 * Create a new PDF document using the fluent builder API.
 *
 * @example
 * ```ts
 * const pdf = await createPdf({ pageSize: 'Letter' })
 *   .addHeading('Hello')
 *   .addText('This is a paragraph.')
 *   .addHr()
 *   .build()
 * ```
 * @public
 */
export declare function createPdf(options?: PdfBuilderOptions): PdfBuilder;
//# sourceMappingURL=builder.d.ts.map