/**
 * measure-blocks/highlight.ts — Syntax highlighting for code blocks.
 *
 * NOTE: _hljsCache and _hljsLoadAttempted are intentionally module-scoped here.
 * They implement process-wide idempotent caching of the dynamic highlight.js
 * import. Do not thread these through a context object — module state is correct.
 */

/** Default GitHub-light-inspired highlight theme colors */
export const DEFAULT_HIGHLIGHT_THEME: Record<string, string> = {
  keyword:  '#cf222e',
  string:   '#0a3069',
  comment:  '#6e7781',
  number:   '#0550ae',
  function: '#8250df',
  title:    '#8250df',
  built_in: '#0550ae',
  literal:  '#0550ae',
  type:     '#953800',
  meta:     '#cf222e',
  attr:     '#0550ae',
  name:     '#0550ae',
  params:   '#24292f',
  punctuation: '#24292f',
  operator: '#24292f',
  regexp:   '#0a3069',
  variable: '#953800',
  property: '#0550ae',
  tag:      '#116329',
  selector: '#116329',
  subst:    '#24292f',
  'template-tag':    '#cf222e',
  'template-string': '#0a3069',
  symbol:   '#0550ae',
  addition: '#116329',
  deletion: '#cf222e',
  section:  '#0550ae',
}

/** Cached highlight.js module (loaded once, reused across code blocks) */
let _hljsCache: any = null
let _hljsLoadAttempted = false

/**
 * Tokenize source code into per-line colored spans using highlight.js.
 * Returns undefined if highlight.js is not installed (renderer falls back to plain text).
 */
export async function tokenizeCodeForHighlighting(
  text: string,
  language: string,
  defaultColor: string,
  measuredLineCount: number,
  customTheme?: Record<string, string | undefined>
): Promise<Array<Array<{ text: string; color: string }>> | undefined> {
  if (!_hljsLoadAttempted) {
    _hljsLoadAttempted = true
    try {
      const mod = await import('highlight.js' as string)
      _hljsCache = mod.default ?? mod
    } catch { /* not installed */ }
  }
  if (!_hljsCache) return undefined
  const hljs = _hljsCache

  const theme: Record<string, string> = { ...DEFAULT_HIGHLIGHT_THEME }
  if (customTheme) {
    for (const [k, v] of Object.entries(customTheme)) {
      if (v !== undefined) theme[k] = v
    }
  }

  let highlighted: string
  try {
    const result = language === 'auto'
      ? hljs.highlightAuto(text)
      : hljs.highlight(text, { language })
    highlighted = result.value
  } catch {
    return undefined
  }

  const tokens = parseHighlightHtml(highlighted, defaultColor, theme)

  // Safety check: tokenizer splits on \n but the layout engine may wrap long lines.
  // If line counts don't match, the colors would be applied to the wrong lines.
  if (tokens.length !== measuredLineCount) return undefined

  return tokens
}

/**
 * Parse highlight.js HTML into per-line token arrays.
 * Handles nested spans (e.g. string interpolation) by tracking a color stack.
 */
export function parseHighlightHtml(
  html: string,
  defaultColor: string,
  theme: Record<string, string>
): Array<Array<{ text: string; color: string }>> {
  const lines: Array<Array<{ text: string; color: string }>> = [[]]
  const colorStack: string[] = [defaultColor]

  let i = 0
  while (i < html.length) {
    if (html[i] === '<') {
      const closeTag = html.indexOf('>', i)
      if (closeTag === -1) break
      const tag = html.slice(i, closeTag + 1)

      if (tag.startsWith('<span')) {
        // Extract class: <span class="hljs-keyword"> or <span class="hljs-template-string">
        const classMatch = tag.match(/class="hljs-([\w-]+)"/)
        const cls = classMatch ? classMatch[1]! : ''
        colorStack.push(theme[cls] ?? defaultColor)
      } else if (tag === '</span>') {
        if (colorStack.length > 1) colorStack.pop()
      }
      i = closeTag + 1
    } else if (html[i] === '&') {
      // HTML entities: named (&amp;), hex (&#x3D;), decimal (&#96;)
      const semi = html.indexOf(';', i)
      if (semi !== -1 && semi - i < 10) {
        const entity = html.slice(i, semi + 1)
        let ch: string
        if (entity === '&amp;') ch = '&'
        else if (entity === '&lt;') ch = '<'
        else if (entity === '&gt;') ch = '>'
        else if (entity === '&quot;') ch = '"'
        else if (entity === '&#x27;' || entity === '&apos;') ch = "'"
        else if (entity.startsWith('&#x')) ch = String.fromCodePoint(parseInt(entity.slice(3, -1), 16))
        else if (entity.startsWith('&#')) ch = String.fromCodePoint(parseInt(entity.slice(2, -1), 10))
        else ch = entity // unknown named entity — keep as-is
        lines[lines.length - 1]!.push({ text: ch, color: colorStack[colorStack.length - 1]! })
        i = semi + 1
      } else {
        lines[lines.length - 1]!.push({ text: '&', color: colorStack[colorStack.length - 1]! })
        i++
      }
    } else if (html[i] === '\n') {
      lines.push([])
      i++
    } else {
      // Regular text — accumulate consecutive chars with same color
      const color = colorStack[colorStack.length - 1]!
      let end = i + 1
      while (end < html.length && html[end] !== '<' && html[end] !== '&' && html[end] !== '\n') end++
      lines[lines.length - 1]!.push({ text: html.slice(i, end), color })
      i = end
    }
  }

  // Merge adjacent tokens with the same color on each line (fewer drawText calls)
  for (const line of lines) {
    for (let j = line.length - 1; j > 0; j--) {
      if (line[j]!.color === line[j - 1]!.color) {
        line[j - 1]!.text += line[j]!.text
        line.splice(j, 1)
      }
    }
  }

  return lines
}
