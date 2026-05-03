import type { PdfDocument, RenderOptions, ValidationResult, Logger } from './types.js';
/**
 * Validate a PdfDocument and throw a {@link PretextPdfError} if any errors are found.
 * @public
 */
export declare function validate(doc: PdfDocument, options?: RenderOptions): void;
/**
 * Validate a pretext-pdf document and return a structured result instead of throwing.
 *
 * Use this when you want to inspect all validation errors programmatically.
 * The existing {@link validate} function throws on first error and is unchanged.
 *
 * @param doc - The document to validate (typed as `unknown` to accept unverified input)
 * @param options - `{ strict?: boolean; logger?: Logger }` — strict defaults to false (matches render() behavior); logger routes diagnostic warnings away from console.warn
 * @returns {@link ValidationResult} with `valid`, `errors[]`, and `errorCount`
 * @public
 */
export declare function validateDocument(doc: unknown, options?: {
    strict?: boolean;
    logger?: Logger;
}): ValidationResult;
//# sourceMappingURL=validate.d.ts.map