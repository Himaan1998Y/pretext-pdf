/**
 * Walk all content elements + header/footer/watermark/signature and collect
 * text strings grouped by font key for font subsetting.
 *
 * Returns: Map<fontKey, concatenated text string>
 */
import type { PdfDocument } from '../types.js'
import { buildFontKey } from '../font-key.js'

export function collectTextByFont(doc: PdfDocument): Map<string, string> {
  const defaultFont = doc.defaultFont ?? 'Inter'
  const textSets = new Map<string, Set<string>>()

  function addText(fontKey: string, text: string) {
    if (!textSets.has(fontKey)) textSets.set(fontKey, new Set())
    textSets.get(fontKey)!.add(text)
  }

  for (const el of doc.content) {
    switch (el.type) {
      case 'paragraph': {
        const key = buildFontKey(el.fontFamily ?? defaultFont, el.fontWeight ?? 400, 'normal')
        addText(key, el.text)
        break
      }
      case 'heading': {
        const key = buildFontKey(el.fontFamily ?? defaultFont, el.fontWeight ?? 700, 'normal')
        addText(key, el.text)
        break
      }
      case 'blockquote': {
        const key = buildFontKey(el.fontFamily ?? defaultFont, el.fontWeight ?? 400, el.fontStyle ?? 'normal')
        addText(key, el.text)
        break
      }
      case 'code': {
        const key = buildFontKey(el.fontFamily, 400, 'normal')
        addText(key, el.text)
        break
      }
      case 'rich-paragraph': {
        for (const span of el.spans) {
          const key = buildFontKey(span.fontFamily ?? defaultFont, span.fontWeight ?? 400, span.fontStyle ?? 'normal')
          addText(key, span.text)
        }
        break
      }
      case 'table': {
        for (const row of el.rows) {
          for (const cell of row.cells) {
            const key = buildFontKey(cell.fontFamily ?? defaultFont, cell.fontWeight ?? (row.isHeader ? 700 : 400), 'normal')
            addText(key, cell.text)
          }
        }
        break
      }
      case 'list': {
        const listFont = buildFontKey(defaultFont, 400, 'normal')
        if (el.style === 'ordered') {
          addText(listFont, '0123456789.')
        } else {
          addText(listFont, el.marker ?? '•')
          addText(listFont, '◦')
        }
        const collectItems = (items: import('../types.js').ListItem[]) => {
          for (const item of items) {
            const key = buildFontKey(defaultFont, item.fontWeight ?? 400, 'normal')
            addText(key, item.text)
            if (item.items) collectItems(item.items)
          }
        }
        collectItems(el.items)
        break
      }
      case 'footnote-def': {
        const key = buildFontKey(el.fontFamily ?? defaultFont, 400, 'normal')
        addText(key, el.text)
        break
      }
      case 'callout': {
        const key = buildFontKey(el.fontFamily ?? defaultFont, el.fontWeight ?? 400, 'normal')
        addText(key, el.content)
        if (el.title) {
          const titleKey = buildFontKey(el.fontFamily ?? defaultFont, 700, 'normal')
          addText(titleKey, el.title)
        }
        break
      }
      case 'form-field': {
        const key = buildFontKey(defaultFont, 400, 'normal')
        if (el.label) addText(key, el.label)
        if (el.fieldType === 'text') {
          if (el.placeholder) addText(key, el.placeholder)
          if (typeof el.defaultValue === 'string') addText(key, el.defaultValue)
        }
        if (el.fieldType === 'radio' || el.fieldType === 'dropdown') {
          for (const opt of el.options) addText(key, opt.label)
        }
        break
      }
      case 'float-group': {
        for (const contentEl of el.content) {
          if (contentEl.type === 'paragraph') {
            const key = buildFontKey(contentEl.fontFamily ?? defaultFont, contentEl.fontWeight ?? 400, 'normal')
            addText(key, contentEl.text)
          } else if (contentEl.type === 'heading') {
            const key = buildFontKey(contentEl.fontFamily ?? defaultFont, contentEl.fontWeight ?? 700, 'normal')
            addText(key, contentEl.text)
          } else if (contentEl.type === 'rich-paragraph') {
            for (const span of contentEl.spans) {
              const key = buildFontKey(span.fontFamily ?? defaultFont, span.fontWeight ?? 400, span.fontStyle ?? 'normal')
              addText(key, span.text)
            }
          }
        }
        break
      }
      default:
        break
    }
  }

  const DIGITS = '0123456789'
  if (doc.header) {
    const key = buildFontKey(doc.header.fontFamily ?? defaultFont, doc.header.fontWeight ?? 400, 'normal')
    addText(key, doc.header.text + DIGITS)
  }
  if (doc.footer) {
    const key = buildFontKey(doc.footer.fontFamily ?? defaultFont, doc.footer.fontWeight ?? 400, 'normal')
    addText(key, doc.footer.text + DIGITS)
  }

  if (doc.sections) {
    for (const section of doc.sections) {
      if (section.header) {
        const key = buildFontKey(section.header.fontFamily ?? defaultFont, section.header.fontWeight ?? 400, 'normal')
        addText(key, section.header.text + DIGITS)
      }
      if (section.footer) {
        const key = buildFontKey(section.footer.fontFamily ?? defaultFont, section.footer.fontWeight ?? 400, 'normal')
        addText(key, section.footer.text + DIGITS)
      }
    }
  }

  if (doc.watermark?.text) {
    const key = buildFontKey(doc.watermark.fontFamily ?? defaultFont, doc.watermark.fontWeight ?? 400, 'normal')
    addText(key, doc.watermark.text)
  }

  if (doc.signature) {
    const sigKey = buildFontKey(defaultFont, 400, 'normal')
    addText(sigKey, 'Signed by: Signature Date')
    if (doc.signature.signerName) addText(sigKey, doc.signature.signerName)
    if (doc.signature.reason) addText(sigKey, doc.signature.reason)
    if (doc.signature.location) addText(sigKey, doc.signature.location)
  }

  const result = new Map<string, string>()
  for (const [key, texts] of textSets) {
    result.set(key, Array.from(texts).join(''))
  }
  return result
}
