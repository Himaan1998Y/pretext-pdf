/**
 * render-blocks.ts — Element-level rendering functions
 * All the specific renderer functions for different content types.
 */
import { PDFDocument } from '@cantoo/pdf-lib';
import type { FootnoteDefElement, HeaderFooterSpec, PdfDocument } from './types.js';
import type { PagedBlock, FontMap, ImageMap, PageGeometry } from './types-internal.js';
export declare function renderTextBlock(pdfPage: ReturnType<PDFDocument['addPage']>, pagedBlock: PagedBlock, geo: PageGeometry, fontMap: FontMap, pdfDoc: PDFDocument): void;
export declare function renderListItem(pdfPage: ReturnType<PDFDocument['addPage']>, pagedBlock: PagedBlock, geo: PageGeometry, fontMap: FontMap): void;
export declare function renderTable(pdfPage: ReturnType<PDFDocument['addPage']>, pagedBlock: PagedBlock, geo: PageGeometry, fontMap: FontMap): void;
export declare function renderImage(pdfPage: ReturnType<PDFDocument['addPage']>, pagedBlock: PagedBlock, geo: PageGeometry, imageMap: ImageMap): void;
export declare function renderFloatBlock(pdfPage: ReturnType<PDFDocument['addPage']>, pagedBlock: PagedBlock, geo: PageGeometry, fontMap: FontMap, imageMap: ImageMap, pdfDoc: PDFDocument): void;
export declare function renderFloatGroup(pdfPage: ReturnType<PDFDocument['addPage']>, pagedBlock: PagedBlock, geo: PageGeometry, fontMap: FontMap, imageMap: ImageMap, pdfDoc: PDFDocument): void;
export declare function renderHR(pdfPage: ReturnType<PDFDocument['addPage']>, pagedBlock: PagedBlock, geo: PageGeometry): void;
export declare function renderCodeBlock(pdfPage: ReturnType<PDFDocument['addPage']>, pagedBlock: PagedBlock, geo: PageGeometry, fontMap: FontMap): void;
export declare function renderBlockquote(pdfPage: ReturnType<PDFDocument['addPage']>, pagedBlock: PagedBlock, geo: PageGeometry, fontMap: FontMap): void;
export declare function renderCallout(pdfPage: ReturnType<PDFDocument['addPage']>, pagedBlock: PagedBlock, geo: PageGeometry, fontMap: FontMap): void;
export declare function renderRichParagraph(pdfPage: ReturnType<PDFDocument['addPage']>, pagedBlock: PagedBlock, geo: PageGeometry, fontMap: FontMap, pdfDoc: PDFDocument, footnoteNumbering?: Map<string, number>): void;
export declare function renderFootnoteZone(pdfPage: ReturnType<PDFDocument['addPage']>, footnoteItems: Array<{
    def: FootnoteDefElement;
    number: number;
}>, zoneHeight: number, fontMap: FontMap, doc: PdfDocument, geo: PageGeometry): void;
export declare function renderHeaderFooter(pdfPage: ReturnType<PDFDocument['addPage']>, spec: HeaderFooterSpec, pageNumber: number, totalPages: number, geo: PageGeometry, fontMap: FontMap, position: 'header' | 'footer', extra?: {
    date?: string;
    author?: string;
}): void;
export declare function renderWatermark(pdfPage: ReturnType<PDFDocument['addPage']>, doc: PdfDocument, fontMap: FontMap, imageMap: ImageMap, geo: PageGeometry): void;
//# sourceMappingURL=render-blocks.d.ts.map