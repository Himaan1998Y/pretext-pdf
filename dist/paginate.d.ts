import type { MeasuredBlock, RenderedPage, PaginatedDocument } from './types-internal.js';
interface PaginateConfig {
    minOrphanLines: number;
    minWidowLines: number;
    /**
     * Per-page height to reserve at the bottom for footnote zone.
     * Maps pageIndex (0-based) → pt to subtract from available content height.
     * Built by the two-pass orchestration in index.ts.
     */
    footnoteZones?: Map<number, number>;
}
/**
 * Stage 4: Paginate — pure function.
 * Takes measured blocks + page content height → distributes blocks across pages.
 * No I/O, no side effects, fully unit-testable.
 *
 * @throws PretextPdfError('PAGE_TOO_SMALL') when pageContentHeight <= 0.
 * @throws PretextPdfError('PAGINATION_FAILED') when a callout or blockquote
 *   block violates its measurement contract (e.g. missing or non-finite fields).
 *   This is a producer-side invariant; normal inputs produced by measureBlock
 *   will not trigger it.
 * @throws PretextPdfError('PAGE_LIMIT_EXCEEDED') if pagination would exceed
 *   MAX_PAGES. Usually indicates a pagination bug or content so dense it
 *   cannot fit.
 */
export declare function paginate(blocks: MeasuredBlock[], pageContentHeight: number, config?: PaginateConfig): PaginatedDocument;
/** Get the Y position after all blocks on the current last page */
export declare function getCurrentY(pages: RenderedPage[]): number;
export {};
//# sourceMappingURL=paginate.d.ts.map