import type { PdfDocument } from './types-public.js';
import type { MeasuredBlock } from './types-internal.js';
/**
 * Two-pass TOC entry building.
 *
 * Pass 1: draft pagination to collect heading page numbers.
 * Splices real TOC entry blocks into measuredBlocks at the placeholder index.
 * Returns the updated measuredBlocks array (new reference, original untouched).
 */
export declare function runTocTwoPass(measuredBlocks: MeasuredBlock[], doc: Pick<PdfDocument, 'content' | 'defaultFont'> & Partial<PdfDocument>, contentWidth: number, contentHeight: number): Promise<MeasuredBlock[]>;
//# sourceMappingURL=pipeline-toc.d.ts.map