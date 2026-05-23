/**
 * pretext-pdf — Media and graphical element types.
 *
 * Image variants, FloatGroup, SVG, QrCode, Barcode, Chart, AssemblyPart.
 */
import type { PdfDocument } from './document.js'
import type {
  ParagraphElement,
  HeadingElement,
  RichParagraphElement,
  InlineSpan,
} from './elements-text.js'

// ─── Image ────────────────────────────────────────────────────────────────────

interface ImageBase {
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
}

type ImageNoFloat = ImageBase & {
  float?: undefined
  floatWidth?: undefined
  floatGap?: undefined
  floatText?: undefined
  floatSpans?: undefined
  floatFontSize?: undefined
  floatFontFamily?: undefined
  floatColor?: undefined
}

type ImageWithFloatText = ImageBase & {
  /**
   * If set, renders image + floatText as a two-column composite block.
   * 'left' = image left, text right. 'right' = image right, text left.
   * NOTE: Constrained float only — floatText is a single paragraph alongside the image.
   */
  float: 'left' | 'right'
  /** Image column width in pt. Default: 35% of content width. */
  floatWidth?: number
  /** Gap between image and text columns in pt. Default: 12 */
  floatGap?: number
  /** Font size for floatText in pt. Default: doc.defaultFontSize */
  floatFontSize?: number
  /** Font family for floatText. Default: doc.defaultFont */
  floatFontFamily?: string
  /** Text color for floatText as 6-digit hex. Default: '#000000' */
  floatColor?: string
  /** Text rendered alongside the image. Mutually exclusive with floatSpans. */
  floatText: string
  floatSpans?: undefined
}

type ImageWithFloatSpans = ImageBase & {
  /**
   * If set, renders image + floatSpans as a two-column composite block.
   * 'left' = image left, text right. 'right' = image right, text left.
   * NOTE: Constrained float only — floatSpans is rendered alongside the image.
   */
  float: 'left' | 'right'
  /** Image column width in pt. Default: 35% of content width. */
  floatWidth?: number
  /** Gap between image and text columns in pt. Default: 12 */
  floatGap?: number
  /** Font size for floatText in pt. Default: doc.defaultFontSize */
  floatFontSize?: number
  /** Font family for floatText. Default: doc.defaultFont */
  floatFontFamily?: string
  /** Text color for floatText as 6-digit hex. Default: '#000000' */
  floatColor?: string
  /** Rich-text spans rendered alongside the image. Alternative to floatText for mixed-style float text. */
  floatSpans: InlineSpan[]
  floatText?: undefined
}

/** @public */
export type ImageElement = ImageNoFloat | ImageWithFloatText | ImageWithFloatSpans

// ─── Float Group ──────────────────────────────────────────────────────────────

/** @public */
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

interface SvgBase {
  type: 'svg'
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

/** @public */
export type SvgElement =
  | (SvgBase & { svg: string; src?: never })
  | (SvgBase & { src: string; svg?: never })

// ─── QR Code ──────────────────────────────────────────────────────────────────

/** @public */
export interface QrCodeElement {
  type: 'qr-code'
  /** The data to encode (URL, text, UPI string, etc.). Required. Max 2953 chars at error-correction L. */
  data: string
  /** Rendered size in pt (width = height). Default: 80 */
  size?: number
  /** QR error correction level. Default: 'M' */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
  /** Module color as 6-digit hex. Default: '#000000' */
  foreground?: string
  /** Background color as 6-digit hex. Default: '#ffffff' */
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

/** @public */
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

/** @public */
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

// ─── Assembly Part ────────────────────────────────────────────────────────────

/** @public */
export type AssemblyPart =
  | { doc: PdfDocument; pdf?: never }
  | { pdf: Uint8Array; doc?: never }
