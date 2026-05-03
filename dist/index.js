import { PDFDocument } from '@cantoo/pdf-lib';
import { PretextPdfError } from './errors.js';
import { runPipeline } from './pipeline.js';
import { applyPostProcessing } from './post-process.js';
export { PretextPdfError } from './errors.js';
export { createPdf } from './builder.js';
export { validate, validateDocument } from './validate.js';
let _fnSetCounter = 0;
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
export function createFootnoteSet(items) {
    const base = _fnSetCounter++;
    return items.map((item, i) => {
        const id = `fn-${base}-${i}`;
        return { id, def: { type: 'footnote-def', id, ...item } };
    });
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
export async function render(doc, options) {
    if (typeof Intl?.Segmenter !== 'function') {
        throw new PretextPdfError('RENDER_FAILED', 'Intl.Segmenter is not available in this runtime. Upgrade to Node.js 18+ or set NODE_ICU_DATA to a full-icu data file.');
    }
    const rawBytes = await runPipeline(doc, options);
    return applyPostProcessing(rawBytes, doc);
}
/**
 * Merge multiple pre-rendered PDFs into a single PDF.
 * @param pdfs - Array of Uint8Array PDF bytes to combine
 * @returns Combined PDF bytes
 * @public
 */
export async function merge(pdfs) {
    if (!pdfs || pdfs.length === 0) {
        throw new PretextPdfError('ASSEMBLY_EMPTY', 'merge() requires at least one PDF. Received empty array.');
    }
    const target = await PDFDocument.create();
    for (const bytes of pdfs) {
        let src;
        try {
            src = await PDFDocument.load(bytes);
        }
        catch (e) {
            throw new PretextPdfError('ASSEMBLY_FAILED', 'Failed to load PDF for merging');
        }
        const pages = await target.copyPages(src, src.getPageIndices());
        pages.forEach((p) => target.addPage(p));
    }
    return target.save();
}
/**
 * Assemble a PDF from a mix of new documents and pre-rendered PDF parts.
 * @param parts - Array of AssemblyPart — each is either a doc to render or raw PDF bytes
 * @returns Combined PDF bytes
 * @public
 */
export async function assemble(parts) {
    if (!parts || parts.length === 0) {
        throw new PretextPdfError('ASSEMBLY_EMPTY', 'assemble() requires at least one part. Received empty array.');
    }
    const target = await PDFDocument.create();
    for (const part of parts) {
        if (!part.doc && !part.pdf) {
            throw new PretextPdfError('VALIDATION_ERROR', 'Each AssemblyPart must have either a doc or pdf property.');
        }
        const bytes = part.pdf ?? await render(part.doc);
        let src;
        try {
            src = await PDFDocument.load(bytes);
        }
        catch (e) {
            throw new PretextPdfError('ASSEMBLY_FAILED', 'Failed to load PDF part');
        }
        const pages = await target.copyPages(src, src.getPageIndices());
        pages.forEach((p) => target.addPage(p));
    }
    return target.save();
}
// ─── Schema reflection ────────────────────────────────────────────────────────
export { ELEMENT_TYPES } from './element-types.js';
//# sourceMappingURL=index.js.map