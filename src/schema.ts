/**
 * pretext-pdf — Machine-readable JSON Schema for PdfDocument
 *
 * Exported via the `pretext-pdf/schema` entry point. Intended for editor
 * tooling, MCP clients, and Smithery UI form generation.
 *
 * Usage:
 *   import { pdfDocumentSchema } from 'pretext-pdf/schema'
 *
 * Implementation is split across src/schema/:
 *   shared.ts          — atomic sub-schemas (color, align, font-weight, etc.)
 *   elements-text.ts   — paragraph, heading, list, blockquote, code, callout, rich-paragraph, toc, footnote-def
 *   elements-media.ts  — image, svg, qr-code, barcode, chart
 *   elements-block.ts  — spacer, hr, page-break, comment, form-field, float-group
 *   elements-table.ts  — table
 *   document.ts        — top-level pdfDocumentSchema (assembles all element schemas)
 */

export { pdfDocumentSchema } from './schema/document.js'
