import { PDFDocument } from '@cantoo/pdf-lib';
import type { PdfDocument, Logger } from './types.js';
import type { PaginatedDocument, FontMap, ImageMap, PageGeometry } from './types-internal.js';
import type { PluginDefinition } from './plugin-types.js';
/**
 * Stage 5: Render.
 * Takes the paginated document + pre-initialized pdfDoc (with fonts already embedded)
 * and produces the final PDF bytes.
 *
 * pdfDoc is NOT created here — it comes from index.ts with fonts already embedded.
 * imageMap contains pre-embedded PDFImage instances.
 */
export declare function renderDocument(paginatedDoc: PaginatedDocument, doc: PdfDocument, fontMap: FontMap, imageMap: ImageMap, pdfDoc: PDFDocument, geo: PageGeometry, plugins?: PluginDefinition[], logger?: Logger): Promise<Uint8Array>;
//# sourceMappingURL=render.d.ts.map