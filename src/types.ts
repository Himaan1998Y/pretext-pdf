/**
 * pretext-pdf — Public and internal TypeScript types
 */
import type { NamedPageSize } from './page-sizes.js'

// ─── Public Input Types ───────────────────────────────────────────────────────

/** Top-level document descriptor. Named PdfDocument to avoid clash with browser window.Document */
export interface PdfDocument {
  /** Page size. Default: 'A4' (595×842 pt). Custom: [width, height] in pt. */
  pageSize?: NamedPageSize | [number, number]
  /** Page margins in pt. Default: all 72pt (1 inch). */
  margins?: Partial<Margins>
  /** Default font family for body text. Default: 'Inter' */
  defaultFont?: string
  /** Default font size in pt. Default: 12 */
  defaultFontSize?: number
  /** Default line height in pt. Default: fontSize * 1.5 */
  defaultLineHeight?: number
  /** Custom fonts to load and embed. Inter 400 is always available without specifying. */
  fonts?: FontSpec[]
  /** Header rendered at top of every page. Supports {{pageNumber}} and {{totalPages}}. */
  header?: HeaderFooterSpec
  /** Footer rendered at bottom of every page. Supports {{pageNumber}} and {{totalPages}}. */
  footer?: HeaderFooterSpec
  /** Watermark overlay rendered on every page behind content. Text or image. */
  watermark?: WatermarkSpec
  /** Password protection and permission control for the output PDF. */
  encryption?: EncryptionSpec
  /** Visual signature placeholder drawn on the specified page. */
  signature?: SignatureSpec
  /** PDF bookmark outline (sidebar navigation). Defaults to enabled. Set to false to disable bookmarks entirely. */
  bookmarks?: false | BookmarkConfig
  /** Automatic word hyphenation using Liang's algorithm. Requires installing the matching `hyphenation.XX` npm package. */
  hyphenation?: HyphenationConfig
  /** PDF document metadata written into the file's properties. */
  metadata?: DocumentMetadata
  /**
   * Default style applied to every paragraph and heading that does not
   * explicitly set the field. Explicit element-level values always win.
   */
  defaultParagraphStyle?: {
    fontSize?: number
    lineHeight?: number
    fontFamily?: string
    fontWeight?: 400 | 700
    color?: string
    align?: 'left' | 'center' | 'right' | 'justify'
    letterSpacing?: number
    spaceBefore?: number
    spaceAfter?: number
  }
  /**
   * Page-range overrides for header/footer. Sections are matched by page number
   * (1-based). The first matching section wins. Falls back to doc.header/footer.
   */
  sections?: Array<{
    /** First page this section applies to (1-based, inclusive). Default: 1 */
    fromPage?: number
    /** Last page this section applies to (1-based, inclusive). Default: Infinity */
    toPage?: number
    header?: PdfDocument['header']
    footer?: PdfDocument['footer']
  }>
  /** Document content elements, rendered top-to-bottom. */
  content: ContentElement[]
  /** If true, flatten all form fields into static content (no longer interactive). Default: false */
  flattenForms?: boolean
  /**
   * Called when an image fails to load (file not found, URL error, embed failure).
   * Return 'skip' to silently omit the image (default behavior).
   * Return 'throw' to abort rendering with the original error.
   * If omitted, failures are logged as warnings and the image is skipped.
   */
  onImageLoadError?: (src: string | Uint8Array, error: Error) => 'skip' | 'throw'
  /**
   * Called when a form field fails to render (field type error, font missing, etc.).
   * Return 'skip' to silently omit the field.
   * Return 'throw' to abort rendering with the original error.
   * If omitted, failures are logged as warnings and the field is skipped.
   */
  onFormFieldError?: (fieldName: string | undefined, error: Error) => 'skip' | 'throw'
  /**
   * Document creation date written into PDF metadata.
   * Accepts an ISO 8601 string or a Date object. Default: current date/time.
   */
  renderDate?: string | Date
  /**
   * Restrict filesystem access to these absolute directory paths.
   * When set, any image/SVG/font `src` pointing outside these directories
   * throws PATH_TRAVERSAL. Strongly recommended when src values originate
   * from user-controlled input to prevent arbitrary file reads.
   *
   * Example: `allowedFileDirs: ['/app/assets', '/tmp/uploads']`
   */
  allowedFileDirs?: string[]
}

export interface DocumentMetadata {
  /** Document title shown in PDF viewer title bar. */
  title?: string
  /** Author name. */
  author?: string
  /** Subject / description. */
  subject?: string
  /** Searchable keywords. */
  keywords?: string[]
  /** Producing application name. Default: 'pretext-pdf' */
  creator?: string
  /** BCP47 language tag e.g. 'en-US', 'hi', 'ar'. Sets the PDF /Lang catalog attribute for accessibility. */
  language?: string
  /** PDF producer field shown in document properties e.g. 'MyApp v2.1'. */
  producer?: string
}

export interface Margins {
  top: number
  bottom: number
  left: number
  right: number
}

export interface FontSpec {
  /** Font family name, e.g. 'Roboto'. Used in fontFamily fields. */
  family: string
  /** Font weight. Default: 400 */
  weight?: 400 | 700
  /** Font style. Default: 'normal' */
  style?: 'normal' | 'italic'
  /** Absolute file path (Node.js) or font bytes (browser). */
  src: string | Uint8Array
}

export interface HeaderFooterSpec {
  /** Text content. Use {{pageNumber}} and {{totalPages}} as tokens. */
  text: string
  /** Font size in pt. Default: 10 */
  fontSize?: number
  /** Alignment. Default: 'center' */
  align?: 'left' | 'center' | 'right'
  /** Font family. Default: document.defaultFont */
  fontFamily?: string
  /** Font weight. Default: 400 */
  fontWeight?: 400 | 700
  /** Text color as 6-digit hex. Default: '#666666' */
  color?: string
}

export interface WatermarkSpec {
  /** Text to render as watermark. Either text or image required. */
  text?: string
  /** Absolute path or Uint8Array of a PNG/JPG image. Either text or image required. */
  image?: string | Uint8Array
  /** Font family for text watermark. Default: document.defaultFont */
  fontFamily?: string
  /** Font weight. Default: 400 */
  fontWeight?: 400 | 700
  /** Font size in pt. Default: auto-computed from page diagonal */
  fontSize?: number
  /** Color as 6-digit hex. Default: '#CCCCCC' */
  color?: string
  /** Opacity 0.0–1.0. Default: 0.3 */
  opacity?: number
  /** Rotation in degrees (counter-clockwise). Default: -45 */
  rotation?: number
}

export interface EncryptionSpec {
  /** Password required to OPEN the document. If omitted, document opens without a password
   *  but permissions still apply. */
  userPassword?: string
  /** Password for full unrestricted access. If omitted, a random owner password is generated
   *  (preventing tools from bypassing permissions). */
  ownerPassword?: string
  /** Permissions granted to anyone who opens the document (with or without user password).
   *  Only applied when encryption is active. */
  permissions?: {
    /** Allow printing. Default: true */
    printing?: boolean
    /** Allow copying text/graphics. Default: true */
    copying?: boolean
    /** Allow modifying content. Default: false */
    modifying?: boolean
    /** Allow adding/editing annotations and forms. Default: true */
    annotating?: boolean
  }
}

export interface SignatureSpec {
  /** Name shown as "Signed by: X" inside the box. Optional. */
  signerName?: string
  /** Short reason e.g. "I approve this document". Shown at bottom. Optional. */
  reason?: string
  /** Location string e.g. "New Delhi, India". Shown at bottom. Optional. */
  location?: string
  /** X position from left edge of page in pt. Default: left margin (72pt). */
  x?: number
  /** Y position from TOP of page in pt. Default: 40pt from bottom of page. */
  y?: number
  /** Width of signature box in pt. Default: 200 */
  width?: number
  /** Height of signature box in pt. Default: 60 */
  height?: number
  /** Page index (0-based). Default: last page. */
  page?: number
  /** Border color as 6-digit hex. Default: '#000000' */
  borderColor?: string
  /** Font size for text inside box in pt. Default: 8 */
  fontSize?: number
  /**
   * Path to a PKCS#12 (.p12/.pfx) certificate file, or Uint8Array of cert bytes.
   * When provided, a real PKCS#7/CMS digital signature is embedded in the PDF.
   * Requires the `@signpdf/signpdf` optional peer dependency.
   */
  p12?: string | Uint8Array
  /** Passphrase to decrypt the P12 certificate. Omit if cert has no passphrase. */
  passphrase?: string
  /** Contact info (e.g. email) embedded in the signature dictionary. Default: '' */
  contactInfo?: string
  /** If true, skip rendering the visual signature box (crypto-only invisible signing). Default: false */
  invisible?: boolean
}

export interface BookmarkConfig {
  /** Minimum heading level to include in outline. Default: 1 */
  minLevel?: 1 | 2 | 3 | 4
  /** Maximum heading level to include in outline. Default: 4 */
  maxLevel?: 1 | 2 | 3 | 4
}

export interface HyphenationConfig {
  /** Language code matching the `hyphenation.XX` npm package. e.g. 'en-us', 'de', 'fr'. Required. */
  language: string
  /** Minimum word length to attempt hyphenation. Default: 6 */
  minWordLength?: number
  /** Minimum characters before the hyphen. Default: 2 */
  leftMin?: number
  /** Minimum characters after the hyphen. Default: 3 */
  rightMin?: number
}

export interface AnnotationSpec {
  /** Text content shown in the popup. Required. */
  contents: string
  /** Author name shown in popup header. Optional. */
  author?: string
  /** Annotation color as 6-digit hex. Default: '#FFFF00' (yellow) */
  color?: string
  /** Whether the popup is open by default. Default: false */
  open?: boolean
}

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

export interface AssemblyPart {
  /** Render this document and include its pages */
  doc?: PdfDocument
  /** Pre-rendered PDF bytes to include directly */
  pdf?: Uint8Array
}

// ─── Form Field ───────────────────────────────────────────────────────────────

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

export type ContentElement =
  | ParagraphElement
  | HeadingElement
  | SpacerElement
  | TableElement
  | ImageElement
  | SvgElement
  | QrCodeElement
  | BarcodeElement
  | ChartElement
  | ListElement
  | HorizontalRuleElement
  | PageBreakElement
  | CodeBlockElement
  | RichParagraphElement
  | BlockquoteElement
  | TocElement
  | TocEntryElement
  | CommentElement
  | FormFieldElement
  | CalloutElement
  | FootnoteDefElement
  | FloatGroupElement

export interface ParagraphElement {
  type: 'paragraph'
  text: string
  /** Text direction: 'ltr' = left-to-right, 'rtl' = right-to-left, 'auto' = detect from character dominance. Default: 'auto' */
  dir?: 'ltr' | 'rtl' | 'auto'
  /** Font size in pt. Default: document.defaultFontSize */
  fontSize?: number
  /** Line height in pt. Default: fontSize * 1.5 */
  lineHeight?: number
  /** Font family name. Default: document.defaultFont */
  fontFamily?: string
  /** Font weight. Default: 400 */
  fontWeight?: 400 | 700
  /** Text color as 6-digit hex. Default: '#000000' */
  color?: string
  /** Text alignment. Default: 'left' for LTR, 'right' for RTL (auto-detected) */
  align?: 'left' | 'center' | 'right' | 'justify'
  /** Background color as 6-digit hex. Drawn behind the text block. Default: none */
  bgColor?: string
  /** Extra space below this element in pt. Default: 0 */
  spaceAfter?: number
  /** Extra space above this element in pt. Default: 0 */
  spaceBefore?: number
  /** If true, never break this block across pages. Default: false */
  keepTogether?: boolean
  /** Underline all text in this element. Default: false */
  underline?: boolean
  /** Strikethrough all text in this element. Default: false */
  strikethrough?: boolean
  /** Clickable URL for the entire paragraph. Opens in browser when clicked. */
  url?: string
  /** Number of columns for multi-column layout. Default: 1 (single column) */
  columns?: number
  /** Gap between columns in pt. Default: 24 */
  columnGap?: number
  /** Set to false to disable hyphenation for this element. Default: inherits from doc.hyphenation. */
  hyphenate?: false
  /** Extra spacing between characters in pt. Default: 0 */
  letterSpacing?: number
  /** Simulate small-caps: uppercase text at 80% font size. Default: false */
  smallCaps?: boolean
  /**
   * Render digits (0–9) at a fixed slot width (widest digit in font).
   * Ensures numeric columns align regardless of digit width variation (1 vs 0 etc.).
   */
  tabularNumbers?: boolean
  /** PDF sticky-note annotation attached to this element. */
  annotation?: AnnotationSpec
}

export interface HeadingElement {
  type: 'heading'
  level: 1 | 2 | 3 | 4
  text: string
  /** Text direction: 'ltr' = left-to-right, 'rtl' = right-to-left, 'auto' = detect from character dominance. Default: 'auto' */
  dir?: 'ltr' | 'rtl' | 'auto'
  /** Font family override. Default: document.defaultFont */
  fontFamily?: string
  /** Font weight override. Default: 700 */
  fontWeight?: 400 | 700
  /** Font size override in pt. Default: per-level default (h1=28, h2=22, h3=18, h4=15) */
  fontSize?: number
  /** Line height override in pt. Default: fontSize * 1.3 */
  lineHeight?: number
  /** Text alignment. Default: 'left' for LTR, 'right' for RTL (auto-detected) */
  align?: 'left' | 'center' | 'right' | 'justify'
  /** Text color as 6-digit hex. Default: '#000000' */
  color?: string
  /** Background color as 6-digit hex. Drawn behind the text block. Default: none */
  bgColor?: string
  /** Extra space above this element in pt. Default: 0 */
  spaceBefore?: number
  /** Extra space below this element in pt. Default: per-level default */
  spaceAfter?: number
  /** If true, never break this block across pages. Default: true */
  keepTogether?: boolean
  /** Underline all text in this element. Default: false */
  underline?: boolean
  /** Strikethrough all text in this element. Default: false */
  strikethrough?: boolean
  /** Set to false to exclude this heading from the PDF bookmark outline. Default: included. */
  bookmark?: false
  /** Set to false to disable hyphenation for this element. Default: inherits from doc.hyphenation. */
  hyphenate?: false
  /** Clickable URL for the entire heading. Opens in browser when clicked. */
  url?: string
  /** Named anchor destination for internal links. Allows other spans to link to this heading via href: '#anchorId'. */
  anchor?: string
  /** Extra spacing between characters in pt. Default: 0 */
  letterSpacing?: number
  /** Simulate small-caps: uppercase text at 80% font size. Default: false */
  smallCaps?: boolean
  /**
   * Render digits (0–9) at a fixed slot width (widest digit in font).
   * Ensures numeric columns align regardless of digit width variation (1 vs 0 etc.).
   */
  tabularNumbers?: boolean
  /** PDF sticky-note annotation attached to this element. */
  annotation?: AnnotationSpec
}

export interface SpacerElement {
  type: 'spacer'
  /** Height in pt */
  height: number
}

// ─── Table ────────────────────────────────────────────────────────────────────

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

export interface ColumnDef {
  /** Fixed pt (e.g. 80), proportional fraction (e.g. '2*' or '*'), or 'auto' (shrink-to-content). */
  width: number | string
  /** Column default text alignment. Default: 'left' */
  align?: 'left' | 'center' | 'right'
}

export interface TableRow {
  cells: TableCell[]
  /** Mark row as a header (styled + repeated on continuation pages). Default: false */
  isHeader?: boolean
}

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

// ─── Image ────────────────────────────────────────────────────────────────────

export interface ImageElement {
  type: 'image'
  /** Absolute file path (Node.js) or raw bytes (browser/Node) */
  src: string | Uint8Array
  /** Image format. Default: 'auto' (detected from magic bytes, then file extension). */
  format?: 'png' | 'jpg' | 'auto'
  /** Render width in pt. Omit to auto-size to contentWidth. */
  width?: number
  /** Render height in pt. Omit to preserve aspect ratio. */
  height?: number
  /** Horizontal alignment within content area. Default: 'left' */
  align?: 'left' | 'center' | 'right'
  /** Space below image in pt. Default: 0 */
  spaceAfter?: number
  /** Space above image in pt. Default: 0 */
  spaceBefore?: number
  /**
   * If set, renders image + floatText as a two-column composite block.
   * 'left' = image left, text right. 'right' = image right, text left.
   * NOTE: Constrained float only — floatText is a single paragraph alongside the image.
   */
  float?: 'left' | 'right'
  /** Image column width in pt. Default: 35% of content width. */
  floatWidth?: number
  /** Gap between image and text columns in pt. Default: 12 */
  floatGap?: number
  /** Text rendered alongside the image. Required when float is set. Mutually exclusive with floatSpans. */
  floatText?: string
  /** Rich-text spans rendered alongside the image. Alternative to floatText for mixed-style float text. */
  floatSpans?: InlineSpan[]
  /** Font size for floatText in pt. Default: doc.defaultFontSize */
  floatFontSize?: number
  /** Font family for floatText. Default: doc.defaultFont */
  floatFontFamily?: string
  /** Text color for floatText as 6-digit hex. Default: '#000000' */
  floatColor?: string
}

// ─── Float Group ──────────────────────────────────────────────────────────────

export interface FloatGroupElement {
  type: 'float-group'
  /** The image to float left or right. */
  image: {
    src: string | Uint8Array
    format?: 'png' | 'jpg' | 'auto'
    height?: number
  }
  /** Image position. 'left' = image left, text right. 'right' = image right, text left. */
  float: 'left' | 'right'
  /** Image column width in pt. Default: 35% of content width. */
  floatWidth?: number
  /** Gap between image and text columns in pt. Default: 12 */
  floatGap?: number
  /** Content elements rendered in the text column, top-to-bottom. */
  content: Array<ParagraphElement | HeadingElement | RichParagraphElement>
  /** Space above the entire float group in pt. Default: 0 */
  spaceBefore?: number
  /** Space below the entire float group in pt. Default: 12 */
  spaceAfter?: number
}

// ─── SVG ──────────────────────────────────────────────────────────────────────

export interface SvgElement {
  type: 'svg'
  /** Inline SVG markup string. Either `svg` or `src` is required. */
  svg?: string
  /**
   * Path to an SVG file (absolute path) or an https:// URL.
   * Either `svg` or `src` is required.
   * @example src: path.join(__dirname, 'chart.svg')
   * @example src: 'https://example.com/logo.svg'
   */
  src?: string
  /** Rendered width in pt. Default: available content width */
  width?: number
  /** Rendered height in pt. Auto-computed from SVG viewBox if not set */
  height?: number
  /** Alignment within content area. Default: 'left' */
  align?: 'left' | 'center' | 'right'
  /** Space above element in pt. Default: 8 */
  spaceBefore?: number
  /** Space below element in pt. Default: 8 */
  spaceAfter?: number
}

// ─── QR Code ──────────────────────────────────────────────────────────────────

export interface QrCodeElement {
  type: 'qr-code'
  /** The data to encode (URL, text, UPI string, etc.). Required. Max 2953 chars at error-correction L. */
  data: string
  /** Rendered size in pt (width = height). Default: 80 */
  size?: number
  /** QR error correction level. Default: 'M' */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
  /** Module colour as 6-digit hex. Default: '#000000' */
  foreground?: string
  /** Background colour as 6-digit hex. Default: '#ffffff' */
  background?: string
  /** Quiet-zone modules around the symbol. Default: 4 */
  margin?: number
  /** Alignment within content area. Default: 'left' */
  align?: 'left' | 'center' | 'right'
  /** Space above element in pt. Default: 8 */
  spaceBefore?: number
  /** Space below element in pt. Default: 8 */
  spaceAfter?: number
}

// ─── Barcode ──────────────────────────────────────────────────────────────────

export interface BarcodeElement {
  type: 'barcode'
  /**
   * Barcode symbology. Common values: 'ean13', 'ean8', 'upca', 'code128',
   * 'code39', 'qrcode', 'pdf417', 'datamatrix', 'itf14', 'azteccode'.
   * Full list: https://bwip-js.metafloor.com/
   */
  symbology: string
  /** Data to encode. Format requirements vary by symbology. */
  data: string
  /** Rendered width in pt. Default: 200 */
  width?: number
  /** Rendered height in pt. Default: 60 */
  height?: number
  /** Render human-readable text below the barcode. Default: true */
  includeText?: boolean
  /** Alignment within content area. Default: 'left' */
  align?: 'left' | 'center' | 'right'
  /** Space above element in pt. Default: 8 */
  spaceBefore?: number
  /** Space below element in pt. Default: 8 */
  spaceAfter?: number
}

// ─── Chart ────────────────────────────────────────────────────────────────────

export interface ChartElement {
  type: 'chart'
  /**
   * A vega-lite JSON specification object.
   * Requires `vega` and `vega-lite` to be installed: `npm install vega vega-lite`
   * @see https://vega.github.io/vega-lite/docs/spec.html
   */
  spec: Record<string, unknown>
  /** Rendered width in pt. Default: available content width */
  width?: number
  /** Rendered height in pt. Default: 300 */
  height?: number
  /** Optional figure caption rendered below the chart. */
  caption?: string
  /** Alignment within content area. Default: 'left' */
  align?: 'left' | 'center' | 'right'
  /** Space above element in pt. Default: 8 */
  spaceBefore?: number
  /** Space below element in pt. Default: 8 */
  spaceAfter?: number
}

// ─── List ─────────────────────────────────────────────────────────────────────

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

/** Forces a page break at this position. No-op if already at the top of a page. */
export interface PageBreakElement {
  type: 'page-break'
}

// ─── Code Block ───────────────────────────────────────────────────────────────

export interface CodeBlockElement {
  type: 'code'
  /** Preformatted source code. Newlines and indentation are preserved. */
  text: string
  /** Text direction. Code blocks should always be 'ltr' (logical order). Default: 'ltr' */
  dir?: 'ltr' | 'rtl' | 'auto'
  /**
   * Font family for code text. Must be loaded in doc.fonts as a monospace TTF.
   * There is no default — a font MUST be provided for code blocks.
   * Recommended: JetBrains Mono, Fira Code, Courier Prime, etc.
   */
  fontFamily: string
  /** Font size in pt. Default: doc.defaultFontSize - 2 (slightly smaller than body text) */
  fontSize?: number
  /** Line height in pt. Default: fontSize * 1.4 */
  lineHeight?: number
  /** Background box color (hex). Default: '#f6f8fa' */
  bgColor?: string
  /** Text color (hex). Default: '#24292f' */
  color?: string
  /** Padding inside the background box on all 4 sides in pt. Default: 8 */
  padding?: number
  /** Space below element in pt. Default: 12 */
  spaceAfter?: number
  /** Space above element in pt. Default: 12 */
  spaceBefore?: number
  /** If true, never break this block across pages. Default: false */
  keepTogether?: boolean
  /**
   * Programming language for syntax highlighting. Requires `highlight.js` peer dependency.
   * When set, tokens are colored using the highlight theme. When unset or highlight.js
   * is not installed, renders as plain monospace text (existing behavior).
   * Examples: 'javascript', 'typescript', 'python', 'rust', 'go', 'sql', 'json', 'bash'
   */
  language?: string
  /**
   * Custom syntax highlight colors (6-digit hex). Overrides the default GitHub-light theme.
   * Only used when `language` is set.
   */
  highlightTheme?: {
    keyword?: string
    string?: string
    comment?: string
    number?: string
    function?: string
    punctuation?: string
    type?: string
    built_in?: string
    literal?: string
  }
}

// ─── Rich Paragraph ───────────────────────────────────────────────────────────

/**
 * A paragraph composed of inline spans with mixed formatting (bold, italic, color, per-span fontSize).
 */
export interface RichParagraphElement {
  type: 'rich-paragraph'
  spans: InlineSpan[]
  /** Text direction: 'ltr', 'rtl', or 'auto'. Default: 'auto' */
  dir?: 'ltr' | 'rtl' | 'auto'
  /** Font size in pt for all spans. Default: doc.defaultFontSize */
  fontSize?: number
  /** Line height in pt. Default: fontSize * 1.5 */
  lineHeight?: number
  /** Text alignment. Default: 'left' for LTR, 'right' for RTL (auto-detected) */
  align?: 'left' | 'center' | 'right' | 'justify'
  /** Background color as 6-digit hex. Drawn behind the text block. Default: none */
  bgColor?: string
  /** Extra space above this element in pt. Default: 0 */
  spaceBefore?: number
  /** Extra space below this element in pt. Default: 0 */
  spaceAfter?: number
  /** If true, never break this block across pages. Default: false */
  keepTogether?: boolean
  /** Number of columns for multi-column layout. Default: 1 (single column) */
  columns?: number
  /** Gap between columns in pt. Default: 24 */
  columnGap?: number
  /** Extra spacing between characters in pt. Default: 0 */
  letterSpacing?: number
  /** Simulate small-caps: uppercase text at 80% font size. Default: false */
  smallCaps?: boolean
  /**
   * Render digits (0–9) at a fixed slot width (widest digit in font).
   * Ensures numeric columns align regardless of digit width variation (1 vs 0 etc.).
   */
  tabularNumbers?: boolean
}

export interface InlineSpan {
  text: string
  /** Text direction for this span: 'ltr', 'rtl', or 'auto'. Default: 'auto' */
  dir?: 'ltr' | 'rtl' | 'auto'
  /** Font family. Default: doc.defaultFont */
  fontFamily?: string
  /** Font weight. Default: 400 */
  fontWeight?: 400 | 700
  /** Font style. Default: 'normal'. Requires italic variant in doc.fonts. */
  fontStyle?: 'normal' | 'italic'
  /** Text color (hex). Default: '#000000' */
  color?: string
  /** Font size override in pt. When set, overrides the element-level fontSize for this span. Default: element fontSize */
  fontSize?: number
  /** Underline the span text. Default: false */
  underline?: boolean
  /** Draw a line through the middle of the span text. Default: false */
  strikethrough?: boolean
  /** Clickable URL. Opens in browser when clicked in PDF viewer. Auto-applies blue color and underline. */
  url?: string
  /** Internal anchor link: '#anchorId' to jump to a heading with matching anchor. Or external URL. Alias for url. */
  href?: string
  /** Raise text as superscript or lower as subscript. Default: none */
  verticalAlign?: 'superscript' | 'subscript'
  /** Simulate small-caps: uppercase text at 80% font size. Default: false */
  smallCaps?: boolean
  /** Extra spacing between characters in pt. Default: 0 */
  letterSpacing?: number
  /**
   * ID of a matching footnote-def element. When set, this span renders as a
   * superscript number and pins the footnote def to the bottom of this page.
   */
  footnoteRef?: string
}

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

// ─── Blockquote ───────────────────────────────────────────────────────────────

export interface BlockquoteElement {
  type: 'blockquote'
  text: string
  /** Text direction: 'ltr', 'rtl', or 'auto'. Default: 'auto' */
  dir?: 'ltr' | 'rtl' | 'auto'
  /** Left border color (hex). Default: '#0070f3' */
  borderColor?: string
  /** Left border width in pt. Default: 3 */
  borderWidth?: number
  /** Background fill color (hex). Default: '#f8f9fa' */
  bgColor?: string
  /** Text color (hex). Default: '#333333' */
  color?: string
  /** Font family. Default: document.defaultFont */
  fontFamily?: string
  /** Font weight. Default: 400 */
  fontWeight?: 400 | 700
  /** Font style. Default: 'normal'. Requires italic variant in doc.fonts if set to 'italic'. */
  fontStyle?: 'normal' | 'italic'
  /** Font size in pt. Default: document.defaultFontSize */
  fontSize?: number
  /** Line height in pt. Default: fontSize * 1.5 */
  lineHeight?: number
  /** Shorthand for paddingH and paddingV. Sets both when they are not individually specified. Per-axis overrides take precedence. */
  padding?: number
  /** Horizontal padding (left + right) inside the box in pt. Default: padding ?? 16 */
  paddingH?: number
  /** Vertical padding (top + bottom) inside the box in pt. Default: padding ?? 10 */
  paddingV?: number
  /** Text alignment. Default: 'left' */
  align?: 'left' | 'center' | 'right' | 'justify'
  /** Space above this element in pt. Default: 0 */
  spaceBefore?: number
  /** Space below this element in pt. Default: 12 */
  spaceAfter?: number
  /** If true, never break this block across pages. Default: false */
  keepTogether?: boolean
  /** Underline all text in this element. Default: false */
  underline?: boolean
  /** Strikethrough all text in this element. Default: false */
  strikethrough?: boolean
}

// ─── Callout ──────────────────────────────────────────────────────────────────

/**
 * A highlighted callout box with an optional title and preset color schemes.
 * Useful for info panels, warnings, tips, and notes.
 */
export interface CalloutElement {
  type: 'callout'
  /** Body text content. Required. */
  content: string
  /**
   * Preset style that sets default colors.
   * - 'info': blue (#EFF6FF bg, #3B82F6 border)
   * - 'warning': amber (#FFFBEB bg, #F59E0B border)
   * - 'tip': green (#F0FDF4 bg, #22C55E border)
   * - 'note': gray (#F9FAFB bg, #9CA3AF border)
   * Default: blue-gray (#F8F9FA bg, #0070F3 border)
   */
  style?: 'info' | 'warning' | 'tip' | 'note'
  /** Optional title rendered above the body (bold, colored). */
  title?: string
  /** Background color as 6-digit hex. Default: per style. */
  backgroundColor?: string
  /** Left border color as 6-digit hex. Default: per style. */
  borderColor?: string
  /** Text color as 6-digit hex. Default: '#1F2937' */
  color?: string
  /** Title color as 6-digit hex. Default: same as borderColor */
  titleColor?: string
  /** Font family. Default: document.defaultFont */
  fontFamily?: string
  /** Font weight. Default: 400 */
  fontWeight?: 400 | 700
  /** Font size in pt. Default: document.defaultFontSize */
  fontSize?: number
  /** Line height in pt. Default: fontSize * 1.5 */
  lineHeight?: number
  /** Shorthand for paddingH and paddingV. Default: 12 */
  padding?: number
  /** Horizontal padding (left + right) inside the box in pt. Default: padding ?? 16 */
  paddingH?: number
  /** Vertical padding (top + bottom) inside the box in pt. Default: padding ?? 10 */
  paddingV?: number
  /** Space below this element in pt. Default: 12 */
  spaceAfter?: number
  /** Space above this element in pt. Default: 0 */
  spaceBefore?: number
  /** If true, never break this element across pages. Default: false */
  keepTogether?: boolean
  /** Text direction. Default: 'auto' */
  dir?: 'ltr' | 'rtl' | 'auto'
}

// ─── Footnote Definition ──────────────────────────────────────────────────────

/**
 * Defines a footnote. Placed anywhere in doc.content — order doesn't matter.
 * Rendered at the bottom of the page that contains the matching footnoteRef span.
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

/** Internal: used as element type for measured TOC entry rows */
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

// ─── Internal Types (not exported from index.ts) ─────────────────────────────

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
  element: ContentElement
  /** Total height in pt (lineCount * lineHeight, spacer.height, table sum, image height, hr height) */
  height: number
  /** Lines from Pretext layoutWithLines(). Empty array for spacers, tables, images, hr. */
  lines: PretextLine[]
  /** Resolved font size in pt. 0 for non-text elements. */
  fontSize: number
  /** Resolved line height in pt. 0 for non-text elements. */
  lineHeight: number
  /** Key into FontMap, e.g. "Inter-400-normal". '' for non-text elements. */
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
  margins: Margins
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
