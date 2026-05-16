/**
 * pretext-pdf — Internal TypeScript types (pipeline implementation details)
 *
 * These types are used internally by the rendering pipeline (measurement, pagination, rendering).
 * They are NOT exported from index.ts and should not be relied upon by npm consumers.
 * Public schema types live in types-public.ts.
 */

import type { ContentElement, CalloutElement, BlockquoteElement, FootnoteDefElement } from './types-public.js'

/**
 * Internal block element representing a single Table of Contents entry produced by
 * the TOC measurement pass. Not part of the public ContentElement union — users
 * declare TOCs via TocElement, and the pipeline synthesises TocEntryElement
 * instances during measurement.
 */
export interface TocEntryElement {
  type: 'toc-entry'
  text: string
  pageNumber: number
  level: 1 | 2 | 3 | 4
  levelIndent: number
  leader: string
  fontFamily: string
  fontWeight: number
}

/**
 * Resolved geometry for a `callout` block. Always attached to MeasuredBlock when
 * element.type === 'callout'; the invariant is enforced by validateMeasuredBlocks
 * in paginate.ts.
 */
export interface CalloutData {
  titleHeight: number
  paddingH: number
  paddingV: number
  borderColor: string
  backgroundColor: string
  titleColor: string
  color: string
  titleText?: string
}

/** Resolved per-element measurement result from Stage 3 */
export interface MeasuredBlock {
  element: ContentElement | TocEntryElement
  /** Total height in pt (lineCount * lineHeight, spacer.height, table sum, image height, hr height) */
  height: number
  /** Lines from Pretext layoutWithLines(). Empty array for spacers, tables, images, hr, and plugin blocks. */
  lines: PretextLine[]
  /** Resolved font size in pt. 0 for non-text elements and plugin blocks. */
  fontSize: number
  /** Resolved line height in pt. 0 for non-text elements and plugin blocks. */
  lineHeight: number
  /** Key into FontMap, e.g. "Inter-400-normal". '' for non-text elements and plugin blocks. */
  fontKey: string
  /** Resolved space after in pt */
  spaceAfter: number
  /** Resolved space before in pt (headings, lists, tables, images) */
  spaceBefore: number
  // ─── optional payload fields ────────────────────────────────────
  /** Only set when element.type === 'table' */
  tableData?: MeasuredTableData
  /** Only set when element.type === 'image' */
  imageData?: MeasuredImageData
  /** Only set for list item blocks (flattened from ListElement) */
  listItemData?: ListItemData
  // ─── optional payload fields ────────────────────────────────────
  /** Only set when element.type === 'code'. Resolved padding in pt. */
  codePadding?: number
  /** Only set when element.type === 'code' and language is set. Per-line colored tokens. */
  codeHighlightTokens?: Array<Array<{ text: string; color: string }>>
  /** Only set when element.type === 'rich-paragraph'. Mixed-font composed lines. */
  richLines?: RichLine[]
  // ─── Blockquote ────────────────────────────────────────────────
  /** Only set when element.type === 'blockquote'. Resolved vertical padding in pt. */
  blockquotePaddingV?: number
  /** Only set when element.type === 'blockquote'. Resolved horizontal padding in pt. */
  blockquotePaddingH?: number
  /** Only set when element.type === 'blockquote'. Resolved left border width in pt. */
  blockquoteBorderWidth?: number
  // ─── Callout ────────────────────────────────────────────────────
  /**
   * Set by measureBlock for every element.type === 'callout'. Consumers must treat this
   * as required when the element type is callout; `validateMeasuredBlocks` in paginate.ts
   * enforces the invariant (including that every numeric field is a finite number) before
   * any helper reads it. Internal code should prefer the narrowed `MeasuredCalloutBlock`
   * type alias below.
   */
  calloutData?: CalloutData
  // ─── optional payload fields ───────────────────────────────────
  /** Only set when element has columns > 1. Multi-column layout metadata. */
  columnData?: {
    columnCount: number
    columnGap: number
    columnWidth: number
    linesPerColumn: number
  }
  // ─── Image float data ───────────────────────────────────────────────────────
  /** Only set when element.type === 'image' and element.float is set. */
  floatData?: {
    imageKey: string
    imageRenderWidth: number
    imageRenderHeight: number
    imageColX: number
    textColX: number
    textColWidth: number
    textLines: PretextLine[]
    /** Set when the image element uses floatSpans instead of floatText */
    richFloatLines?: RichLine[]
    textFontKey: string
    textFontSize: number
    textLineHeight: number
    textColor: string
  }
  // ─── Float group data ───────────────────────────────────────────────────────
  /** Only set when element.type === 'float-group'. Multi-paragraph float layout. */
  floatGroupData?: {
    imageKey: string
    imageRenderWidth: number
    imageRenderHeight: number
    imageColX: number
    textColX: number
    textColWidth: number
    textItems: Array<{
      lines: PretextLine[]
      richLines?: RichLine[]
      fontSize: number
      lineHeight: number
      fontKey: string
      fontWeight: 400 | 700
      spaceAfter: number
      yOffsetFromTop: number
    }>
    totalTextHeight: number
  }
  // ─── Plugin fields ──────────────────────────────────────────
  /** Only set for plugin element types. Data returned by the plugin's measure hook. */
  pluginData?: unknown
  /** Only set for plugin element types that return a PDFImage from loadAsset. imageMap key. */
  pluginImageKey?: string
  // ─── RTL support ────────────────────────────────────────────
  /** Set to true if this block is RTL (right-to-left text). Used to apply right-align default in render.ts. */
  isRTL?: boolean
  /** Original logical-order text (for debugging / reference). Only set when isRTL=true. */
  logicalText?: string
  // ─── Table of Contents ────────────────────────────────────────
  /** Only set when element.type === 'toc-entry'. Rendering metadata for TOC entries. */
  tocEntryData?: { entryX: number; pageStr: string; leaderChar: string }
  // ─── Form Fields ────────────────────────────────────────────
  /** Only set when element.type === 'form-field'. Layout metadata. */
  formFieldData?: { labelHeight: number; fieldHeight: number }
}

// ─── Post-validation contract types ─────────────────────────────────────────
// The narrowed shapes below are produced by validateMeasuredBlocks in paginate.ts.
// Internal helpers that have verified the invariant hold a narrowed value safely
// without needing defensive runtime checks.

/** A MeasuredBlock whose element is a callout and whose calloutData is guaranteed populated and finite. */
export type MeasuredCalloutBlock = MeasuredBlock & {
  element: CalloutElement
  calloutData: CalloutData
}

/** A MeasuredBlock whose element is a blockquote and whose padding/border fields are guaranteed populated. */
export type MeasuredBlockquoteBlock = MeasuredBlock & {
  element: BlockquoteElement
  blockquotePaddingV: number
  blockquotePaddingH: number
  blockquoteBorderWidth: number
}

/** A single line from Pretext's layoutWithLines() */
export interface PretextLine {
  text: string
  width: number
}

/** A block sliced for a specific page */
export interface PagedBlock {
  measuredBlock: MeasuredBlock
  /** Inclusive start index into measuredBlock.lines[] — for text elements */
  startLine: number
  /** Exclusive end index into measuredBlock.lines[] — for text elements */
  endLine: number
  /** Inclusive index into body rows (non-header rows) — for table elements */
  startRow?: number
  /** Exclusive index into body rows — for table elements */
  endRow?: number
  /** Y offset from top of the page content area in pt */
  yFromTop: number
}

/** One page's worth of content */
export interface RenderedPage {
  pageIndex: number
  blocks: PagedBlock[]
  /** Footnote defs assigned to this page, in order of first ref appearance */
  footnoteItems?: Array<{ def: FootnoteDefElement; number: number }>
  /** Total height reserved at bottom of this page for the footnote zone (pt) */
  footnoteZoneHeight?: number
}

/** Output of Stage 4 paginate() */
export interface PaginatedDocument {
  pages: RenderedPage[]
  totalPages: number
  /** Headings collected during pagination for bookmark generation. */
  headings: Array<{ text: string; level: 1 | 2 | 3 | 4; pageIndex: number }>
  /** Maps footnote def id → 1-based display number (document order) */
  footnoteNumbering?: Map<string, number>
}

/** Resolved page geometry passed between stages */
export interface PageGeometry {
  pageWidth: number
  pageHeight: number
  margins: import('./types-public.js').Margins
  contentWidth: number
  contentHeight: number
  headerHeight: number
  footerHeight: number
}

/** Maps font key → embedded PDFFont reference */
export type FontMap = Map<string, import('@cantoo/pdf-lib').PDFFont>

/** Maps image key → embedded PDFImage reference */
export type ImageMap = Map<string, import('@cantoo/pdf-lib').PDFImage>

// ─── Table measurement types ──────────────────────────────────────────────────

export interface MeasuredTableData {
  /** Resolved column widths in pt */
  columnWidths: number[]
  /** All rows including headers */
  rows: MeasuredTableRow[]
  /** How many rows at the top are header rows */
  headerRowCount: number
  /** Sum of header row heights — used to reserve space on continuation pages */
  headerRowHeight: number
  cellPaddingH: number
  cellPaddingV: number
  borderWidth: number
  borderColor: string
  headerBgColor: string
}

export interface MeasuredTableRow {
  cells: MeasuredTableCell[]
  /** Max cell content height + 2*cellPaddingV */
  height: number
  isHeader: boolean
  /** Column gap indices (0..colCount-2) where vertical lines should be drawn. Gaps spanned by merged cells are excluded. */
  activeBoundaries: number[]
  /** True if any cell in this row spans into the next row — horizontal separator after this row is suppressed */
  hasRowspan?: boolean
}

export interface MeasuredTableCell {
  lines: PretextLine[]
  fontSize: number
  lineHeight: number
  fontKey: string
  fontFamily: string
  align: 'left' | 'center' | 'right'
  color: string
  bgColor?: string
  /** Number of columns this cell spans */
  colspan: number
  /** Total width in pt after colspan expansion, including border-width between spanned columns */
  mergedWidth: number
  /** Number of rows this cell spans. Undefined or 1 = no row span. */
  rowspan?: number
  /** Combined height of all spanned rows in pt. Only set when rowspan > 1. */
  spanHeight?: number
  /** True for placeholder cells inserted in rows below a rowspan origin — skipped in all render passes */
  isSpanPlaceholder?: boolean
  /** RTL text detected in this cell (for alignment defaults) */
  isRTL?: boolean
  /** Render digits at fixed slot width for column alignment */
  tabularNumbers?: boolean
}

// ─── Image measurement types ──────────────────────────────────────────────────

export interface MeasuredImageData {
  /** Key into ImageMap, e.g. 'img-3' */
  imageKey: string
  /** Final render width in pt */
  renderWidth: number
  /** Final render height in pt */
  renderHeight: number
  align: 'left' | 'center' | 'right'
}

// ─── List item data ───────────────────────────────────────────────────────────

export interface ListItemData {
  /** Marker string, e.g. "•" or "1." */
  marker: string
  /** Left indent in pt before the marker */
  indent: number
  /** Width of marker column in pt — body text starts after this */
  markerWidth: number
  /** Resolved text color (hex) for this item */
  color: string
  /** Resolved font weight for this item */
  fontWeight: 400 | 700
}

// ─── Rich text types ──────────────────────────────────────────────────────────

/** A composed line from the rich-text compositor — contains multiple styled fragments */
export interface RichLine {
  fragments: RichFragment[]
  /** Total line content width in pt */
  totalWidth: number
  /** Height of this line in pt. Computed as max(fragment.fontSize) * lineHeightRatio */
  lineHeight: number
}

/** A single styled run within a RichLine */
export interface RichFragment {
  text: string
  fontKey: string
  fontSize: number
  color: string
  /** x-offset from the left edge of the text area in pt */
  x: number
  /** Fragment width in pt */
  width: number
  underline?: boolean
  strikethrough?: boolean
  url?: string
  href?: string
  /** Vertical baseline shift in pt. Positive = up (superscript), negative = down (subscript) */
  yOffset?: number
  /** Carried from InlineSpan.footnoteRef — used by renderer to identify footnote refs */
  footnoteRef?: string
  /** Extra spacing between characters in pt. Carried from InlineSpan.letterSpacing. */
  letterSpacing?: number
}
