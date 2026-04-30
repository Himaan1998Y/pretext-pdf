/** Single source of truth for all element type strings.
 *
 * Imported by: index.ts (re-export), validate.ts (error messages),
 * and eventually plugin-registry.ts (built-in set).
 *
 * Do NOT import from index.ts here — this file must be importable
 * by validate.ts without creating a circular dependency.
 */

export const ELEMENT_TYPES = [
  'paragraph', 'heading', 'spacer', 'table', 'image', 'svg',
  'qr-code', 'barcode', 'chart', 'list', 'hr', 'page-break',
  'code', 'rich-paragraph', 'blockquote', 'toc', 'toc-entry',
  'comment', 'form-field', 'callout', 'footnote-def', 'float-group',
] as const

export type ElementType = typeof ELEMENT_TYPES[number]
