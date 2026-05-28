/**
 * pretext-pdf — Document-level public types.
 *
 * PdfDocument and its directly-attached configuration sub-types
 * (metadata, margins, fonts, header/footer, watermark, encryption,
 * signature, bookmarks, hyphenation, annotations).
 */
import type { NamedPageSize } from '../page-sizes.js'
import type { ContentElement } from './union.js'

/**
 * Top-level document descriptor. Named PdfDocument to avoid clash with browser window.Document
 * @public
 */
export interface PdfDocument {
  /** Page size. Default: 'A4' (595×842 pt). Custom: [width, height] in pt. */
  readonly pageSize?: NamedPageSize | [number, number]
  /** Page margins in pt. Default: all 72pt (1 inch). */
  readonly margins?: Partial<Margins>
  /** Default font family for body text. Default: 'Inter' */
  readonly defaultFont?: string
  /** Default font size in pt. Default: 12 */
  readonly defaultFontSize?: number
  /** Default line height in pt. Default: fontSize * 1.5 */
  readonly defaultLineHeight?: number
  /** Custom fonts to load and embed. Inter 400 is always available without specifying. */
  readonly fonts?: FontSpec[]
  /** Header rendered at top of every page. Supports \{\{pageNumber\}\} and \{\{totalPages\}\}. */
  readonly header?: HeaderFooterSpec
  /** Footer rendered at bottom of every page. Supports \{\{pageNumber\}\} and \{\{totalPages\}\}. */
  readonly footer?: HeaderFooterSpec
  /** Watermark overlay rendered on every page behind content. Text or image. */
  readonly watermark?: WatermarkSpec
  /** Password protection and permission control for the output PDF. */
  readonly encryption?: EncryptionSpec
  /** Visual signature placeholder drawn on the specified page. */
  readonly signature?: SignatureSpec
  /** PDF bookmark outline (sidebar navigation). Defaults to enabled. Set to false to disable bookmarks entirely. */
  readonly bookmarks?: false | BookmarkConfig
  /** Automatic word hyphenation using Liang's algorithm. Requires installing the matching `hyphenation.XX` npm package. */
  readonly hyphenation?: HyphenationConfig
  /** PDF document metadata written into the file's properties. */
  readonly metadata?: DocumentMetadata
  /**
   * Default style applied to every paragraph and heading that does not
   * explicitly set the field. Explicit element-level values always win.
   */
  readonly defaultParagraphStyle?: {
    readonly fontSize?: number
    readonly lineHeight?: number
    readonly fontFamily?: string
    readonly fontWeight?: 400 | 700
    readonly color?: string
    readonly align?: 'left' | 'center' | 'right' | 'justify'
    readonly letterSpacing?: number
    readonly spaceBefore?: number
    readonly spaceAfter?: number
  }
  /**
   * Page-range overrides for header/footer. Sections are matched by page number
   * (1-based). The first matching section wins. Falls back to doc.header/footer.
   */
  readonly sections?: Array<{
    readonly fromPage?: number
    readonly toPage?: number
    readonly header?: PdfDocument['header']
    readonly footer?: PdfDocument['footer']
  }>
  /** Document content elements, rendered top-to-bottom. */
  content: ContentElement[]
  /** If true, flatten all form fields into static content (no longer interactive). Default: false */
  readonly flattenForms?: boolean
  /**
   * Called when an image fails to load (file not found, URL error, embed failure).
   * Return 'skip' to silently omit the image (default behavior).
   * Return 'throw' to abort rendering with the original error.
   * If omitted, failures are logged as warnings and the image is skipped.
   */
  readonly onImageLoadError?: (src: string | Uint8Array, error: Error) => 'skip' | 'throw'
  /**
   * Called when a form field fails to render (field type error, font missing, etc.).
   * Return 'skip' to silently omit the field.
   * Return 'throw' to abort rendering with the original error.
   * If omitted, failures are logged as warnings and the field is skipped.
   */
  readonly onFormFieldError?: (fieldName: string | undefined, error: Error) => 'skip' | 'throw'
  /**
   * Document creation date written into PDF metadata.
   * Accepts an ISO 8601 string or a Date object. Default: current date/time.
   */
  readonly renderDate?: string | Date
  /**
   * Restrict filesystem access to these absolute directory paths.
   * When set, any image/SVG/font `src` pointing outside these directories
   * throws PATH_TRAVERSAL. Strongly recommended when src values originate
   * from user-controlled input to prevent arbitrary file reads.
   *
   * Example: `allowedFileDirs: ['/app/assets', '/tmp/uploads']`
   */
  readonly allowedFileDirs?: string[]
}

/** @public */
export interface DocumentMetadata {
  /** Document title shown in PDF viewer title bar. */
  readonly title?: string
  /** Author name. */
  readonly author?: string
  /** Subject / description. */
  readonly subject?: string
  /** Searchable keywords. */
  readonly keywords?: string[]
  /** Producing application name. Default: 'pretext-pdf' */
  readonly creator?: string
  /** BCP47 language tag e.g. 'en-US', 'hi', 'ar'. Sets the PDF /Lang catalog attribute for accessibility. */
  readonly language?: string
  /** PDF producer field shown in document properties e.g. 'MyApp v2.1'. */
  readonly producer?: string
  /**
   * Accessibility metadata for PDF/UA and WCAG tooling.
   * Serialized as JSON into the PDF Info dictionary under the `Accessibility` key.
   * @public
   */
  readonly accessibility?: Record<string, unknown>
  /**
   * Semantic document structure metadata (e.g. document class, schema version,
   * AI-generation provenance). Serialized as JSON into the PDF Info dictionary
   * under the `Semantic` key.
   * @public
   */
  readonly semantic?: Record<string, unknown>
}

/** @public */
export interface Margins {
  readonly top: number
  readonly bottom: number
  readonly left: number
  readonly right: number
}

/** @public */
export interface FontSpec {
  /** Font family name, e.g. 'Roboto'. Used in fontFamily fields. */
  readonly family: string
  /** Font weight. Default: 400 */
  readonly weight?: 400 | 700
  /** Font style. Default: 'normal' */
  readonly style?: 'normal' | 'italic'
  /** Absolute file path (Node.js) or font bytes (browser). */
  readonly src: string | Uint8Array
}

/** @public */
export interface HeaderFooterSpec {
  /** Text content. Use \{\{pageNumber\}\} and \{\{totalPages\}\} as tokens. */
  readonly text: string
  /** Font size in pt. Default: 10 */
  readonly fontSize?: number
  /** Alignment. Default: 'center' */
  readonly align?: 'left' | 'center' | 'right'
  /** Font family. Default: document.defaultFont */
  readonly fontFamily?: string
  /** Font weight. Default: 400 */
  readonly fontWeight?: 400 | 700
  /** Text color as 6-digit hex. Default: '#666666' */
  readonly color?: string
}

interface WatermarkBase {
  /** Font family for text watermark. Default: document.defaultFont */
  readonly fontFamily?: string
  /** Font weight. Default: 400 */
  readonly fontWeight?: 400 | 700
  /** Font size in pt. Default: auto-computed from page diagonal */
  readonly fontSize?: number
  /** Color as 6-digit hex. Default: '#CCCCCC' */
  readonly color?: string
  /** Opacity 0.0–1.0. Default: 0.3 */
  readonly opacity?: number
  /** Rotation in degrees (counter-clockwise). Default: -45 */
  readonly rotation?: number
}

/** @public */
export type WatermarkSpec =
  | (WatermarkBase & { readonly text: string; readonly image?: never })
  | (WatermarkBase & { readonly image: string | Uint8Array; readonly text?: never })

/** @public */
export interface EncryptionSpec {
  /** Password required to OPEN the document. If omitted, document opens without a password
   *  but permissions still apply. */
  readonly userPassword?: string
  /** Password for full unrestricted access. If omitted, a random owner password is generated
   *  (preventing tools from bypassing permissions). */
  readonly ownerPassword?: string
  /** Permissions granted to anyone who opens the document (with or without user password).
   *  Only applied when encryption is active. */
  readonly permissions?: {
    /** Allow printing. Default: true */
    readonly printing?: boolean
    /** Allow copying text/graphics. Default: true */
    readonly copying?: boolean
    /** Allow modifying content. Default: false */
    readonly modifying?: boolean
    /** Allow adding/editing annotations and forms. Default: true */
    readonly annotating?: boolean
  }
}

/** @public */
export interface SignatureSpec {
  /** Name shown as "Signed by: X" inside the box. Optional. */
  readonly signerName?: string
  /** Short reason e.g. "I approve this document". Shown at bottom. Optional. */
  readonly reason?: string
  /** Location string e.g. "New Delhi, India". Shown at bottom. Optional. */
  readonly location?: string
  /** X position from left edge of page in pt. Default: left margin (72pt). */
  readonly x?: number
  /** Y position from TOP of page in pt. Default: 40pt from bottom of page. */
  readonly y?: number
  /** Width of signature box in pt. Default: 200 */
  readonly width?: number
  /** Height of signature box in pt. Default: 60 */
  readonly height?: number
  /** Page index (0-based). Default: last page. */
  readonly page?: number
  /** Border color as 6-digit hex. Default: '#000000' */
  readonly borderColor?: string
  /** Font size for text inside box in pt. Default: 8 */
  readonly fontSize?: number
  /**
   * Path to a PKCS#12 (.p12/.pfx) certificate file, or Uint8Array of cert bytes.
   * When provided, a real PKCS#7/CMS digital signature is embedded in the PDF.
   * Requires the `@signpdf/signpdf` optional peer dependency.
   */
  readonly p12?: string | Uint8Array
  /** Passphrase to decrypt the P12 certificate. Omit if cert has no passphrase. */
  readonly passphrase?: string
  /** Contact info (e.g. email) embedded in the signature dictionary. Default: '' */
  readonly contactInfo?: string
  /** If true, skip rendering the visual signature box (crypto-only invisible signing). Default: false */
  readonly invisible?: boolean
}

/** @public */
export interface BookmarkConfig {
  /** Minimum heading level to include in outline. Default: 1 */
  readonly minLevel?: 1 | 2 | 3 | 4
  /** Maximum heading level to include in outline. Default: 4 */
  readonly maxLevel?: 1 | 2 | 3 | 4
}

/** @public */
export interface HyphenationConfig {
  /** Language code matching the `hyphenation.XX` npm package. e.g. 'en-us', 'de', 'fr'. Required. */
  readonly language: string
  /** Minimum word length to attempt hyphenation. Default: 6 */
  readonly minWordLength?: number
  /** Minimum characters before the hyphen. Default: 2 */
  readonly leftMin?: number
  /** Minimum characters after the hyphen. Default: 3 */
  readonly rightMin?: number
}

/** @public */
export interface AnnotationSpec {
  /** Text content shown in the popup. Required. */
  readonly contents: string
  /** Author name shown in popup header. Optional. */
  readonly author?: string
  /** Annotation color as 6-digit hex. Default: '#FFFF00' (yellow) */
  readonly color?: string
  /** Whether the popup is open by default. Default: false */
  readonly open?: boolean
}
