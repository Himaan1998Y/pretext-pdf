/** pdfmake input type definitions and compat configuration. */

// ─── Public input types ───────────────────────────────────────────────────────

/** A pdfmake-style document descriptor, stripped to the fields this shim handles. */
export interface PdfmakeDocument {
  content: PdfmakeNode | PdfmakeNode[]
  styles?: Record<string, PdfmakeStyle>
  defaultStyle?: PdfmakeStyle
  pageSize?: string | { width: number; height: number }
  pageOrientation?: 'portrait' | 'landscape'
  pageMargins?: number | [number, number] | [number, number, number, number]
  header?: string | { text: string; alignment?: PdfmakeStyle['alignment']; fontSize?: number; color?: string }
  footer?: string | { text: string; alignment?: PdfmakeStyle['alignment']; fontSize?: number; color?: string }
  info?: { title?: string; author?: string; subject?: string; keywords?: string }
  allowedFileDirs?: string[]
}

export type PdfmakeNode = string | PdfmakeObjectNode

export interface PdfmakeObjectNode {
  text?: string | PdfmakeNode[]
  style?: string | string[]
  fontSize?: number
  bold?: boolean
  italics?: boolean
  color?: string
  alignment?: 'left' | 'center' | 'right' | 'justify'
  font?: string
  ul?: PdfmakeNode[]
  ol?: PdfmakeNode[]
  table?: {
    body: PdfmakeNode[][]
    widths?: (number | string)[]
    headerRows?: number
  }
  image?: string
  width?: number
  height?: number
  fit?: number | [number, number]
  qr?: string
  pageBreak?: 'before' | 'after'
  stack?: PdfmakeNode[]
  columns?: PdfmakeNode[]
  canvas?: unknown
  link?: string
}

export interface PdfmakeStyle {
  fontSize?: number
  bold?: boolean
  italics?: boolean
  color?: string
  alignment?: 'left' | 'center' | 'right' | 'justify'
  font?: string
}

export interface CompatOptions {
  /**
   * Map of pdfmake style names to pretext-pdf heading levels (1–4).
   * Default: { header: 1, h1: 1, title: 1, subheader: 2, h2: 2, h3: 3, h4: 4 }
   * Pass `{}` to disable heading detection entirely (everything becomes paragraphs).
   */
  headingMap?: Record<string, 1 | 2 | 3 | 4>
  /**
   * Called when a pdfmake feature is encountered that the shim doesn't translate
   * (canvas, function-style headers, etc.). Default: log a one-time warning.
   */
  onUnsupported?: (feature: string) => void
}

// ─── Internal translation context ────────────────────────────────────────────

export interface TranslateCtx {
  styles: Record<string, PdfmakeStyle>
  defaultStyle: PdfmakeStyle
  headingMap: Record<string, 1 | 2 | 3 | 4>
  onUnsupported: (feature: string) => void
}

export const DEFAULT_HEADING_MAP: Record<string, 1 | 2 | 3 | 4> = {
  header: 1, h1: 1, title: 1,
  subheader: 2, h2: 2,
  h3: 3,
  h4: 4,
}
