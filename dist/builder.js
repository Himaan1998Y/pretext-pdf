/**
 * Builder API for pretext-pdf
 *
 * Provides a fluent, chainable interface for constructing PDF documents.
 * Accumulates ContentElement[] and delegates final rendering to render().
 */
import { runPipeline } from './pipeline.js';
import { applyPostProcessing } from './post-process.js';
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
export function createPdf(options = {}) {
    const content = [];
    let defaultParagraphStyle = options.defaultParagraphStyle;
    const sections = options.sections ? [...options.sections] : [];
    const plugins = options.plugins;
    return {
        /**
         * Add a paragraph.
         */
        addText(text, opts) {
            content.push({ type: 'paragraph', text, ...opts });
            return this;
        },
        /**
         * Add a heading.
         */
        addHeading(text, opts) {
            const level = (opts?.level ?? 1);
            const { level: _, ...restOpts } = opts ?? {};
            content.push({ type: 'heading', level, text, ...restOpts });
            return this;
        },
        /**
         * Add a table.
         */
        addTable(opts) {
            content.push({ type: 'table', ...opts });
            return this;
        },
        /**
         * Add an image.
         */
        addImage(src, opts) {
            const el = { type: 'image', src, ...opts };
            content.push(el);
            return this;
        },
        /**
         * Add a list (ordered or unordered).
         */
        addList(opts) {
            content.push({ type: 'list', ...opts });
            return this;
        },
        /**
         * Add a code block.
         */
        addCode(text, opts) {
            content.push({ type: 'code', text, ...opts });
            return this;
        },
        /**
         * Add a rich paragraph with mixed formatting (bold, italic, color).
         */
        addRichText(spans, opts) {
            content.push({ type: 'rich-paragraph', spans, ...opts });
            return this;
        },
        /**
         * Add a blockquote.
         */
        addBlockquote(text, opts) {
            content.push({ type: 'blockquote', text, ...opts });
            return this;
        },
        /**
         * Add a horizontal rule.
         */
        addHr(opts) {
            content.push({ type: 'hr', ...opts });
            return this;
        },
        /**
         * Add a spacer (vertical whitespace).
         */
        addSpacer(height) {
            content.push({ type: 'spacer', height });
            return this;
        },
        /**
         * Add a page break.
         */
        addPageBreak() {
            content.push({ type: 'page-break' });
            return this;
        },
        addSvg(svg, opts) {
            content.push({ type: 'svg', svg, ...opts });
            return this;
        },
        addCallout(c, opts) {
            content.push({ type: 'callout', content: c, ...opts });
            return this;
        },
        addComment(contents, opts) {
            content.push({ type: 'comment', contents, ...opts });
            return this;
        },
        addFormField(opts) {
            content.push({ type: 'form-field', ...opts });
            return this;
        },
        addFootnoteDef(id, text, opts) {
            content.push({ type: 'footnote-def', id, text, ...opts });
            return this;
        },
        addTableOfContents(opts) {
            content.push({ type: 'toc', ...opts });
            return this;
        },
        defaultStyle(style) {
            defaultParagraphStyle = style;
            return this;
        },
        section(fromPage, toPage, overrides) {
            sections.push({ fromPage, toPage, ...overrides });
            return this;
        },
        /**
         * Get the underlying declarative document.
         * Useful for inspection, serialization, or reusing with render().
         *
         * **Note:** Plugins are a rendering concern and are NOT included in the returned document.
         * If you pass this document to `render()` directly, supply plugins separately via
         * `RenderOptions.plugins`. Use `build()` if you want plugins applied automatically.
         */
        toDocument() {
            const doc = {
                pageSize: options.pageSize,
                margins: options.margins,
                defaultFont: options.defaultFont,
                defaultFontSize: options.defaultFontSize,
                defaultLineHeight: options.defaultLineHeight,
                fonts: options.fonts,
                header: options.header,
                footer: options.footer,
                metadata: options.metadata,
                ...(defaultParagraphStyle !== undefined && { defaultParagraphStyle }),
                ...(sections.length > 0 && { sections }),
                content,
            };
            return doc;
        },
        /**
         * Build the PDF and return the bytes.
         */
        async build() {
            const doc = this.toDocument();
            const rawBytes = await runPipeline(doc, plugins !== undefined ? { plugins } : {});
            return applyPostProcessing(rawBytes, doc);
        },
    };
}
//# sourceMappingURL=builder.js.map