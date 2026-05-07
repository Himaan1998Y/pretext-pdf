import { PDFDocument } from '@cantoo/pdf-lib';
import type { PdfDocument, RenderOptions } from './types-public.js';
import type { PageGeometry, FontMap, ImageMap, MeasuredBlock } from './types-internal.js';
import { runFootnoteTwoPass } from './pipeline-footnotes.js';
export declare function stageValidate(doc: PdfDocument, options?: RenderOptions): void;
export declare function stageInit(doc: PdfDocument): Promise<{
    pdfDoc: PDFDocument;
    geo: Omit<PageGeometry, 'contentHeight' | 'headerHeight' | 'footerHeight'>;
    defaultFont: string;
}>;
export declare function stageLoadAssets(doc: PdfDocument, pdfDoc: PDFDocument, contentWidth: number, plugins?: import('./plugin-types.js').PluginDefinition[], logger?: import('./types-public.js').Logger): Promise<{
    fontMap: FontMap;
    imageMap: ImageMap;
}>;
export declare function stageFinalizeGeo(doc: PdfDocument, partialGeo: Omit<PageGeometry, 'contentHeight' | 'headerHeight' | 'footerHeight'>, defaultFont: string): Promise<PageGeometry>;
export declare function stageMeasure(doc: PdfDocument, contentWidth: number, imageMap: ImageMap, contentHeight: number, plugins?: import('./plugin-types.js').PluginDefinition[]): Promise<MeasuredBlock[]>;
export declare function stagePaginate(measuredBlocks: MeasuredBlock[], contentHeight: number, doc: PdfDocument): ReturnType<typeof runFootnoteTwoPass>;
export declare function stageRender(paginatedDoc: ReturnType<typeof stagePaginate>, doc: PdfDocument, fontMap: FontMap, imageMap: ImageMap, pdfDoc: PDFDocument, geo: PageGeometry, plugins?: import('./plugin-types.js').PluginDefinition[], logger?: import('./types-public.js').Logger): Promise<Uint8Array>;
/**
 * Run all 5 stages in sequence and return raw PDF bytes.
 * Post-processing (signature, encryption) is applied by the public render() in index.ts.
 */
export declare function runPipeline(doc: PdfDocument, options?: RenderOptions): Promise<Uint8Array>;
//# sourceMappingURL=pipeline.d.ts.map