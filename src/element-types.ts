/**
 * All supported element type strings — single source of truth.
 *
 * Use this array to enumerate valid element types without string literals.
 * Imported by validate.ts for error messages and by the MCP server for the
 * drift guard. Do NOT import from index.ts here (circular dep risk).
 *
 * @public
 */
export const ELEMENT_TYPES = [
  'paragraph', 'heading', 'spacer', 'table', 'image', 'svg',
  'qr-code', 'barcode', 'chart', 'list', 'hr', 'page-break',
  'code', 'rich-paragraph', 'blockquote', 'toc', 'toc-entry',
  'comment', 'form-field', 'callout', 'footnote-def', 'float-group',
] as const

/**
 * Union of all valid element type strings.
 * @public
 */
export type ElementType = typeof ELEMENT_TYPES[number]
