import { PDFDocument } from '@cantoo/pdf-lib';
import type { PdfDocument, Logger } from './types.js';
import type { ImageMap } from './types-internal.js';
import type { PluginDefinition } from './plugin-types.js';
/**
 * Enforce allowedFileDirs: resolved absolute path must start with an allowed dir.
 * No-op when allowedFileDirs is unset (backwards-compatible default).
 */
export declare function assertPathAllowed(resolvedPath: string, allowedDirs: string[] | undefined, label: string): void;
/**
 * Result of resolving a URL: the parsed URL plus the pre-validated IP that
 * downstream fetches should pin to (closing the TOCTOU rebinding window).
 * `ip` is null only for IP-literal hostnames (no DNS lookup performed).
 */
export interface ResolvedSafeUrl {
    url: URL;
    ip: string | null;
    family: 4 | 6 | null;
}
/**
 * Validate that a URL is safe to fetch. Returns the parsed URL and the
 * pre-resolved IP so callers can pin the connection. Throws PretextPdfError
 * if the URL targets a private/internal address.
 */
export declare function resolveAndValidateUrl(url: string, errorCode: 'IMAGE_LOAD_FAILED' | 'SVG_LOAD_FAILED', label: string): Promise<ResolvedSafeUrl>;
/**
 * Back-compat wrapper that drops the resolution result. Kept so existing
 * tests and call sites that only need the validation side-effect still work.
 */
export declare function assertSafeUrl(url: string, errorCode: 'IMAGE_LOAD_FAILED' | 'SVG_LOAD_FAILED', label: string): Promise<void>;
/**
 * Stage 2b: Load and embed all images into pdfDoc.
 * Runs after loadFonts(), receives the same pdfDoc.
 *
 * Image keys are 'img-N' where N is the element's position in doc.content.
 * This makes keys stable and avoids collisions from duplicate src paths.
 *
 * IMPORTANT: @cantoo/pdf-lib image embedding is NOT thread-safe.
 * We load bytes in parallel but embed sequentially.
 *
 * Images that fail to load (network error, file not found, unreachable URL) are
 * logged as warnings but do not crash the document — the document renders without that image.
 */
export declare function loadImages(doc: PdfDocument, pdfDoc: PDFDocument, contentWidth: number, plugins?: PluginDefinition[], logger?: Logger): Promise<ImageMap>;
//# sourceMappingURL=assets.d.ts.map