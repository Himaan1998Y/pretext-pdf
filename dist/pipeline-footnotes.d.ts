import type { ContentElement } from './types-public.js';
import type { MeasuredBlock, PaginatedDocument } from './types-internal.js';
/** Build document-order footnote numbering by scanning rich-paragraphs in content order. */
export declare function buildFootnoteNumbering(content: ContentElement[]): Map<string, number>;
/**
 * Two-pass footnote pagination.
 *
 * Pass 1: paginate without zone reservation to find which refs land on which page.
 * Pass 2: paginate with per-page zones reserved at the bottom.
 * Returns the final PaginatedDocument with footnoteItems and footnoteZoneHeight annotated.
 */
export declare function runFootnoteTwoPass(measuredBlocks: MeasuredBlock[], contentHeight: number, paginateConfig: {
    minOrphanLines: number;
    minWidowLines: number;
}, doc: {
    content: ContentElement[];
}): PaginatedDocument;
//# sourceMappingURL=pipeline-footnotes.d.ts.map