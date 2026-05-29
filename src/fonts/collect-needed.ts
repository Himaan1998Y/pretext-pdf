/** Scan document to collect every unique font variant needed. */

import type { PdfDocument, FontSpec } from '../types.js'
import { PretextPdfError } from '../errors.js'
import { buildFontKey } from '../font-key.js'

/**
 * Returns a Map from fontKey → FontSpec-like descriptor for every font variant
 * referenced in the document (content + header/footer/watermark/signature).
 */
export function collectNeededFonts(doc: PdfDocument): Map<string, FontSpec & { src: string | Uint8Array | 'bundled' }> {
  const needed = new Map<string, FontSpec & { src: string | Uint8Array | 'bundled' }>()
  const defaultFamily = doc.defaultFont ?? 'Inter'

  const userFonts = new Map<string, FontSpec>()
  for (const f of doc.fonts ?? []) {
    const key = buildFontKey(f.family, f.weight ?? 400, f.style ?? 'normal')
    userFonts.set(key, f)
  }

  const addFont = (family: string, weight: 400 | 700, style: 'normal' | 'italic') => {
    const key = buildFontKey(family, weight, style)
    if (needed.has(key)) return

    const userFont = userFonts.get(key)
    if (userFont) {
      needed.set(key, { ...userFont, src: userFont.src })
    } else if (family === 'Inter') {
      needed.set(key, { family, weight, style, src: 'bundled' })
    } else {
      throw new PretextPdfError(
        'FONT_EMBED_FAILED',
        `Font variant "${key}" is used in the document but was not found in doc.fonts. Make sure all custom fonts are declared in doc.fonts[]. If using a bundled font, check the font family name matches exactly.`
      )
    }
  }

  addFont(defaultFamily, 400, 'normal')

  for (const el of doc.content) {
    if (el.type === 'paragraph') {
      addFont(el.fontFamily ?? defaultFamily, el.fontWeight ?? 400, 'normal')
    } else if (el.type === 'heading') {
      addFont(el.fontFamily ?? defaultFamily, el.fontWeight ?? 700, 'normal')
    } else if (el.type === 'code') {
      addFont(el.fontFamily, 400, 'normal')
    } else if (el.type === 'rich-paragraph') {
      for (const span of el.spans) {
        addFont(span.fontFamily ?? defaultFamily, span.fontWeight ?? 400, span.fontStyle ?? 'normal')
      }
    } else if (el.type === 'list') {
      for (const item of el.items) {
        if ((item.fontWeight ?? 400) === 700) addFont(defaultFamily, 700, 'normal')
        for (const nested of item.items ?? []) {
          if ((nested.fontWeight ?? 400) === 700) addFont(defaultFamily, 700, 'normal')
        }
      }
    } else if (el.type === 'table') {
      addFont(defaultFamily, 400, 'normal')
      for (const row of el.rows) {
        for (const cell of row.cells) {
          addFont(cell.fontFamily ?? defaultFamily, cell.fontWeight ?? (row.isHeader ? 700 : 400), 'normal')
        }
        if (row.isHeader) addFont(defaultFamily, 700, 'normal')
      }
    } else if (el.type === 'blockquote') {
      addFont(el.fontFamily ?? defaultFamily, el.fontWeight ?? 400, el.fontStyle ?? 'normal')
    } else if (el.type === 'image' && el.floatFontFamily) {
      addFont(el.floatFontFamily, 400, 'normal')
    } else if (el.type === 'footnote-def') {
      addFont(el.fontFamily ?? defaultFamily, 400, 'normal')
    }
  }

  if (doc.header) addFont(doc.header.fontFamily ?? defaultFamily, doc.header.fontWeight ?? 400, 'normal')
  if (doc.footer) addFont(doc.footer.fontFamily ?? defaultFamily, doc.footer.fontWeight ?? 400, 'normal')
  if (doc.watermark?.text) addFont(doc.watermark.fontFamily ?? defaultFamily, doc.watermark.fontWeight ?? 400, 'normal')

  return needed
}
