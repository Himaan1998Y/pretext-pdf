/**
 * Plugin extension points for pretext-pdf.
 *
 * Register custom element types by passing an array of `PluginDefinition` objects
 * in `RenderOptions.plugins`. Each definition handles one `type` string.
 *
 * @example
 * ```ts
 * import { render } from 'pretext-pdf'
 * import type { PluginDefinition } from 'pretext-pdf/plugin-types'
 *
 * const boxPlugin: PluginDefinition = {
 *   type: 'highlight-box',
 *   measure: async (el, { contentWidth }) => ({ height: 50, spaceBefore: 8, spaceAfter: 8 }),
 *   render: ({ pdfPage, x, y, width, height }) => {
 *     pdfPage.drawRectangle({ x, y: y - height, width, height, color: rgb(1, 0.9, 0.8) })
 *   },
 * }
 *
 * const bytes = await render(doc, { plugins: [boxPlugin] })
 * ```
 *
 * @module
 * @beta
 */
import type { PdfDocument, Margins } from './types-public.js';
/**
 * Context passed to a plugin's `measure` hook.
 * @beta
 */
export interface PluginMeasureContext {
    /** Available content width in pt (page width minus left/right margins) */
    contentWidth: number;
    /** Available content height per page in pt */
    contentHeight: number;
    /** The full document being rendered */
    doc: PdfDocument;
}
/**
 * Return value from a plugin's `measure` hook.
 * @beta
 */
export interface PluginMeasureResult {
    /** Total block height in pt. Must be a finite non-negative number. */
    height: number;
    /** Space before the block in pt. Defaults to 0. */
    spaceBefore?: number;
    /** Space after the block in pt. Defaults to 0. */
    spaceAfter?: number;
    /**
     * Arbitrary plugin-specific data that the pipeline carries untouched from
     * `measure` to `render`. Use this to avoid re-computing expensive values.
     */
    pluginData?: unknown;
}
/**
 * Context passed to a plugin's `render` hook.
 * @beta
 */
export interface PluginRenderContext {
    /** The raw element object from doc.content */
    element: Record<string, unknown>;
    /** The pdf-lib page object to draw onto */
    pdfPage: import('@cantoo/pdf-lib').PDFPage;
    /** The pdf-lib document — use for color/font helpers */
    pdfDoc: import('@cantoo/pdf-lib').PDFDocument;
    /** Page width in pt */
    pageWidth: number;
    /** Page height in pt */
    pageHeight: number;
    /** Page margins in pt */
    margins: Margins;
    /** Left edge of the block's bounding box in pt (from page left) */
    x: number;
    /**
     * pdf-lib Y coordinate of the **top** edge of the block in pt.
     *
     * pdf-lib uses a bottom-left origin, so `y` decreases as you move down the page.
     * To draw a rectangle that fills the block exactly:
     * ```ts
     * pdfPage.drawRectangle({ x, y: y - height, width, height })
     * ```
     * To draw text starting at the top of the block:
     * ```ts
     * pdfPage.drawText(line1, { x, y: y - fontSize })
     * pdfPage.drawText(line2, { x, y: y - fontSize - lineHeight })
     * // For subsequent lines: y - fontSize - (n * lineHeight)
     * ```
     * `y - fontSize` places the baseline of the first line flush against the block top.
     * For wrapped or multi-line text, subtract `lineHeight` per additional line.
     */
    y: number;
    /** Block width in pt */
    width: number;
    /** Block height in pt (as returned by measure) */
    height: number;
    /**
     * Embedded image, if the plugin's `loadAsset` hook returned a PDFImage.
     * Undefined when the plugin has no `loadAsset` or it returned undefined.
     */
    pdfImage?: import('@cantoo/pdf-lib').PDFImage;
    /**
     * Data returned by the plugin's `measure` hook in `PluginMeasureResult.pluginData`.
     * Undefined when measure did not set pluginData.
     */
    pluginData?: unknown;
}
/**
 * Defines a custom element type that can be used in `doc.content`.
 *
 * All four hooks correspond to the pipeline stage they participate in:
 * - `validate` → Stage 1
 * - `loadAsset` → Stage 2b
 * - `measure` → Stage 3 (required)
 * - `render` → Stage 5 (required)
 *
 * @beta
 */
export interface PluginDefinition {
    /**
     * Unique type string. Must match the `type` field of the custom element objects
     * in `doc.content`. Must not collide with any built-in type.
     */
    type: string;
    /**
     * Validate hook — Stage 1.
     *
     * Called once per matching element during validation.
     * Return a non-empty string to reject the element; the message is used verbatim
     * in the thrown `VALIDATION_ERROR`. Return `void`, `undefined`, or `''` to accept.
     *
     * @param element - The raw element object from doc.content
     * @returns A rejection reason string, or void to accept
     */
    validate?: (element: Record<string, unknown>) => string | void;
    /**
     * Load asset hook — Stage 2b.
     *
     * Called during image/asset loading for each matching element.
     * Return a `PDFImage` to embed it into the document; the embedded image is
     * passed to `render` via `PluginRenderContext.pdfImage`.
     * Return `undefined` to skip asset loading for this element.
     *
     * The image key used in the imageMap is `${plugin.type}-${contentIndex}`.
     *
     * **Error handling:** Errors thrown here are handled differently from `measure`/`render`.
     * If this hook throws a `PretextPdfError`, it propagates and aborts the render.
     * If it throws any other error, the error is logged via `console.warn` and asset loading
     * is silently skipped for this element (the render continues without `pdfImage`).
     * This asymmetry means non-critical asset failures don't abort the whole document.
     *
     * **File safety:** If you load files based on element data, validate the path against
     * `doc.allowedFileDirs` yourself. The framework does not apply its PATH_TRAVERSAL guard
     * to files loaded inside this hook.
     *
     * @param element - The raw element object
     * @param pdfDoc - The pdf-lib PDFDocument (use pdfDoc.embedPng / embedJpg)
     * @param contentWidth - Available width in pt (for sizing decisions)
     */
    loadAsset?: (element: Record<string, unknown>, pdfDoc: import('@cantoo/pdf-lib').PDFDocument, contentWidth: number) => Promise<import('@cantoo/pdf-lib').PDFImage | undefined>;
    /**
     * Measure hook — Stage 3. **Required.**
     *
     * Called once per matching element to determine its height and layout metadata.
     * The returned `height` drives pagination; `pluginData` is carried to `render`.
     * Return `height: 0` to produce an invisible zero-height block (acts like a spacer).
     *
     * @param element - The raw element object
     * @param context - Content dimensions and the full document
     */
    measure: (element: Record<string, unknown>, context: PluginMeasureContext) => Promise<PluginMeasureResult>;
    /**
     * Render hook — Stage 5. **Required.**
     *
     * Called once per page-slice of the element during rendering.
     * Draw directly onto `context.pdfPage` using pdf-lib's drawing API.
     *
     * This hook must be synchronous. If you need async work (e.g. font loading),
     * do it in `measure` and pass the result via `PluginMeasureResult.pluginData`.
     *
     * @param context - Page, geometry, embedded image, and plugin data
     */
    render: (context: PluginRenderContext) => void;
}
//# sourceMappingURL=plugin-types.d.ts.map