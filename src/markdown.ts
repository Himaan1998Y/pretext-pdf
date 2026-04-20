import type { Token, Tokens } from 'marked'
import type {
  ContentElement,
  HeadingElement,
  ParagraphElement,
  RichParagraphElement,
  ListElement,
  ListItem,
  BlockquoteElement,
  HorizontalRuleElement,
  InlineSpan,
  TableElement,
  ColumnDef,
  TableRow,
} from './types.js'
import { PretextPdfError } from './errors.js'

export interface MarkdownOptions {
  /** Font family for body text. Default: document default */
  fontFamily?: string
  /** Font size for body text in pt. Default: document default */
  fontSize?: number
  /** Font family for code blocks — required to emit CodeBlockElement; omit to render code as plain text. */
  codeFontFamily?: string
  /** Space below each converted element in pt. Default: 0 (uses document defaults) */
  spaceAfter?: number
}

/**
 * Convert a Markdown string into an array of pretext-pdf ContentElement objects.
 *
 * Requires the `marked` package (optional peer dep). Install: npm install marked
 *
 * Supported Markdown:
 *   - Headings h1–h4 (h5/h6 collapse to h4)
 *   - Paragraphs with inline bold / italic / strikethrough / code / links
 *   - Ordered and unordered lists, recursive nesting
 *   - GFM task lists: `- [x] done` and `- [ ] todo` render as ☑ / ☐
 *   - GFM tables (with column alignment from `:---:`/`---:` markers)
 *   - Fenced code blocks (requires codeFontFamily option for styled rendering)
 *   - Blockquotes
 *   - Horizontal rules
 *
 * HTML tokens and unknown token types are silently skipped.
 */
export async function markdownToContent(
  markdown: string,
  options: MarkdownOptions = {}
): Promise<ContentElement[]> {
  let markedModule: { marked: { lexer: (s: string) => Token[] } }
  try {
    markedModule = await import('marked' as string) as typeof markedModule
  } catch {
    throw new PretextPdfError(
      'MARKDOWN_DEP_MISSING',
      'markdownToContent() requires the marked package. Install it: npm install marked'
    )
  }

  const tokens = markedModule.marked.lexer(markdown)
  const elements: ContentElement[] = []

  for (const token of tokens) {
    const converted = convertToken(token as Token, options)
    if (converted === null) continue
    if (Array.isArray(converted)) elements.push(...converted)
    else elements.push(converted)
  }

  return elements
}

// ─── Token converters ─────────────────────────────────────────────────────────

function convertToken(
  token: Token,
  options: MarkdownOptions
): ContentElement | ContentElement[] | null {
  switch (token.type) {
    case 'heading': return convertHeading(token as Tokens.Heading)
    case 'paragraph': return convertParagraph(token as Tokens.Paragraph, options)
    case 'list': return convertList(token as Tokens.List)
    case 'table': return convertTable(token as Tokens.Table)
    case 'code': return convertCode(token as Tokens.Code, options)
    case 'blockquote': return convertBlockquote(token as Tokens.Blockquote)
    case 'hr': return { type: 'hr' } satisfies HorizontalRuleElement
    case 'space': return null
    case 'html': return null
    default: return null
  }
}

function convertHeading(token: Tokens.Heading): HeadingElement {
  const level = Math.min(Math.max(token.depth, 1), 4) as 1 | 2 | 3 | 4
  return { type: 'heading', level, text: extractPlainText(token.tokens ?? []) }
}

function convertParagraph(
  token: Tokens.Paragraph,
  options: MarkdownOptions
): ParagraphElement | RichParagraphElement {
  const inline = token.tokens ?? []

  if (isAllPlainText(inline)) {
    const el: ParagraphElement = { type: 'paragraph', text: extractPlainText(inline) }
    if (options.spaceAfter !== undefined) el.spaceAfter = options.spaceAfter
    return el
  }

  const spans = inlineTokensToSpans(inline)
  const el: RichParagraphElement = { type: 'rich-paragraph', spans }
  if (options.spaceAfter !== undefined) el.spaceAfter = options.spaceAfter
  return el
}

function convertList(token: Tokens.List): ListElement {
  return {
    type: 'list',
    style: token.ordered ? 'ordered' : 'unordered',
    items: token.items.map(item => convertListItem(item)),
  }
}

function convertListItem(item: Tokens.ListItem): ListItem {
  let text = ''
  const nestedItems: ListItem[] = []

  for (const token of item.tokens) {
    if (token.type === 'text') {
      const t = token as Tokens.Text
      text += t.tokens ? extractPlainText(t.tokens) : t.text
    } else if (token.type === 'paragraph') {
      // Marked emits paragraph tokens (not text) for list items separated by
      // blank lines. Extract the plain text so that content isn't dropped.
      const p = token as Tokens.Paragraph
      text += (text ? ' ' : '') + (p.tokens ? extractPlainText(p.tokens) : p.text)
    } else if (token.type === 'list') {
      // Recurse so deeper-than-2-level nesting is preserved instead of being
      // silently flattened to a single text-only leaf.
      const nested = token as Tokens.List
      for (const nestedItem of nested.items) {
        nestedItems.push(convertListItem(nestedItem))
      }
    }
  }

  // GFM task list: `- [x] done` / `- [ ] todo` → ☑ / ☐ prefix.
  // marked sets `task: true` and `checked: boolean` on the item.
  if (item.task) {
    const marker = item.checked ? '\u2611' : '\u2610' // ☑ ☐
    text = `${marker} ${text}`
  }

  const result: ListItem = { text: text.trim() }
  if (nestedItems.length > 0) result.items = nestedItems
  return result
}

function convertTable(token: Tokens.Table): TableElement {
  // GFM tables. Header alignment from `:---:`/`---:` markers ends up in
  // token.align as 'left' | 'center' | 'right' | null per column.
  const colCount = token.header.length
  const columns: ColumnDef[] = token.header.map((_, i) => {
    const align = token.align[i]
    const col: ColumnDef = { width: '1*' }
    if (align === 'left' || align === 'center' || align === 'right') col.align = align
    return col
  })

  const headerRow: TableRow = {
    isHeader: true,
    cells: token.header.map(h => ({
      text: extractPlainText(h.tokens ?? []),
      fontWeight: 700 as const,
    })),
  }

  const bodyRows: TableRow[] = token.rows.map(row => ({
    cells: row.map(cell => ({
      text: extractPlainText(cell.tokens ?? []),
    })),
  }))

  // Pad short rows so every row has colCount cells (markdown sometimes emits
  // ragged rows on malformed input).
  for (const row of bodyRows) {
    while (row.cells.length < colCount) row.cells.push({ text: '' })
    row.cells.length = colCount
  }

  return {
    type: 'table',
    columns,
    rows: [headerRow, ...bodyRows],
  }
}

function convertCode(token: Tokens.Code, options: MarkdownOptions): ContentElement {
  if (options.codeFontFamily) {
    return {
      type: 'code',
      text: token.text,
      fontFamily: options.codeFontFamily,
      ...(token.lang ? { language: token.lang } : {}),
    } as ContentElement
  }
  return { type: 'paragraph', text: token.text } satisfies ParagraphElement
}

function convertBlockquote(token: Tokens.Blockquote): BlockquoteElement {
  let text = ''
  if (token.tokens) {
    for (const t of token.tokens) {
      if (t.type === 'paragraph') {
        text += (text ? ' ' : '') + extractPlainText((t as Tokens.Paragraph).tokens ?? [])
      }
    }
  }
  if (!text) text = token.text
  return { type: 'blockquote', text }
}

// ─── Inline token helpers ─────────────────────────────────────────────────────

function isAllPlainText(tokens: Token[]): boolean {
  return tokens.every(t => t.type === 'text' || t.type === 'space' || t.type === 'escape' || t.type === 'br')
}

function extractPlainText(tokens: Token[]): string {
  return tokens.map(t => {
    if (t.type === 'text') return (t as Tokens.Text).text
    if (t.type === 'strong') return extractPlainText((t as Tokens.Strong).tokens ?? [])
    if (t.type === 'em') return extractPlainText((t as Tokens.Em).tokens ?? [])
    if (t.type === 'codespan') return (t as Tokens.Codespan).text
    if (t.type === 'link') return extractPlainText((t as Tokens.Link).tokens ?? [])
    if (t.type === 'del') return extractPlainText(((t as unknown) as { tokens?: Token[] }).tokens ?? [])
    if (t.type === 'escape') return (t as Tokens.Escape).text
    if (t.type === 'br') return ' '
    if (t.type === 'image') return (t as Tokens.Image).text || ''
    if (t.type === 'space') return ' '
    return ''
  }).join('')
}

function inlineTokensToSpans(tokens: Token[]): InlineSpan[] {
  const spans: InlineSpan[] = []

  for (const token of tokens) {
    if (token.type === 'text') {
      const text = (token as Tokens.Text).text
      if (text) spans.push({ text })
    } else if (token.type === 'strong') {
      const t = token as Tokens.Strong
      const inner = t.tokens ?? []
      if (inner.length === 1 && inner[0]!.type === 'text') {
        spans.push({ text: (inner[0] as Tokens.Text).text, fontWeight: 700 })
      } else {
        for (const s of inlineTokensToSpans(inner)) spans.push({ ...s, fontWeight: 700 })
      }
    } else if (token.type === 'em') {
      const t = token as Tokens.Em
      const inner = t.tokens ?? []
      if (inner.length === 1 && inner[0]!.type === 'text') {
        spans.push({ text: (inner[0] as Tokens.Text).text, fontStyle: 'italic' })
      } else {
        for (const s of inlineTokensToSpans(inner)) spans.push({ ...s, fontStyle: 'italic' })
      }
    } else if (token.type === 'codespan') {
      spans.push({ text: (token as Tokens.Codespan).text })
    } else if (token.type === 'link') {
      const t = token as Tokens.Link
      const text = extractPlainText(t.tokens ?? [])
      if (text) spans.push({ text, href: t.href })
    } else if (token.type === 'del') {
      const inner = ((token as unknown) as { tokens?: Token[] }).tokens ?? []
      for (const s of inlineTokensToSpans(inner)) spans.push({ ...s, strikethrough: true })
    } else if (token.type === 'escape') {
      const text = (token as Tokens.Escape).text
      if (text) spans.push({ text })
    } else if (token.type === 'br') {
      spans.push({ text: ' ' })
    } else if (token.type === 'image') {
      const altText = (token as Tokens.Image).text
      if (altText) spans.push({ text: altText })
    } else if (token.type === 'space') {
      spans.push({ text: ' ' })
    }
  }

  return spans
}
