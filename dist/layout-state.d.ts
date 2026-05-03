/**
 * Layout inspection API — run the pipeline up to pagination without rendering.
 * @internal Not part of the stable public API. Subject to change without a semver bump.
 */
import { PDFDocument } from '@cantoo/pdf-lib';
import type { PdfDocument, RenderOptions } from './types-public.js';
import type { MeasuredBlock, PaginatedDocument, PageGeometry, FontMap, ImageMap } from './types-internal.js';
export interface LayoutState {
    doc: PdfDocument;
    measuredBlocks: MeasuredBlock[];
    paginatedDoc: PaginatedDocument;
    pdfDoc: PDFDocument;
    fontMap: FontMap;
    imageMap: ImageMap;
    pageGeometry: PageGeometry;
}
export interface LayoutTrace {
    document: {
        contentCount: number;
    };
    measuredBlocks: Array<{
        type: string;
        height: number;
        isRTL: boolean;
    }>;
    pages: Array<{
        blockCount: number;
    }>;
}
/**
 * Run pipeline stages 1-4 (validate → init → loadAssets → measure → paginate)
 * without rendering. Returns intermediate state for inspection and testing.
 */
export declare function prepareLayoutState(doc: PdfDocument, options?: RenderOptions): Promise<LayoutState>;
/**
 * Produce a JSON-serializable summary of a LayoutState for debugging and contracts.
 */
export declare function summarizeLayoutState(state: LayoutState): LayoutTrace;
//# sourceMappingURL=layout-state.d.ts.map