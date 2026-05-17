/**
 * pretext-pdf/compat — translate a pdfmake document descriptor into a
 * pretext-pdf PdfDocument so existing pdfmake codebases can switch with
 * a one-line change at the entry point.
 *
 *   import { fromPdfmake } from 'pretext-pdf/compat'
 *   import { render } from 'pretext-pdf'
 *
 *   const pdfmakeDoc = { content: [...], styles: {...} }
 *   const pdf = await render(fromPdfmake(pdfmakeDoc))
 *
 * What's translated:
 *   - pageSize ('A4', 'LETTER', { width, height }), pageOrientation, pageMargins
 *   - defaultStyle + styles map (style names referenced via { text, style: 'h1' })
 *   - String content → paragraph
 *   - { text }            → paragraph or rich-paragraph (depends on inline styling)
 *   - { ul } / { ol }     → list (recursive)
 *   - { table: {body, widths, headerRows} } → table
 *   - { image }           → image
 *   - { qr, fit }         → qr-code (requires the `qrcode` peer dep at render time)
 *   - { pageBreak }       → page-break
 *   - { stack }           → recurse children inline
 *   - header / footer (string forms only — pdfmake function-style headers are not supported)
 *
 * What's NOT translated (skipped, optionally warns):
 *   - { columns } — flattened into a stack with a console warning
 *   - { canvas } — drawing primitives are unsupported
 *   - Function-style headers/footers
 *   - styles[name].marginX / marginY / decoration
 *
 * Heading detection:
 *   By default style names like 'header', 'h1'..'h4', 'title', 'subheader' map
 *   to pretext-pdf heading levels 1..4. Override with `options.headingMap`.
 */
import type {
  PdfDocument,
  ContentElement,
  ParagraphElement,
  RichParagraphElement,
  HeadingElement,
  ListElement,
  ListItem,
  TableElement,
  ColumnDef,
  TableRow,
  ImageElement,
  QrCodeElement,
  PageBreakElement,
  HeaderFooterSpec,
  Margins,
  InlineSpan,
} from './types.js'

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
  text?: string | PdfmakeNode | PdfmakeNode[]
  style?: string | string[]
  bold?: boolean
  italics?: boolean
  color?: string
  fontSize?: number
  alignment?: 'left' | 'center' | 'right' | 'justify'
  font?: string
  ul?: PdfmakeNode[]
  ol?: PdfmakeNode[]
  table?: { body: PdfmakeNode[][]; widths?: Array<number | string>; headerRows?: number }
  image?: string
  width?: number | string
  height?: number
  qr?: string
  fit?: number | [number, number]
  pageBreak?: 'before' | 'after'
  stack?: PdfmakeNode[]
  columns?: PdfmakeNode[]
  link?: string
  canvas?: unknown[]
}

/**
 * Subset of pdfmake style properties translated by this shim.
 *
 * @remarks
 * **What pdfmake's style system looks like.** A pdfmake document has two
 * style surfaces:
 *
 * 1. `styles: Record<string, PdfmakeStyle>` — a named-style map. Nodes
 *    reference styles via `{ text, style: 'h1' }` or
 *    `{ text, style: ['h1', 'bold'] }` (later names override earlier).
 * 2. `defaultStyle: PdfmakeStyle` — applied to **every** node unless
 *    overridden by a named style or inline property.
 *
 * Style resolution order in pdfmake: `defaultStyle` → named styles (in array
 * order) → inline node properties. This shim implements the same precedence
 * inside `mergeStyles()`.
 *
 * **Properties that map into pretext-pdf:**
 * - `font` → element `font` (only on rich-paragraph spans) and, on
 *   `defaultStyle`, the document-level `defaultFont`.
 * - `fontSize` → element `fontSize` and, on `defaultStyle`, document-level
 *   `defaultFontSize`.
 * - `bold` → rich-paragraph span `bold`.
 * - `italics` → rich-paragraph span `italic` (note the rename).
 * - `color` → element `color`.
 * - `alignment` → paragraph/heading `align`.
 *
 * **Properties pdfmake supports that this shim silently drops:**
 * - `lineHeight` / `leading`
 * - `marginLeft` / `marginRight` / `marginTop` / `marginBottom` (named-style
 *   margins; node-level margins are also dropped)
 * - `decoration` (underline / lineThrough / overline) and `decorationStyle`
 * - `background` (highlight color)
 * - `characterSpacing`
 * - `preserveLeadingSpaces` / `noWrap`
 * - `link`, `linkToPage`, `linkToDestination` outside the dedicated `link`
 *   shorthand
 * - Anything else not listed in the `Properties that map` list above
 *
 * If you migrate from pdfmake and notice a missing visual property, it is
 * almost certainly one of the silently-dropped ones above. File an issue
 * with the property name if it is load-bearing for your output.
 *
 * @public
 */
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

// ─── Public entry point ───────────────────────────────────────────────────────

const DEFAULT_HEADING_MAP: Record<string, 1 | 2 | 3 | 4> = {
  header: 1, h1: 1, title: 1,
  subheader: 2, h2: 2,
  h3: 3,
  h4: 4,
}

/**
 * Translate a pdfmake document descriptor into a pretext-pdf {@link PdfDocument}.
 * The result can be passed straight to `render()` from the main entry point.
 *
 * @remarks
 * **defaultStyle handling.** pdfmake's `defaultStyle` field (note: singular —
 * the plural `styles` field is the named-style map) maps onto two
 * document-level pretext-pdf properties:
 *
 * - `defaultStyle.font` → `PdfDocument.defaultFont`
 * - `defaultStyle.fontSize` → `PdfDocument.defaultFontSize`
 *
 * Other `defaultStyle` properties (`bold`, `italics`, `color`, `alignment`)
 * still flow into per-node style merging via `mergeStyles()`, so a document
 * with `defaultStyle: { color: '#444' }` produces nodes whose effective text
 * color is `#444` unless overridden. See {@link PdfmakeStyle} for the full
 * list of supported and silently-dropped properties.
 *
 * @public
 */
export function fromPdfmake(doc: PdfmakeDocument, options: CompatOptions = {}): PdfDocument {
  const headingMap = options.headingMap ?? DEFAULT_HEADING_MAP
  const onUnsupported = options.onUnsupported ?? (() => {})
  const styles = doc.styles ?? {}
  const defaultStyle = doc.defaultStyle ?? {}

  const ctx: TranslateCtx = { styles, defaultStyle, headingMap, onUnsupported }

  const contentArr: PdfmakeNode[] = Array.isArray(doc.content) ? doc.content : [doc.content]
  const content: ContentElement[] = []
  for (const node of contentArr) {
    const els = translateNode(node, ctx)
    for (const el of els) content.push(el)
  }

  const result: PdfDocument = { content }

  // pageSize
  if (doc.pageSize !== undefined) {
    if (typeof doc.pageSize === 'string') {
      const normalized = normalizePageSize(doc.pageSize)
      if (normalized) result.pageSize = normalized
    } else if (typeof doc.pageSize === 'object' && doc.pageSize.width && doc.pageSize.height) {
      const [w, h] = doc.pageOrientation === 'landscape'
        ? [doc.pageSize.height, doc.pageSize.width]
        : [doc.pageSize.width, doc.pageSize.height]
      result.pageSize = [w, h]
    }
  } else if (doc.pageOrientation === 'landscape') {
    // Default A4 swapped to landscape
    result.pageSize = [842, 595]
  }

  // pageMargins ([left, top, right, bottom] OR [horizontal, vertical] OR scalar)
  if (doc.pageMargins !== undefined) {
    const m = normalizeMargins(doc.pageMargins)
    if (m) result.margins = m
  }

  // defaultStyle → defaultFont / defaultFontSize
  if (defaultStyle.font) result.defaultFont = defaultStyle.font
  if (typeof defaultStyle.fontSize === 'number') result.defaultFontSize = defaultStyle.fontSize

  // header / footer — only string-form supported
  const header = normalizeHeaderFooter(doc.header, onUnsupported, 'header')
  if (header) result.header = header
  const footer = normalizeHeaderFooter(doc.footer, onUnsupported, 'footer')
  if (footer) result.footer = footer

  // info → metadata
  if (doc.info) {
    const m: NonNullable<PdfDocument['metadata']> = {}
    if (doc.info.title) m.title = doc.info.title
    if (doc.info.author) m.author = doc.info.author
    if (doc.info.subject) m.subject = doc.info.subject
    if (doc.info.keywords) m.keywords = doc.info.keywords.split(',').map(k => k.trim()).filter(Boolean)
    if (Object.keys(m).length > 0) result.metadata = m
  }

  // Forward allowedFileDirs for security: deny-by-default file:// access
  if (doc.allowedFileDirs !== undefined) {
    result.allowedFileDirs = doc.allowedFileDirs
  }

  return result
}

// ─── Translation context + per-node dispatch ──────────────────────────────────

interface TranslateCtx {
  styles: Record<string, PdfmakeStyle>
  defaultStyle: PdfmakeStyle
  headingMap: Record<string, 1 | 2 | 3 | 4>
  onUnsupported: (feature: string) => void
}

function translateNode(node: PdfmakeNode, ctx: TranslateCtx): ContentElement[] {
  if (typeof node === 'string') {
    return [{ type: 'paragraph', text: node }]
  }
  if (!node || typeof node !== 'object') return []

  // Stack: recurse and inline.
  if (node.stack) {
    const out: ContentElement[] = []
    for (const child of node.stack) {
      for (const el of translateNode(child, ctx)) out.push(el)
    }
    return out
  }

  // Page break (before or after) becomes a sibling page-break element.
  if (node.pageBreak === 'before') {
    const inner = translateNodeInner(node, ctx)
    return [{ type: 'page-break' } satisfies PageBreakElement, ...inner]
  }
  if (node.pageBreak === 'after') {
    const inner = translateNodeInner(node, ctx)
    return [...inner, { type: 'page-break' } satisfies PageBreakElement]
  }

  return translateNodeInner(node, ctx)
}

/** Translate a single pdfmake object node, ignoring stack/pageBreak (handled above). */
function translateNodeInner(node: PdfmakeObjectNode, ctx: TranslateCtx): ContentElement[] {
  // Lists
  if (node.ul) {
    return [{
      type: 'list',
      style: 'unordered',
      items: node.ul.map(item => pdfmakeNodeToListItem(item, ctx)),
    } satisfies ListElement]
  }
  if (node.ol) {
    return [{
      type: 'list',
      style: 'ordered',
      items: node.ol.map(item => pdfmakeNodeToListItem(item, ctx)),
    } satisfies ListElement]
  }

  // Table
  if (node.table) {
    return [translateTable(node.table, ctx)]
  }

  // Image — strip dangerous schemes before forwarding to pretext-pdf.
  // file://, data:, and javascript: are not safe to forward when allowedFileDirs
  // is not set; strip them and warn rather than pass potentially dangerous URLs.
  if (typeof node.image === 'string') {
    const imgSrc = node.image
    const lc = imgSrc.trim().toLowerCase()
    const BLOCKED_SCHEMES = ['file://', 'data:', 'javascript:', 'vbscript:', 'blob:', 'about:']
    if (BLOCKED_SCHEMES.some(s => lc.startsWith(s))) {
      // Scheme is not safe to forward — return empty to skip the image
      return []
    }
    const img: ImageElement = { type: 'image', src: imgSrc }
    if (typeof node.width === 'number') img.width = node.width
    if (typeof node.height === 'number') img.height = node.height
    return [img]
  }

  // QR code
  if (typeof node.qr === 'string') {
    const qr: QrCodeElement = { type: 'qr-code', data: node.qr }
    if (typeof node.fit === 'number') qr.size = node.fit
    else if (Array.isArray(node.fit) && typeof node.fit[0] === 'number') qr.size = node.fit[0]
    return [qr]
  }

  // Columns — pretext-pdf doesn't render multi-column at the document layout
  // level (only paragraph.columns for text columns), so we flatten and warn
  // once. Existing pdfmake docs that use columns mostly do so for layout
  // tweaks that aren't load-bearing.
  if (node.columns) {
    ctx.onUnsupported('columns (flattened into a stack of children)')
    const out: ContentElement[] = []
    for (const child of node.columns) {
      for (const el of translateNode(child, ctx)) out.push(el)
    }
    return out
  }

  if (node.canvas) {
    ctx.onUnsupported('canvas (skipped)')
    return []
  }

  // Text node — paragraph, rich-paragraph, or heading depending on style/structure
  if (node.text !== undefined) {
    return [translateTextNode(node, ctx)]
  }

  return []
}

// ─── Text / heading translation ───────────────────────────────────────────────

function translateTextNode(node: PdfmakeObjectNode, ctx: TranslateCtx): ContentElement {
  const styleNames = normalizeStyleNames(node.style)
  const merged = mergeStyles(ctx, styleNames, node)

  // Heading detection: first matching style name in headingMap wins.
  let headingLevel: 1 | 2 | 3 | 4 | undefined
  for (const name of styleNames) {
    if (ctx.headingMap[name] !== undefined) {
      headingLevel = ctx.headingMap[name]
      break
    }
  }

  // Flatten the text payload into either a single string or an array of spans.
  const flatText = typeof node.text === 'string' ? node.text : null
  const childArray = Array.isArray(node.text) ? node.text : (node.text && typeof node.text === 'object' ? [node.text] : [])

  if (headingLevel !== undefined) {
    const heading: HeadingElement = {
      type: 'heading',
      level: headingLevel,
      text: flatText ?? extractFlatText(childArray, ctx),
    }
    if (merged.fontSize !== undefined) heading.fontSize = merged.fontSize
    if (merged.color) heading.color = merged.color
    const headingAlign = pdfmakeAlignToPretext(merged.alignment)
    if (headingAlign) heading.align = headingAlign
    if (merged.font) heading.fontFamily = merged.font
    return heading
  }

  // Plain paragraph: text is a single string and no nested span styling needed.
  if (flatText !== null) {
    const para: ParagraphElement = { type: 'paragraph', text: flatText }
    applyStyleToParagraph(para, merged)
    return para
  }

  // Rich paragraph: text is an array of (potentially styled) child nodes.
  const spans: InlineSpan[] = []
  for (const child of childArray) collectSpans(child, ctx, merged, spans)
  // If every span is identical-style and just text, downgrade to paragraph.
  if (spans.length === 1 && !spans[0]!.fontWeight && !spans[0]!.fontStyle && !spans[0]!.color && !spans[0]!.href && !spans[0]!.fontSize) {
    const para: ParagraphElement = { type: 'paragraph', text: spans[0]!.text }
    applyStyleToParagraph(para, merged)
    return para
  }
  const rich: RichParagraphElement = { type: 'rich-paragraph', spans }
  if (merged.fontSize !== undefined) rich.fontSize = merged.fontSize
  const richAlign = pdfmakeAlignToPretext(merged.alignment)
  if (richAlign) rich.align = richAlign
  return rich
}

function applyStyleToParagraph(para: ParagraphElement, s: PdfmakeStyle): void {
  if (s.fontSize !== undefined) para.fontSize = s.fontSize
  if (s.color) para.color = s.color
  if (s.bold) para.fontWeight = 700
  const paraAlign = pdfmakeAlignToPretext(s.alignment)
  if (paraAlign) para.align = paraAlign
  if (s.font) para.fontFamily = s.font
}

function collectSpans(child: PdfmakeNode, ctx: TranslateCtx, parent: PdfmakeStyle, out: InlineSpan[]): void {
  if (typeof child === 'string') {
    const span: InlineSpan = { text: child }
    if (parent.bold) span.fontWeight = 700
    if (parent.italics) span.fontStyle = 'italic'
    if (parent.color) span.color = parent.color
    if (parent.fontSize !== undefined) span.fontSize = parent.fontSize
    if (parent.font) span.fontFamily = parent.font
    out.push(span)
    return
  }
  if (!child || typeof child !== 'object') return
  const styleNames = normalizeStyleNames(child.style)
  const merged = mergeStyles(ctx, styleNames, child, parent)
  // Recurse into nested arrays
  if (Array.isArray(child.text)) {
    for (const grand of child.text) collectSpans(grand, ctx, merged, out)
    return
  }
  if (typeof child.text === 'string') {
    const span: InlineSpan = { text: child.text }
    if (merged.bold) span.fontWeight = 700
    if (merged.italics) span.fontStyle = 'italic'
    if (merged.color) span.color = merged.color
    if (merged.fontSize !== undefined) span.fontSize = merged.fontSize
    if (merged.font) span.fontFamily = merged.font
    if (typeof child.link === 'string') span.href = child.link
    out.push(span)
  }
}

function extractFlatText(children: PdfmakeNode[], ctx: TranslateCtx): string {
  const buf: string[] = []
  for (const c of children) {
    if (typeof c === 'string') { buf.push(c); continue }
    if (typeof c.text === 'string') { buf.push(c.text); continue }
    if (Array.isArray(c.text)) buf.push(extractFlatText(c.text, ctx))
  }
  return buf.join('')
}

// ─── Table ────────────────────────────────────────────────────────────────────

function translateTable(t: NonNullable<PdfmakeObjectNode['table']>, ctx: TranslateCtx): TableElement {
  const colCount = t.body[0]?.length ?? 0
  const widths = t.widths ?? new Array(colCount).fill('*')
  const columns: ColumnDef[] = widths.map((w): ColumnDef => {
    if (typeof w === 'number') return { width: w }
    if (w === '*') return { width: '1*' }
    if (w === 'auto') return { width: 'auto' as unknown as number }  // pretext-pdf's 'auto' is still a string in the type
    if (typeof w === 'string' && /^\d*\.?\d+\*$/.test(w)) return { width: w }
    return { width: '1*' }
  })

  const headerRows = t.headerRows ?? 0
  const rows: TableRow[] = t.body.map((row, idx) => {
    const isHeader = idx < headerRows
    const cells = row.map(cell => {
      if (typeof cell === 'string') return { text: cell, ...(isHeader ? { fontWeight: 700 as const } : {}) }
      if (cell && typeof cell === 'object') {
        const styleNames = normalizeStyleNames(cell.style)
        const merged = mergeStyles(ctx, styleNames, cell)
        const text = typeof cell.text === 'string' ? cell.text : (Array.isArray(cell.text) ? extractFlatText(cell.text, ctx) : '')
        const tcell: { text: string; fontWeight?: 400 | 700; color?: string; align?: 'left' | 'center' | 'right'; fontSize?: number } = { text }
        if (merged.bold || isHeader) tcell.fontWeight = 700
        if (merged.color) tcell.color = merged.color
        if (merged.alignment && merged.alignment !== 'justify') tcell.align = merged.alignment
        if (merged.fontSize !== undefined) tcell.fontSize = merged.fontSize
        return tcell
      }
      return { text: '' }
    })
    return isHeader ? { isHeader: true, cells } : { cells }
  })

  return { type: 'table', columns, rows }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pdfmakeAlignToPretext(a: PdfmakeStyle['alignment']): 'left' | 'center' | 'right' | 'justify' | undefined {
  if (a === 'left' || a === 'center' || a === 'right' || a === 'justify') return a
  return undefined
}

function normalizeStyleNames(s: string | string[] | undefined): string[] {
  if (!s) return []
  return Array.isArray(s) ? s : [s]
}

function mergeStyles(
  ctx: TranslateCtx,
  styleNames: string[],
  node: PdfmakeObjectNode,
  parent?: PdfmakeStyle,
): PdfmakeStyle {
  const merged: PdfmakeStyle = { ...ctx.defaultStyle, ...(parent ?? {}) }
  for (const name of styleNames) {
    const s = ctx.styles[name]
    if (s) copySafeStyleProperties(merged, s)
  }
  // Inline node-level overrides win
  if (node.bold !== undefined) merged.bold = node.bold
  if (node.italics !== undefined) merged.italics = node.italics
  if (node.color !== undefined) merged.color = node.color
  if (node.fontSize !== undefined) merged.fontSize = node.fontSize
  if (node.alignment !== undefined) merged.alignment = node.alignment
  if (node.font !== undefined) merged.font = node.font
  return merged
}

/** Copy only known-safe style properties, preventing prototype pollution */
function copySafeStyleProperties(target: PdfmakeStyle, source: any): void {
  const safeKeys: (keyof PdfmakeStyle)[] = ['fontSize', 'bold', 'italics', 'color', 'alignment', 'font']
  for (const key of safeKeys) {
    if (key in source && source[key] !== undefined) {
      (target as any)[key] = source[key]
    }
  }
}

function pdfmakeNodeToListItem(node: PdfmakeNode, ctx: TranslateCtx): ListItem {
  if (typeof node === 'string') return { text: node }
  if (node && typeof node === 'object') {
    if (node.ul || node.ol) {
      // Nested list — pdfmake nests via { ul: [...] } as a child item.
      const items = (node.ul ?? node.ol ?? []).map(i => pdfmakeNodeToListItem(i, ctx))
      return { text: '', items }
    }
    if (typeof node.text === 'string') return { text: node.text }
    if (Array.isArray(node.text)) return { text: extractFlatText(node.text, ctx) }
  }
  return { text: '' }
}

function normalizePageSize(name: string): import('./page-sizes.js').NamedPageSize | null {
  const n = name.trim()
  // pdfmake commonly uses uppercase ('LETTER', 'A4'); pretext-pdf uses 'Letter', 'A4'.
  const map: Record<string, import('./page-sizes.js').NamedPageSize> = {
    A3: 'A3', A4: 'A4', A5: 'A5',
    LETTER: 'Letter', Letter: 'Letter', letter: 'Letter',
    LEGAL: 'Legal', Legal: 'Legal', legal: 'Legal',
    TABLOID: 'Tabloid', Tabloid: 'Tabloid', tabloid: 'Tabloid',
  }
  return map[n] ?? null
}

function normalizeMargins(m: number | [number, number] | [number, number, number, number]): Margins | null {
  if (typeof m === 'number') return { top: m, bottom: m, left: m, right: m }
  if (Array.isArray(m)) {
    if (m.length === 2) return { left: m[0], top: m[1], right: m[0], bottom: m[1] }
    if (m.length === 4) return { left: m[0], top: m[1], right: m[2], bottom: m[3] }
  }
  return null
}

function normalizeHeaderFooter(
  hf: PdfmakeDocument['header'] | PdfmakeDocument['footer'],
  onUnsupported: (f: string) => void,
  label: 'header' | 'footer'
): HeaderFooterSpec | null {
  if (hf === undefined) return null
  if (typeof hf === 'function') { onUnsupported(`${label} (function form not supported — pass a string instead)`); return null }
  if (typeof hf === 'string') return { text: hf }
  if (typeof hf === 'object' && typeof hf.text === 'string') {
    const out: HeaderFooterSpec = { text: hf.text }
    if (hf.alignment === 'left' || hf.alignment === 'center' || hf.alignment === 'right') out.align = hf.alignment
    if (typeof hf.fontSize === 'number') out.fontSize = hf.fontSize
    if (hf.color) out.color = hf.color
    return out
  }
  return null
}
