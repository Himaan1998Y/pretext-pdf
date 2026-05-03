import { PDFDocument } from '@cantoo/pdf-lib';
import type { PdfDocument } from './types.js';
import type { FontMap } from './types-internal.js';
/**
 * Stage 2: Load and embed all fonts.
 * - Scans document for all font references
 * - Loads font bytes (file system or Uint8Array)
 * - Embeds each into pdfDoc via fontkit
 * - Returns FontMap for use in measure + render stages
 *
 * NOTE: pdfDoc is already created by the caller. Fonts are embedded into it here.
 * The same pdfDoc is used in Stage 5 (render).
 */
export declare function loadFonts(doc: PdfDocument, pdfDoc: PDFDocument): Promise<FontMap>;
/**
 * Walk all content elements + header/footer and collect text strings grouped by font key.
 * Used by font subsetting to determine which glyphs each font needs.
 *
 * Returns: Map<fontKey, concatenated text string>
 */
export declare function collectTextByFont(doc: PdfDocument): Map<string, string>;
//# sourceMappingURL=fonts.d.ts.map