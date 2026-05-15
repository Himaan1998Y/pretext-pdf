/**
 * pdf-lib-augment.d.ts — Documentation of pdf-lib internals used by pretext-pdf
 *
 * Notes on pdf-lib usage:
 *
 * 1. PDFArray.push() — Used to append annotations to existing annotation arrays.
 *    Not exposed in public types, accessed via `as any` in render-utils.ts
 *
 * 2. PDFFont.embedder — Private property containing fontkit font metrics
 *    (underlinePosition, underlineThickness, xHeight, scale).
 *    Accessed via `(pdfFont as any).embedder` in render-utils.ts
 *    to enable proper text decoration rendering.
 *
 * 3. PDFContext.obj() — Creates PDFObjects from arbitrary values.
 *    Not strictly typed in pdf-lib's public API.
 *
 * These internal APIs are stable and load-bearing on annotation rendering
 * and font metric extraction. They are not part of the public api-stable
 * contract, but have been stable across pdf-lib versions.
 */

export {}
