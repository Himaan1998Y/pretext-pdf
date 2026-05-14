import { PDFDocument } from '@cantoo/pdf-lib';
import type { PdfDocument, Logger } from './types.js';
import type { ImageMap } from './types-internal.js';
import type { PluginDefinition } from './plugin-types.js';
/**
 * Enforce allowedFileDirs: resolved absolute path must start with an allowed dir.
 * No-op when allowedFileDirs is unset (backwards-compatible default).
 */
export declare function assertPathAllowed(resolvedPath: string, allowedDirs: string[] | undefined, label: string): void;
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