/**
 * measure.ts — Measurement orchestrator
 * Entry point for the measurement pipeline. Exports public measurement functions.
 */
import type { PdfDocument } from './types.js';
import type { MeasuredBlock, ImageMap } from './types-internal.js';
import { measureBlock } from './measure-blocks.js';
import type { PluginDefinition } from './plugin-types.js';
export { measureBlock };
/**
 * Build the canonical font key: family-weight-style
 * Used by both measure.ts and render.ts for font lookup
 */
export declare function buildFontKey(family: string, weight?: 400 | 700, style?: 'normal' | 'italic'): string;
/**
 * Measure a short header/footer string — returns total height in pt.
 */
export declare function measureHeaderFooterHeight(text: string, fontSize: number, fontFamily: string, contentWidth: number, lineHeight: number): Promise<number>;
/**
 * Build measured TOC entry blocks from draft headings (two-pass TOC generation).
 * Each entry is placed on a specific page.
 */
export declare function buildTocEntryBlocks(headings: Array<{
    text: string;
    level: 1 | 2 | 3 | 4;
    pageIndex: number;
}>, tocElement: import('./types.js').TocElement, contentWidth: number, doc: PdfDocument): Promise<MeasuredBlock[]>;
/**
 * Stage 3: Measure all document content elements.
 * Handles image key resolution, list flattening, SVG wrapping, hyphenation initialization.
 *
 * Returns array of MeasuredBlock (includes flattened lists + SVG-wrapped images).
 */
export declare function measureAllBlocks(doc: PdfDocument, contentWidth: number, imageMap: ImageMap, pageContentHeight: number, plugins?: PluginDefinition[]): Promise<MeasuredBlock[]>;
//# sourceMappingURL=measure.d.ts.map