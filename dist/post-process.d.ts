import type { PdfDocument } from './types-public.js';
/**
 * Apply PKCS#7 digital signature to pre-rendered PDF bytes.
 * Requires the @signpdf/signpdf peer dependency.
 */
export declare function applySignature(pdfBytes: Uint8Array, sig: NonNullable<PdfDocument['signature']>, allowedFileDirs?: string[]): Promise<Uint8Array>;
/**
 * Apply AES-128 or AES-256 encryption to pre-rendered PDF bytes.
 */
export declare function applyEncryption(pdfBytes: Uint8Array, enc: NonNullable<PdfDocument['encryption']>): Promise<Uint8Array>;
/**
 * Apply signature and encryption post-processing to raw pipeline bytes.
 * Called by both render() in index.ts and PdfBuilder.build() in builder.ts.
 */
export declare function applyPostProcessing(rawBytes: Uint8Array, doc: PdfDocument): Promise<Uint8Array>;
//# sourceMappingURL=post-process.d.ts.map