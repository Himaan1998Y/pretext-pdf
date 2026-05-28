/**
 * pdf-lib-augment.d.ts — Documentation and type shims for pdf-lib internals used by pretext-pdf
 *
 * Notes on pdf-lib usage:
 *
 * 1. PDFArray.push() — Used to append annotations to existing annotation arrays.
 *    PDFArray is exported from @cantoo/pdf-lib; instanceof checks guard annotation push
 *    operations in render-utils.ts. No cast needed for this anymore.
 *
 * 2. PDFFont.embedder — Private property containing fontkit font metrics
 *    (underlinePosition, underlineThickness, xHeight, scale).
 *    Accessed via typed cast in render-utils.ts using PdfFontEmbedder below
 *    to enable proper text decoration (underline/strikethrough) rendering.
 *
 * 3. PDFContext.obj() — Creates PDFObjects from arbitrary values.
 *    Not strictly typed in pdf-lib's public API.
 *
 * 4. PDFDocument.getInfoDict() — Internal method to access the PDF Info dictionary.
 *    Used in pipeline.ts for setting metadata via PDFHexString.fromText().
 *    Accessed via (pdfDoc as unknown as { getInfoDict(): PDFDict }).getInfoDict().
 *
 * These internal APIs are stable across @cantoo/pdf-lib versions but are not part of the
 * public api-stable contract. Fallbacks exist wherever they are used.
 */

/** Shape of the fontkit embedder attached to a PDFFont by pdf-lib's EmbeddedFontFactory. */
export interface PdfFontEmbedder {
  /** The underlying fontkit Font object (undefined for the standard 14 fonts). */
  font?: {
    /** Underline stroke position relative to baseline in font units (typically negative). */
    underlinePosition: number
    /** Underline stroke thickness in font units. */
    underlineThickness: number
    /** x-height: distance from baseline to top of lowercase 'x', in font units. */
    xHeight: number
  }
  /** Units-per-em scale factor (typically 1/1000 for TrueType/OpenType). */
  scale: number
}

export {}
