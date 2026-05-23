/**
 * pretext-pdf — Structural / block-layout element types.
 *
 * Table (+ColumnDef, TableRow, TableCell), List (+ListItem), HR, PageBreak,
 * Spacer, Toc, FootnoteDef, Comment, FormField.
 */

// ─── Spacer ───────────────────────────────────────────────────────────────────

/** @public */
export interface SpacerElement {
  type: 'spacer'
  /** Height in pt */
  height: number
}

// ─── Table ────────────────────────────────────────────────────────────────────

/** @public */
export interface TableElement {
  type: 'table'
  columns: ColumnDef[]
  rows: TableRow[]
  /** Default text direction for all cells. Cells can override individually. Default: 'auto' */
  dir?: 'ltr' | 'rtl' | 'auto'
  /** Number of rows treated as headers (repeated on continuation pages). Default: auto-detect rows with isHeader: true */
  headerRows?: number
  /** Border color (hex). Default: '#cccccc' */
  borderColor?: string
  /** Border thickness in pt. Default: 0.5 */
  borderWidth?: number
  /** Background color for header rows (hex). Default: '#f5f5f5' */
  headerBgColor?: string
  /** Cell font size in pt. Default: document.defaultFontSize */
  fontSize?: number
  /** Horizontal cell padding in pt. Default: 8 */
  cellPaddingH?: number
  /** Vertical cell padding in pt. Default: 6 */
  cellPaddingV?: number
  /** Space below table in pt. Default: 0 */
  spaceAfter?: number
  /** Space above table in pt. Default: 0 */
  spaceBefore?: number
}

/** @public */
export interface ColumnDef {
  /** Fixed pt (e.g. 80), proportional fraction (e.g. '2*' or '*'), or 'auto' (shrink-to-content). */
  width: number | string
  /** Column default text alignment. Default: 'left' */
  align?: 'left' | 'center' | 'right'
}

/** @public */
export interface TableRow {
  cells: TableCell[]
  /** Mark row as a header (styled + repeated on continuation pages). Default: false */
  isHeader?: boolean
}

/** @public */
export interface TableCell {
  text: string
  /** Text direction: 'ltr', 'rtl', or 'auto'. Default: 'auto' */
  dir?: 'ltr' | 'rtl' | 'auto'
  /** Overrides column alignment for this cell */
  align?: 'left' | 'center' | 'right'
  fontWeight?: 400 | 700
  /** Font family override for this cell. Default: document.defaultFont */
  fontFamily?: string
  /** Font size override for this cell in pt. Default: table.fontSize ?? document.defaultFontSize */
  fontSize?: number
  /** Text color (hex). Default: '#000000' */
  color?: string
  /** Cell background color (hex). Optional — overrides row/table default. */
  bgColor?: string
  /** Number of columns this cell spans. Default: 1 */
  colspan?: number
  /** Number of rows this cell spans. Default: 1 */
  rowspan?: number
  /**
   * Render digits (0–9) at a fixed slot width (widest digit in font).
   * Ensures numeric columns align regardless of digit width variation (1 vs 0 etc.).
   */
  tabularNumbers?: boolean
}

// ─── List ─────────────────────────────────────────────────────────────────────

/** @public */
export interface ListElement {
  type: 'list'
  /** 'ordered' = "1. 2. 3.", 'unordered' = bullet point */
  style: 'ordered' | 'unordered'
  items: ListItem[]
  /** Custom marker for unordered lists. Default: '•' */
  marker?: string
  /** Left indent in pt. Default: 20 */
  indent?: number
  /** Width reserved for marker column in pt. Default: 20 */
  markerWidth?: number
  /** Font size in pt. Default: document.defaultFontSize */
  fontSize?: number
  /** Line height in pt. Default: fontSize * 1.5 */
  lineHeight?: number
  /** Space between list items in pt. Default: 4 */
  itemSpaceAfter?: number
  /** Space below the entire list in pt. Default: 0 */
  spaceAfter?: number
  /** Space above the entire list in pt. Default: 0 */
  spaceBefore?: number
  /** Text color for all list items (hex). Default: '#000000' */
  color?: string
  /**
   * For ordered lists with nested items: how nested item counters behave.
   * 'continue' — nested items continue the parent counter (1, 2, 3, 4...).
   * 'restart'  — nested items restart at 1, parent counter is unaffected.
   * Default: 'continue'
   */
  nestedNumberingStyle?: 'continue' | 'restart'
}

/** @public */
export interface ListItem {
  text: string
  /** Text direction: 'ltr', 'rtl', or 'auto'. Default: 'auto' */
  dir?: 'ltr' | 'rtl' | 'auto'
  /** Font weight for this item. Default: 400 */
  fontWeight?: 400 | 700
  /** Nested items — up to 2 levels deep. */
  items?: ListItem[]
}

// ─── Horizontal Rule ──────────────────────────────────────────────────────────

/** @public */
export interface HorizontalRuleElement {
  type: 'hr'
  /** Line thickness in pt. Default: 0.5 */
  thickness?: number
  /** Line color (hex). Default: '#cccccc' */
  color?: string
  /** Space above line in pt. Default: 12. Alias: spaceBefore */
  spaceAbove?: number
  /** Space below line in pt. Default: 12. Alias: spaceAfter */
  spaceBelow?: number
  /** Alias for spaceAbove — consistent with paragraph/heading naming */
  spaceBefore?: number
  /** Alias for spaceAfter — consistent with paragraph/heading naming */
  spaceAfter?: number
}

// ─── Page Break ───────────────────────────────────────────────────────────────

/**
 * Forces a page break at this position. No-op if already at the top of a page.
 * @public
 */
export interface PageBreakElement {
  type: 'page-break'
}

// ─── TOC ──────────────────────────────────────────────────────────────────────

/** @public */
export interface TocElement {
  type: 'toc'
  /** TOC title. Default: 'Table of Contents' */
  title?: string
  /** Whether to show the title. Default: true */
  showTitle?: boolean
  /** Minimum heading level to include. Default: 1 */
  minLevel?: 1 | 2 | 3 | 4
  /** Maximum heading level to include. Default: 3 */
  maxLevel?: 1 | 2 | 3 | 4
  /** Font size for TOC entries. Default: doc.defaultFontSize */
  fontSize?: number
  /** Font size for TOC title. Default: fontSize + 4 */
  titleFontSize?: number
  /** Indentation per level in pt. Default: 16 */
  levelIndent?: number
  /** Leader character between entry text and page number. Default: '.' */
  leader?: string
  /** Space after each entry line in pt. Default: 4 */
  entrySpacing?: number
  /** Font family for TOC. Default: doc.defaultFont */
  fontFamily?: string
  /** Space before the entire TOC section. Default: 0 */
  spaceBefore?: number
  /** Space after the entire TOC section. Default: 0 */
  spaceAfter?: number
}

// ─── Footnote Definition ──────────────────────────────────────────────────────

/**
 * Defines a footnote. Placed anywhere in doc.content — order doesn't matter.
 * Rendered at the bottom of the page that contains the matching footnoteRef span.
 * @public
 */
export interface FootnoteDefElement {
  type: 'footnote-def'
  /** Unique identifier matched by InlineSpan.footnoteRef */
  id: string
  /** The footnote text rendered at the bottom of the page */
  text: string
  /** Font size in pt. Default: doc.defaultFontSize - 2 */
  fontSize?: number
  /** Font family. Default: doc.defaultFont */
  fontFamily?: string
  /** Space after the footnote def in pt. Default: 4 */
  spaceAfter?: number
}

// ─── Comment ──────────────────────────────────────────────────────────────────

/** @public */
export interface CommentElement {
  type: 'comment'
  /** Popup text content. Required. */
  contents: string
  /** Author name. Optional. */
  author?: string
  /** Color as 6-digit hex. Default: '#FFFF00' */
  color?: string
  /** Whether popup is open by default. Default: false */
  open?: boolean
  /** Extra space below in pt. Default: 0 */
  spaceAfter?: number
}

// ─── Form Field ───────────────────────────────────────────────────────────────

/** @public */
export interface FormFieldElement {
  type: 'form-field'
  /** AcroForm field type. */
  fieldType: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'button'
  /** Unique field name within the document. Required. */
  name: string
  /** Label text rendered above the interactive field. Optional. */
  label?: string
  // Text field options:
  /** Placeholder text for text fields. */
  placeholder?: string
  /** Pre-filled default value for text fields. */
  defaultValue?: string
  /** Makes text field multi-line. Default: false */
  multiline?: boolean
  /** Maximum character length for text fields. */
  maxLength?: number
  // Checkbox:
  /** Initial checked state for checkboxes. Default: false */
  checked?: boolean
  // Radio / Dropdown:
  /** Option list for radio groups and dropdowns. */
  options?: Array<{ value: string; label: string }>
  /** Pre-selected value for radio groups and dropdowns. */
  defaultSelected?: string
  // Layout:
  /** Field width in pt. Default: full content width */
  width?: number
  /** Field height in pt. Default: auto per fieldType (text=24, multiline=60, radio=20×options, others=24) */
  height?: number
  /** Font size for field text in pt. Default: doc.defaultFontSize */
  fontSize?: number
  /** Field border color as 6-digit hex. Default: '#999999' */
  borderColor?: string
  /** Field background color as 6-digit hex. Default: '#FFFFFF' */
  backgroundColor?: string
  /** Extra space below this field in pt. Default: 8 */
  spaceAfter?: number
  /** Extra space above this field in pt. Default: 0 */
  spaceBefore?: number
  /** If true, never break this element across pages. Default: true */
  keepTogether?: boolean
}
