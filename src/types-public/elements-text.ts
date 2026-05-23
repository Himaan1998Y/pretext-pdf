/**
 * pretext-pdf — Text-oriented element types.
 *
 * Paragraph, Heading, RichParagraph (and its InlineSpan member),
 * Blockquote, Callout, CodeBlock.
 */
import type { AnnotationSpec } from './document.js'

/** @public */
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

/** @public */
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

// ─── Rich Paragraph ───────────────────────────────────────────────────────────

/**
 * A paragraph composed of inline spans with mixed formatting (bold, italic, color, per-span fontSize).
 * @public
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

/** @public */
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

// ─── Blockquote ───────────────────────────────────────────────────────────────

/** @public */
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
 * @public
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

// ─── Code Block ───────────────────────────────────────────────────────────────

/** @public */
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
