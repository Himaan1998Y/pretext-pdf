/**
 * validate/fonts.ts — Whole-document font reference validation.
 * Extracted from src/validate.ts (#11a).
 *
 * Validates that every font family referenced anywhere in the document
 * is either bundled (Inter) or present in doc.fonts. Catches problems early
 * instead of silently falling back or dropping content.
 */
import type { PdfDocument } from '../types.js'
import { PretextPdfError } from '../errors.js'
import { BUNDLED_VARIANTS } from './helpers.js'

export function validateFontReferences(doc: PdfDocument, loadedFamilies: Set<string>): void {
  const defaultFamily = doc.defaultFont ?? 'Inter'

  // Build a variant-level set for italic checks: "Family-weight-style"
  const loadedVariants = new Set<string>(BUNDLED_VARIANTS)
  for (const f of doc.fonts ?? []) {
    loadedVariants.add(`${f.family}-${f.weight ?? 400}-${f.style ?? 'normal'}`)
  }

  const requireFamily = (family: string, context: string) => {
    if (!/^[a-zA-Z0-9 ._+\-]+$/.test(family)) {
      throw new PretextPdfError(
        'VALIDATION_ERROR',
        `${context}: font family name "${family}" contains invalid characters. Use only letters, digits, spaces, hyphens, and underscores.`
      )
    }
    if (!loadedFamilies.has(family)) {
      throw new PretextPdfError(
        'FONT_NOT_LOADED',
        `${context}: font family '${family}' is not loaded. Add { family: '${family}', src: '/path/to.ttf' } to doc.fonts, or remove the fontFamily reference to use the default ('${defaultFamily}').`
      )
    }
  }

  const requireVariant = (family: string, weight: 400 | 700, style: 'normal' | 'italic', context: string) => {
    const key = `${family}-${weight}-${style}`
    if (!loadedVariants.has(key)) {
      if (style === 'italic') {
        throw new PretextPdfError(
          'ITALIC_FONT_NOT_LOADED',
          `${context}: fontStyle 'italic' requires an italic font variant. Add { family: '${family}', weight: ${weight}, style: 'italic', src: '/path/to-italic.ttf' } to doc.fonts.`
        )
      }
      throw new PretextPdfError(
        'FONT_NOT_LOADED',
        `${context}: font variant '${key}' is not loaded. Add a matching FontSpec to doc.fonts.`
      )
    }
  }

  // 1. defaultFont must be loadable
  requireFamily(defaultFamily, `doc.defaultFont '${defaultFamily}'`)

  // 2. header / footer fontFamily + fontWeight variant
  for (const [spec, label] of [[doc.header, 'doc.header'], [doc.footer, 'doc.footer']] as const) {
    if (!spec) continue
    if (spec.fontFamily) requireFamily(spec.fontFamily, `${label}.fontFamily`)
    if ((spec.fontWeight ?? 400) === 700) {
      const family = spec.fontFamily ?? defaultFamily
      requireVariant(family, 700, 'normal', `${label} fontWeight:700`)
    }
  }

  // 2b. watermark fontFamily (text watermark only)
  if (doc.watermark?.text) {
    if (doc.watermark.fontFamily) requireFamily(doc.watermark.fontFamily, 'doc.watermark.fontFamily')
    if ((doc.watermark.fontWeight ?? 400) === 700) {
      const family = doc.watermark.fontFamily ?? defaultFamily
      requireVariant(family, 700, 'normal', 'doc.watermark fontWeight:700')
    }
  }

  // 3. content elements
  for (let i = 0; i < doc.content.length; i++) {
    const el = doc.content[i]!
    const prefix = `content[${i}]`

    if (el.type === 'paragraph') {
      if (el.fontFamily) requireFamily(el.fontFamily, `${prefix} (paragraph).fontFamily`)
      if ((el.fontWeight ?? 400) === 700) {
        const family = el.fontFamily ?? defaultFamily
        requireVariant(family, 700, 'normal', `${prefix} (paragraph) fontWeight:700`)
      }
    }

    if (el.type === 'heading') {
      if (el.fontFamily) requireFamily(el.fontFamily, `${prefix} (heading).fontFamily`)
      const family = el.fontFamily ?? defaultFamily
      const weight = el.fontWeight ?? 700
      requireVariant(family, weight, 'normal', `${prefix} (heading) fontWeight:${weight}`)
    }

    if (el.type === 'list') {
      for (let ii = 0; ii < el.items.length; ii++) {
        const item = el.items[ii]!
        if ((item.fontWeight ?? 400) === 700) {
          requireVariant(defaultFamily, 700, 'normal', `${prefix} (list) items[${ii}] fontWeight:700`)
        }
      }
    }

    if (el.type === 'table') {
      for (let ri = 0; ri < el.rows.length; ri++) {
        for (let ci = 0; ci < el.rows[ri]!.cells.length; ci++) {
          const cell = el.rows[ri]!.cells[ci]!
          if (cell.fontFamily) requireFamily(cell.fontFamily, `${prefix} (table) rows[${ri}].cells[${ci}].fontFamily`)
          if ((cell.fontWeight ?? 400) === 700) {
            const family = cell.fontFamily ?? defaultFamily
            requireVariant(family, 700, 'normal', `${prefix} (table) rows[${ri}].cells[${ci}] fontWeight:700`)
          }
        }
      }
    }

    if (el.type === 'rich-paragraph') {
      for (let si = 0; si < el.spans.length; si++) {
        const span = el.spans[si]!
        const spanFamily = span.fontFamily ?? defaultFamily
        const spanWeight = span.fontWeight ?? 400
        const spanStyle = span.fontStyle ?? 'normal'
        if (span.fontFamily) requireFamily(span.fontFamily, `${prefix} (rich-paragraph) spans[${si}].fontFamily`)
        if (spanStyle === 'italic') {
          requireVariant(spanFamily, spanWeight, 'italic', `${prefix} (rich-paragraph) spans[${si}]`)
        }
      }
    }

    if (el.type === 'blockquote') {
      if (el.fontFamily) requireFamily(el.fontFamily, `${prefix} (blockquote).fontFamily`)
      const family = el.fontFamily ?? defaultFamily
      const weight = el.fontWeight ?? 400
      const style = el.fontStyle ?? 'normal'
      if (style === 'italic') {
        requireVariant(family, weight, 'italic', `${prefix} (blockquote) fontStyle:italic`)
      } else if (weight === 700) {
        requireVariant(family, 700, 'normal', `${prefix} (blockquote) fontWeight:700`)
      }
    }

    // code.fontFamily already validated against loadedFamilies in validateElement
  }
}
