/**
 * render-extras.ts — PDF structure rendering (bookmarks, TOC, forms, signatures)
 * These are meta-layer concerns distinct from content block rendering.
 */
import { PDFDocument } from '@cantoo/pdf-lib';
import type { PaginatedDocument, FontMap, PageGeometry, PagedBlock } from './types-internal.js';
/**
 * Build PDF outline (bookmarks/TOC) from heading entries.
 * Creates a doubly-linked tree in the PDF catalog.
 * Must be called after all pages are rendered but before pdfDoc.save().
 */
export declare function buildOutlineTree(pdfDoc: PDFDocument, headings: PaginatedDocument['headings'], bookmarkConfig: import('./types.js').PdfDocument['bookmarks']): void;
export declare function renderTocEntry(pdfPage: ReturnType<PDFDocument['addPage']>, pagedBlock: PagedBlock, geo: PageGeometry, fontMap: FontMap): void;
/** Render an interactive AcroForm field. */
export declare function renderFormField(block: PagedBlock, pdfPage: ReturnType<PDFDocument['addPage']>, pdfDoc: PDFDocument, fontMap: FontMap, geo: PageGeometry, yFromTop: number): void;
/** Draw a visual signature placeholder box on the specified page. */
export declare function renderSignaturePlaceholder(sig: import('./types.js').SignatureSpec, pdfDoc: PDFDocument, fontMap: import('./types-internal.js').FontMap, geo: import('./types-internal.js').PageGeometry): void;
//# sourceMappingURL=render-extras.d.ts.map