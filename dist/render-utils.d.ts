/**
 * render-utils.ts — Pure utility functions for PDF rendering
 * No element-type knowledge. Used by all render modules.
 */
import { PDFDocument, PDFFont, PDFRef, rgb } from '@cantoo/pdf-lib';
/**
 * Draw a single line of text with justified alignment.
 * Spaces between words are stretched so the line fills availableWidth.
 * The last line of a paragraph is left-aligned (standard typographic convention).
 */
export declare function drawJustifiedLine(pdfPage: ReturnType<PDFDocument['addPage']>, lineText: string, isLastLine: boolean, x: number, pdfY: number, availableWidth: number, fontSize: number, pdfFont: PDFFont, color: ReturnType<typeof rgb>): void;
/**
 * Adds a clickable URI annotation over a rendered text region.
 * Must be called after drawText() — annotation sits above the text layer.
 */
export declare function addLinkAnnotation(pdfDoc: PDFDocument, pdfPage: ReturnType<PDFDocument['addPage']>, x: number, pdfY: number, width: number, fontSize: number, url: string): void;
/**
 * Adds a clickable internal anchor link (GoTo) annotation over a rendered text region.
 * Jumps to a page with a named destination when clicked.
 * Must be called after drawText() — annotation sits above the text layer.
 */
export declare function addGoToAnnotation(pdfDoc: PDFDocument, pdfPage: ReturnType<PDFDocument['addPage']>, x: number, pdfY: number, width: number, fontSize: number, destPageRef: PDFRef, destPdfY: number): void;
/**
 * Adds a sticky-note (Text) annotation at the given position.
 */
export declare function addStickyNoteAnnotation(pdfDoc: PDFDocument, pdfPage: ReturnType<PDFDocument['addPage']>, x: number, pdfY: number, contents: string, author?: string, color?: string, open?: boolean): void;
/**
 * Draws underline and/or strikethrough lines for a rendered text segment.
 * Must be called AFTER drawText() so text renders on top of any decoration line.
 */
export declare function drawTextDecoration(pdfPage: ReturnType<PDFDocument['addPage']>, x: number, width: number, pdfY: number, fontSize: number, pdfFont: PDFFont, color: [number, number, number], decoration: {
    underline: boolean;
    strikethrough: boolean;
}): void;
/**
 * Draw text with tabular (monospaced) digit spacing.
 * Each digit occupies a fixed slot = widest digit glyph in the font at the given size.
 * Non-digit characters render at their natural width.
 *
 * First-principle rationale: proportional fonts vary digit widths (1 is narrower than 0).
 * Tabular mode normalises all digits to the same advance, so columns of numbers
 * align perfectly with no font-specific OpenType tables required.
 */
export declare function drawTabularText(pdfPage: ReturnType<PDFDocument['addPage']>, text: string, x: number, pdfY: number, fontSize: number, pdfFont: PDFFont, color: ReturnType<typeof rgb>): void;
/**
 * THE ONLY place where top-down coords are converted to pdf-lib bottom-up coords.
 * @param yFromTop - distance from top of page in pt
 * @param elementHeight - height of the element (font baseline offset, image height, etc.)
 * @param pageHeight - total page height in pt
 */
export declare function toPdfY(yFromTop: number, elementHeight: number, pageHeight: number): number;
/** Resolve text horizontal position based on alignment */
export declare function resolveX(align: 'left' | 'center' | 'right', startX: number, availableWidth: number, lineWidth: number): number;
/** Default body line height multiplier — paragraphs, lists, blockquotes, footnotes, TOC */
export declare const LINE_HEIGHT_BODY = 1.5;
/** Default compact line height multiplier — headings, code blocks, callout titles */
export declare const LINE_HEIGHT_COMPACT = 1.4;
/** Replace {{pageNumber}}, {{totalPages}}, {{date}}, and {{author}} tokens */
export declare function resolveTokens(text: string, pageNumber: number, totalPages: number, extra?: {
    date?: string;
    author?: string;
}): string;
/** Parse a 6-digit hex color string to normalized RGB [0,1] triple.
 *  Falls back to black on invalid/missing input to prevent NaN from reaching pdf-lib. */
export declare function hexToRgb(hex: string | null | undefined): [number, number, number];
//# sourceMappingURL=render-utils.d.ts.map