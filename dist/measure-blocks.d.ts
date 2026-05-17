/**
 * measure-blocks.ts — Per-element-type measurement functions
 * All the specific measurer functions for different content types.
 */
import type { ContentElement, ColumnDef, PdfDocument } from './types.js';
import type { MeasuredBlock, ImageMap } from './types-internal.js';
import { HyphenatorOpts } from './measure-text.js';
export declare function measureBlock(element: ContentElement, contentWidth: number, doc: PdfDocument, hyphenatorOpts?: HyphenatorOpts, wordWidthCache?: Map<string, number>): Promise<MeasuredBlock | MeasuredBlock[]>;
/** Measure an image element with its known imageMap key */
export declare function measureImageWithKey(element: import('./types.js').ImageElement, imageKey: string, imageMap: ImageMap, contentWidth: number, pageContentHeight: number): Promise<MeasuredBlock>;
export declare function measureFloatImageBlock(element: import('./types.js').ImageElement, imageKey: string, imageMap: ImageMap, contentWidth: number, pageContentHeight: number, doc: import('./types.js').PdfDocument, wordWidthCache?: Map<string, number>): Promise<MeasuredBlock>;
export declare function measureFloatGroup(element: import('./types.js').FloatGroupElement, imageKey: string, imageMap: ImageMap, contentWidth: number, pageContentHeight: number, doc: PdfDocument, hyphenatorOpts?: HyphenatorOpts, wordWidthCache?: Map<string, number>): Promise<MeasuredBlock>;
/**
 * Resolve column width definitions to concrete pt values.
 * Fixed widths are used as-is. Star widths ('2*', '*') share the remaining space.
 * 'auto' columns use naturalWidths[i] (measured content width) — caller must pre-compute these.
 *
 * naturalWidths is required if any column uses 'auto'. It maps column index → natural text width in pt
 * (the minimum width needed to display cell text on one line, including cellPaddingH on both sides).
 */
export declare function resolveColumnWidths(columns: ColumnDef[], contentWidth: number, cellPaddingH: number, borderWidth: number, naturalWidths?: number[]): number[];
/**
 * Measure text with automatic word hyphenation (Liang's algorithm via hypher).
 * Splits on \n to preserve paragraph breaks; tokenizes words; greedily packs with hyphenation fallback.
 */
//# sourceMappingURL=measure-blocks.d.ts.map