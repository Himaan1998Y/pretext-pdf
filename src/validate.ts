import type { PdfDocument, ContentElement, FontSpec } from './types.js'
import { PretextPdfError } from './errors.js'
import { resolvePageDimensions } from './page-sizes.js'

/** RTL Unicode ranges: Arabic, Hebrew, Thaana, Syriac */
const RTL_REGEX = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F]/

/** Valid 6-digit hex color */
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/

/** Valid column width: positive number OR '2*', '*', '1.5*' format */
const STAR_WIDTH_REGEX = /^(\d*\.?\d+)?\*$/

/** Families always available without explicit doc.fonts entry */
const BUNDLED_FAMILIES = new Set(['Inter'])

/** Font variants (family-weight-style) always available without explicit doc.fonts entry */
const BUNDLED_VARIANTS = new Set(['Inter-400-normal', 'Inter-700-normal'])

export function validate(doc: PdfDocument): void {
  // content must be a non-empty array
  if (!Array.isArray(doc.content) || doc.content.length === 0) {
    throw new PretextPdfError('VALIDATION_ERROR', 'document.content must be a non-empty array')
  }

  // memory guard
  if (doc.content.length > 10_000) {
    throw new PretextPdfError(
      'VALIDATION_ERROR',
      `document.content has ${doc.content.length} elements. Maximum is 10,000. For large documents, split into multiple render() calls.`
    )
  }

  // page size
  if (Array.isArray(doc.pageSize)) {
    const [w, h] = doc.pageSize
    if (
      typeof w !== 'number' || typeof h !== 'number' ||
      !isFinite(w) || !isFinite(h) ||
      w <= 0 || h <= 0
    ) {
      throw new PretextPdfError(
        'VALIDATION_ERROR',
        'pageSize array must be [width, height] with two positive finite numbers in pt'
      )
    }
  }

  // margins can't make content area zero/negative
  if (doc.margins) {
    const m = doc.margins
    const [pageW, pageH] = resolvePageDimensions(doc.pageSize)
    const left = m.left ?? 72
    const right = m.right ?? 72
    const top = m.top ?? 72
    const bottom = m.bottom ?? 72
    if (pageW - left - right <= 0) {
      throw new PretextPdfError('PAGE_TOO_SMALL', `Left+right margins (${left}+${right}) exceed page width (${pageW}pt). Content area would be zero or negative.`)
    }
    if (pageH - top - bottom <= 0) {
      throw new PretextPdfError('PAGE_TOO_SMALL', `Top+bottom margins (${top}+${bottom}) exceed page height (${pageH}pt). Content area would be zero or negative.`)
    }
  }

  // font specs
  if (doc.fonts) {
    for (const font of doc.fonts) {
      validateFontSpec(font)
    }
  }

  // header / footer
  for (const [spec, label] of [[doc.header, 'doc.header'], [doc.footer, 'doc.footer']] as const) {
    if (!spec) continue
    if (typeof spec.text !== 'string') {
      throw new PretextPdfError('VALIDATION_ERROR', `${label}.text must be a string`)
    }
    if (spec.fontSize !== undefined && (typeof spec.fontSize !== 'number' || spec.fontSize <= 0 || !isFinite(spec.fontSize))) {
      throw new PretextPdfError('VALIDATION_ERROR', `${label}.fontSize must be a positive finite number`)
    }
    if (spec.align !== undefined && !['left', 'center', 'right'].includes(spec.align)) {
      throw new PretextPdfError('VALIDATION_ERROR', `${label}.align must be 'left', 'center', or 'right'`)
    }
    if (spec.fontWeight !== undefined && ![400, 700].includes(spec.fontWeight)) {
      throw new PretextPdfError('VALIDATION_ERROR', `${label}.fontWeight must be 400 or 700`)
    }
    if (spec.color !== undefined && !HEX_COLOR_REGEX.test(spec.color)) {
      throw new PretextPdfError('VALIDATION_ERROR', `${label}.color must be a 6-digit hex string like '#666666'. Got: '${spec.color}'`)
    }
  }

  // watermark
  if (doc.watermark) {
    const wm = doc.watermark
    if (!wm.text && !wm.image) {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.watermark requires either .text or .image')
    }
    if (wm.opacity !== undefined && (typeof wm.opacity !== 'number' || wm.opacity < 0 || wm.opacity > 1 || !isFinite(wm.opacity))) {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.watermark.opacity must be a number 0.0–1.0')
    }
    if (wm.fontSize !== undefined && (typeof wm.fontSize !== 'number' || wm.fontSize <= 0 || !isFinite(wm.fontSize))) {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.watermark.fontSize must be a positive finite number')
    }
    if (wm.fontWeight !== undefined && ![400, 700].includes(wm.fontWeight)) {
      throw new PretextPdfError('VALIDATION_ERROR', "doc.watermark.fontWeight must be 400 or 700")
    }
    if (wm.color !== undefined && !HEX_COLOR_REGEX.test(wm.color)) {
      throw new PretextPdfError('VALIDATION_ERROR', `doc.watermark.color must be a 6-digit hex string. Got: '${wm.color}'`)
    }
    if (wm.rotation !== undefined) {
      if (typeof wm.rotation !== 'number' || !isFinite(wm.rotation)) {
        throw new PretextPdfError('VALIDATION_ERROR', 'doc.watermark.rotation must be a finite number')
      }
      if (wm.rotation < -360 || wm.rotation > 360) {
        throw new PretextPdfError('WATERMARK_ROTATION_OUT_OF_RANGE', 'doc.watermark.rotation must be between -360 and 360 degrees')
      }
    }
  }

  // encryption
  if (doc.encryption) {
    const enc = doc.encryption
    if (enc.userPassword !== undefined && typeof enc.userPassword !== 'string') {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.encryption.userPassword must be a string if provided')
    }
    if (enc.ownerPassword !== undefined && typeof enc.ownerPassword !== 'string') {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.encryption.ownerPassword must be a string if provided')
    }
    if (enc.ownerPassword !== undefined && enc.ownerPassword === '') {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.encryption.ownerPassword must not be an empty string')
    }
    // permissions sub-fields are booleans — TypeScript enforces the type, no runtime check needed
  }

  // bookmarks
  if (doc.bookmarks !== undefined && doc.bookmarks !== false) {
    const bm = doc.bookmarks
    if (bm.minLevel !== undefined && ![1, 2, 3, 4].includes(bm.minLevel)) {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.bookmarks.minLevel must be 1, 2, 3, or 4')
    }
    if (bm.maxLevel !== undefined && ![1, 2, 3, 4].includes(bm.maxLevel)) {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.bookmarks.maxLevel must be 1, 2, 3, or 4')
    }
    if (bm.minLevel !== undefined && bm.maxLevel !== undefined && bm.minLevel > bm.maxLevel) {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.bookmarks.minLevel must be ≤ maxLevel')
    }
  }

  // hyphenation
  if (doc.hyphenation) {
    const h = doc.hyphenation
    if (!h.language || typeof h.language !== 'string') {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.hyphenation.language is required (e.g. "en-us")')
    }
    if (h.minWordLength !== undefined && (h.minWordLength < 2 || h.minWordLength > 20)) {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.hyphenation.minWordLength must be 2–20')
    }
    if (h.leftMin !== undefined && (h.leftMin < 1 || h.leftMin > 5)) {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.hyphenation.leftMin must be 1–5')
    }
    if (h.rightMin !== undefined && (h.rightMin < 1 || h.rightMin > 5)) {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.hyphenation.rightMin must be 1–5')
    }
  }

  // validate each content element
  const loadedFamilies = new Set([
    ...BUNDLED_FAMILIES,
    ...(doc.fonts ?? []).map(f => f.family),
  ])
  for (let i = 0; i < doc.content.length; i++) {
    validateElement(doc.content[i]!, i, loadedFamilies)
  }

  // validate all font references are loadable
  validateFontReferences(doc, loadedFamilies)
}

/**
 * Validate that every font family referenced anywhere in the document
 * is either bundled (Inter) or present in doc.fonts.
 * Catches problems early instead of silently falling back or dropping content.
 */
function validateFontReferences(doc: PdfDocument, loadedFamilies: Set<string>): void {
  const defaultFamily = doc.defaultFont ?? 'Inter'

  // Build a variant-level set for italic checks: "Family-weight-style"
  const loadedVariants = new Set<string>(BUNDLED_VARIANTS)
  for (const f of doc.fonts ?? []) {
    loadedVariants.add(`${f.family}-${f.weight ?? 400}-${f.style ?? 'normal'}`)
  }

  const requireFamily = (family: string, context: string) => {
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

function validateElement(el: ContentElement, index: number, loadedFamilies: Set<string>): void {
  const prefix = `content[${index}]`

  if (!el || typeof el !== 'object' || !('type' in el)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix}: each element must have a 'type' field`)
  }

  switch (el.type) {
    case 'paragraph': {
      if (typeof el.text !== 'string') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): 'text' must be a string`)
      }
      // NEW: Validate dir field (Phase 7F)
      if (el.dir !== undefined && !['ltr', 'rtl', 'auto'].includes(el.dir)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): 'dir' must be 'ltr', 'rtl', or 'auto'`)
      }
      if (el.color !== undefined && !HEX_COLOR_REGEX.test(el.color)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): 'color' must be a 6-digit hex string like '#ff0000'. Got: '${el.color}'`)
      }
      if (el.fontSize !== undefined && (typeof el.fontSize !== 'number' || el.fontSize <= 0 || !isFinite(el.fontSize))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): 'fontSize' must be a positive finite number`)
      }
      if (el.lineHeight !== undefined && typeof el.lineHeight === 'number') {
        // Compare against explicit fontSize if set, or default (12pt) if not
        const effectiveFontSize = el.fontSize ?? 12
        if (el.lineHeight < effectiveFontSize) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): lineHeight (${el.lineHeight}) is less than fontSize (${effectiveFontSize}). Lines would overlap. Set lineHeight >= fontSize.`)
        }
      }
      if (el.bgColor !== undefined && !HEX_COLOR_REGEX.test(el.bgColor)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): 'bgColor' must be a 6-digit hex string like '#f0f0f0'. Got: '${el.bgColor}'`)
      }
      if (el.spaceAfter !== undefined && (typeof el.spaceAfter !== 'number' || el.spaceAfter < 0 || !isFinite(el.spaceAfter))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): 'spaceAfter' must be a non-negative finite number`)
      }
      if (el.spaceBefore !== undefined && (typeof el.spaceBefore !== 'number' || el.spaceBefore < 0 || !isFinite(el.spaceBefore))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): 'spaceBefore' must be a non-negative finite number`)
      }
      if (el.columns !== undefined && (typeof el.columns !== 'number' || el.columns < 1 || !Number.isInteger(el.columns) || el.columns > 6)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): 'columns' must be a positive integer between 1 and 6`)
      }
      if (el.columnGap !== undefined && (typeof el.columnGap !== 'number' || el.columnGap < 0 || !isFinite(el.columnGap))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): 'columnGap' must be a non-negative finite number`)
      }
      if (el.align !== undefined && !['left', 'center', 'right', 'justify'].includes(el.align)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): 'align' must be 'left', 'center', 'right', or 'justify'`)
      }
      break
    }

    case 'heading': {
      if (typeof el.text !== 'string') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): 'text' must be a string`)
      }
      if (![1, 2, 3, 4].includes(el.level)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): 'level' must be 1, 2, 3, or 4. Got: ${el.level}`)
      }
      if (el.fontWeight !== undefined && ![400, 700].includes(el.fontWeight)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): 'fontWeight' must be 400 or 700`)
      }
      if (el.fontSize !== undefined && (typeof el.fontSize !== 'number' || el.fontSize <= 0 || !isFinite(el.fontSize))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): 'fontSize' must be a positive finite number`)
      }
      if (el.lineHeight !== undefined && typeof el.lineHeight === 'number') {
        const effectiveFontSize = el.fontSize ?? 12
        if (el.lineHeight < effectiveFontSize) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): lineHeight (${el.lineHeight}) is less than fontSize (${effectiveFontSize}). Lines would overlap.`)
        }
      }
      if (el.align !== undefined && !['left', 'center', 'right', 'justify'].includes(el.align)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): 'align' must be 'left', 'center', 'right', or 'justify'`)
      }
      if (el.color !== undefined && !HEX_COLOR_REGEX.test(el.color)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): 'color' must be a 6-digit hex string like '#ff0000'. Got: '${el.color}'`)
      }
      if (el.bgColor !== undefined && !HEX_COLOR_REGEX.test(el.bgColor)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): 'bgColor' must be a 6-digit hex string`)
      }
      if (el.spaceBefore !== undefined && (typeof el.spaceBefore !== 'number' || el.spaceBefore < 0 || !isFinite(el.spaceBefore))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): 'spaceBefore' must be a non-negative finite number`)
      }
      if (el.spaceAfter !== undefined && (typeof el.spaceAfter !== 'number' || el.spaceAfter < 0 || !isFinite(el.spaceAfter))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): 'spaceAfter' must be a non-negative finite number`)
      }
      break
    }

    case 'spacer': {
      if (typeof el.height !== 'number' || el.height < 0 || !isFinite(el.height)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (spacer): 'height' must be a non-negative finite number`)
      }
      break
    }

    case 'table': {
      if (!Array.isArray(el.columns) || el.columns.length === 0) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'columns' must be a non-empty array`)
      }
      if (!Array.isArray(el.rows) || el.rows.length === 0) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'rows' must be a non-empty array`)
      }

      const colCount = el.columns.length
      for (let ci = 0; ci < el.columns.length; ci++) {
        const col = el.columns[ci]!
        if (typeof col.width === 'number') {
          if (col.width <= 0 || !isFinite(col.width)) {
            throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): columns[${ci}].width must be a positive number. Got: ${col.width}`)
          }
        } else if (typeof col.width === 'string') {
          if (col.width !== 'auto' && !STAR_WIDTH_REGEX.test(col.width)) {
            throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): columns[${ci}].width must be a positive number, proportional string like '2*' or '*', or 'auto'. Got: '${col.width}'`)
          }
        } else {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): columns[${ci}].width must be a number or string like '2*' or 'auto'`)
        }
        if (col.align !== undefined && !['left', 'center', 'right'].includes(col.align)) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): columns[${ci}].align must be 'left', 'center', or 'right'`)
        }
      }

      // Validate header row count
      const headerRowCount = el.headerRows !== undefined
        ? el.headerRows
        : el.rows.filter(r => r.isHeader).length
      if (headerRowCount >= el.rows.length) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): table must have at least 1 non-header body row. headerRows=${headerRowCount}, total rows=${el.rows.length}`)
      }

      for (let ri = 0; ri < el.rows.length; ri++) {
        const row = el.rows[ri]!
        if (!Array.isArray(row.cells)) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): rows[${ri}].cells must be an array`)
        }

        // Validate colspan sum equals colCount
        let colspanSum = 0
        for (let cellI = 0; cellI < row.cells.length; cellI++) {
          const cell = row.cells[cellI]!
          const cs = cell.colspan ?? 1
          if (typeof cs !== 'number' || cs < 1 || !Number.isInteger(cs)) {
            throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): rows[${ri}].cells[${cellI}].colspan must be a positive integer`)
          }
          colspanSum += cs
        }
        if (colspanSum !== colCount) {
          throw new PretextPdfError('COLSPAN_OVERFLOW', `${prefix} (table): rows[${ri}] colspan sum is ${colspanSum} but table has ${colCount} columns. Sum of all colspan values in a row must equal the column count.`)
        }

        for (let cellI = 0; cellI < row.cells.length; cellI++) {
          const cell = row.cells[cellI]!
          if (typeof cell.text !== 'string') {
            throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): rows[${ri}].cells[${cellI}].text must be a string`)
          }
          if (cell.fontFamily !== undefined && (typeof cell.fontFamily !== 'string' || cell.fontFamily.trim() === '')) {
            throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): rows[${ri}].cells[${cellI}].fontFamily must be a non-empty string`)
          }
          if (cell.fontWeight !== undefined && ![400, 700].includes(cell.fontWeight)) {
            throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): rows[${ri}].cells[${cellI}].fontWeight must be 400 or 700`)
          }
          if (cell.fontSize !== undefined && (typeof cell.fontSize !== 'number' || cell.fontSize <= 0 || !isFinite(cell.fontSize))) {
            throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): rows[${ri}].cells[${cellI}].fontSize must be a positive finite number`)
          }
          if (cell.color !== undefined && !HEX_COLOR_REGEX.test(cell.color)) {
            throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): rows[${ri}].cells[${cellI}].color must be a 6-digit hex string`)
          }
          if (cell.bgColor !== undefined && !HEX_COLOR_REGEX.test(cell.bgColor)) {
            throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): rows[${ri}].cells[${cellI}].bgColor must be a 6-digit hex string`)
          }
        }
      }

      if (el.borderColor !== undefined && !HEX_COLOR_REGEX.test(el.borderColor)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'borderColor' must be a 6-digit hex string`)
      }
      if (el.headerBgColor !== undefined && !HEX_COLOR_REGEX.test(el.headerBgColor)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'headerBgColor' must be a 6-digit hex string`)
      }
      if (el.fontSize !== undefined && (typeof el.fontSize !== 'number' || el.fontSize <= 0 || !isFinite(el.fontSize))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'fontSize' must be a positive finite number`)
      }
      if (el.borderWidth !== undefined && (typeof el.borderWidth !== 'number' || el.borderWidth < 0)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'borderWidth' must be a non-negative number`)
      }
      if (el.cellPaddingH !== undefined && (typeof el.cellPaddingH !== 'number' || el.cellPaddingH < 0)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'cellPaddingH' must be a non-negative number`)
      }
      if (el.cellPaddingV !== undefined && (typeof el.cellPaddingV !== 'number' || el.cellPaddingV < 0)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'cellPaddingV' must be a non-negative number`)
      }
      if (el.spaceAfter !== undefined && (typeof el.spaceAfter !== 'number' || el.spaceAfter < 0 || !isFinite(el.spaceAfter))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'spaceAfter' must be a non-negative finite number`)
      }
      if (el.spaceBefore !== undefined && (typeof el.spaceBefore !== 'number' || el.spaceBefore < 0 || !isFinite(el.spaceBefore))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'spaceBefore' must be a non-negative finite number`)
      }
      break
    }

    case 'image': {
      if (!el.src || (typeof el.src !== 'string' && !(el.src instanceof Uint8Array))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (image): 'src' must be a non-empty string path or Uint8Array`)
      }
      const fmt = el.format ?? 'auto'
      if (fmt !== 'png' && fmt !== 'jpg' && fmt !== 'auto') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (image): 'format' must be 'png', 'jpg', or 'auto'. Got: '${String(el.format)}'`)
      }
      if (el.width !== undefined && (typeof el.width !== 'number' || el.width <= 0 || !isFinite(el.width))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (image): 'width' must be a positive finite number`)
      }
      if (el.height !== undefined && (typeof el.height !== 'number' || el.height <= 0 || !isFinite(el.height))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (image): 'height' must be a positive finite number`)
      }
      if (el.align !== undefined && !['left', 'center', 'right'].includes(el.align)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (image): 'align' must be 'left', 'center', or 'right'`)
      }
      if (el.spaceAfter !== undefined && (typeof el.spaceAfter !== 'number' || el.spaceAfter < 0 || !isFinite(el.spaceAfter))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (image): 'spaceAfter' must be a non-negative finite number`)
      }
      if (el.spaceBefore !== undefined && (typeof el.spaceBefore !== 'number' || el.spaceBefore < 0 || !isFinite(el.spaceBefore))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (image): 'spaceBefore' must be a non-negative finite number`)
      }
      break
    }

    case 'svg': {
      if (typeof el.svg !== 'string' || el.svg.trim() === '') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (svg): 'svg' must be a non-empty string`)
      }
      if (!el.svg.trim().startsWith('<')) {
        throw new PretextPdfError('SVG_INVALID_MARKUP', `${prefix} (svg): 'svg' must be valid SVG markup (must start with '<')`)
      }
      if (el.width !== undefined && (typeof el.width !== 'number' || el.width <= 0 || !isFinite(el.width))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (svg): 'width' must be a positive finite number`)
      }
      if (el.height !== undefined && (typeof el.height !== 'number' || el.height <= 0 || !isFinite(el.height))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (svg): 'height' must be a positive finite number`)
      }
      if (el.align !== undefined && !['left', 'center', 'right'].includes(el.align)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (svg): 'align' must be 'left', 'center', or 'right'`)
      }
      if (el.spaceAfter !== undefined && (typeof el.spaceAfter !== 'number' || el.spaceAfter < 0 || !isFinite(el.spaceAfter))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (svg): 'spaceAfter' must be a non-negative finite number`)
      }
      if (el.spaceBefore !== undefined && (typeof el.spaceBefore !== 'number' || el.spaceBefore < 0 || !isFinite(el.spaceBefore))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (svg): 'spaceBefore' must be a non-negative finite number`)
      }
      break
    }

    case 'list': {
      if (el.style !== 'ordered' && el.style !== 'unordered') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): 'style' must be 'ordered' or 'unordered'`)
      }
      if (!Array.isArray(el.items) || el.items.length === 0) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): 'items' must be a non-empty array`)
      }
      for (let ii = 0; ii < el.items.length; ii++) {
        const item = el.items[ii]!
        if (typeof item.text !== 'string' || item.text.trim() === '') {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): items[${ii}].text must be a non-empty string`)
        }
        // NEW: Validate dir field (Phase 7F)
        if (item.dir !== undefined && !['ltr', 'rtl', 'auto'].includes(item.dir)) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): items[${ii}].dir must be 'ltr', 'rtl', or 'auto'`)
        }
        if (item.fontWeight !== undefined && ![400, 700].includes(item.fontWeight)) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): items[${ii}].fontWeight must be 400 or 700`)
        }
        // Validate nested items (1 level deep)
        if (item.items) {
          if (!Array.isArray(item.items) || item.items.length === 0) {
            throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): items[${ii}].items must be a non-empty array if provided`)
          }
          for (let ni = 0; ni < item.items.length; ni++) {
            const nested = item.items[ni]!
            if (typeof nested.text !== 'string' || nested.text.trim() === '') {
              throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): items[${ii}].items[${ni}].text must be a non-empty string`)
            }
            if (nested.items && nested.items.length > 0) {
              throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): items[${ii}].items[${ni}] has nested items — only 1 level of nesting is supported in Phase 2`)
            }
          }
        }
      }
      if (el.color !== undefined && !HEX_COLOR_REGEX.test(el.color)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): 'color' must be a 6-digit hex string like '#ff0000'. Got: '${el.color}'`)
      }
      if (el.nestedNumberingStyle !== undefined && !['continue', 'restart'].includes(el.nestedNumberingStyle)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): 'nestedNumberingStyle' must be 'continue' or 'restart'. Got: '${el.nestedNumberingStyle}'`)
      }
      if (el.indent !== undefined && (typeof el.indent !== 'number' || el.indent < 0)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): 'indent' must be a non-negative number`)
      }
      if (el.markerWidth !== undefined && (typeof el.markerWidth !== 'number' || el.markerWidth <= 0)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): 'markerWidth' must be a positive number`)
      }
      if (el.marker !== undefined && (typeof el.marker !== 'string' || el.marker.trim() === '')) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (list): 'marker' must be a non-empty string`)
      }
      break
    }

    case 'hr': {
      if (el.thickness !== undefined && (typeof el.thickness !== 'number' || el.thickness < 0 || !isFinite(el.thickness))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (hr): 'thickness' must be a non-negative finite number`)
      }
      if (el.color !== undefined && !HEX_COLOR_REGEX.test(el.color)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (hr): 'color' must be a 6-digit hex string`)
      }
      if (el.spaceAbove !== undefined && (typeof el.spaceAbove !== 'number' || el.spaceAbove < 0)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (hr): 'spaceAbove' must be a non-negative number`)
      }
      if (el.spaceBelow !== undefined && (typeof el.spaceBelow !== 'number' || el.spaceBelow < 0)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (hr): 'spaceBelow' must be a non-negative number`)
      }
      break
    }

    case 'page-break': {
      // No fields to validate
      break
    }

    case 'rich-paragraph': {
      if (!Array.isArray(el.spans) || el.spans.length === 0) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): 'spans' must be a non-empty array`)
      }
      for (let si = 0; si < el.spans.length; si++) {
        const span = el.spans[si]!
        if (typeof span.text !== 'string') {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): spans[${si}].text must be a string`)
        }
        if (span.text === '') {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): spans[${si}].text cannot be an empty string. Use ' ' for a space between styled runs.`)
        }
        if (span.color !== undefined && !HEX_COLOR_REGEX.test(span.color)) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): spans[${si}].color must be a 6-digit hex string`)
        }
        if (span.fontWeight !== undefined && ![400, 700].includes(span.fontWeight)) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): spans[${si}].fontWeight must be 400 or 700`)
        }
        if (span.fontStyle !== undefined && !['normal', 'italic'].includes(span.fontStyle)) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): spans[${si}].fontStyle must be 'normal' or 'italic'`)
        }
        if (span.fontSize !== undefined && (typeof span.fontSize !== 'number' || span.fontSize <= 0 || !isFinite(span.fontSize))) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): spans[${si}].fontSize must be a positive finite number if provided`)
        }
        if (span.url !== undefined && (typeof span.url !== 'string' || span.url.trim() === '')) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): spans[${si}].url must be a non-empty string if provided`)
        }
      }
      if (el.fontSize !== undefined && (typeof el.fontSize !== 'number' || el.fontSize <= 0 || !isFinite(el.fontSize))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): 'fontSize' must be a positive finite number`)
      }
      if (el.bgColor !== undefined && !HEX_COLOR_REGEX.test(el.bgColor)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): 'bgColor' must be a 6-digit hex string`)
      }
      if (el.spaceAfter !== undefined && (typeof el.spaceAfter !== 'number' || el.spaceAfter < 0 || !isFinite(el.spaceAfter))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): 'spaceAfter' must be a non-negative finite number`)
      }
      if (el.spaceBefore !== undefined && (typeof el.spaceBefore !== 'number' || el.spaceBefore < 0 || !isFinite(el.spaceBefore))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): 'spaceBefore' must be a non-negative finite number`)
      }
      if (el.columns !== undefined && (typeof el.columns !== 'number' || el.columns < 1 || !Number.isInteger(el.columns) || el.columns > 6)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): 'columns' must be a positive integer between 1 and 6`)
      }
      if (el.columnGap !== undefined && (typeof el.columnGap !== 'number' || el.columnGap < 0 || !isFinite(el.columnGap))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): 'columnGap' must be a non-negative finite number`)
      }
      if (el.align !== undefined && !['left', 'center', 'right', 'justify'].includes(el.align)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): 'align' must be 'left', 'center', 'right', or 'justify'`)
      }
      break
    }

    case 'code': {
      if (typeof el.text !== 'string') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (code): 'text' must be a string`)
      }
      if (el.text.trim() === '') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (code): 'text' must be a non-empty string`)
      }
      if (!el.fontFamily || typeof el.fontFamily !== 'string') {
        throw new PretextPdfError(
          'MONOSPACE_FONT_REQUIRED',
          `${prefix} (code): 'fontFamily' is required. Provide a monospace TTF font family name that you have loaded in doc.fonts (e.g., 'JetBrains Mono', 'Fira Code', 'Courier Prime').`
        )
      }
      if (!loadedFamilies.has(el.fontFamily)) {
        throw new PretextPdfError(
          'MONOSPACE_FONT_REQUIRED',
          `${prefix} (code): fontFamily '${el.fontFamily}' is not loaded. Add { family: '${el.fontFamily}', src: '/path/to/font.ttf' } to doc.fonts.`
        )
      }
      if (el.fontSize !== undefined && (typeof el.fontSize !== 'number' || el.fontSize <= 0 || !isFinite(el.fontSize))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (code): 'fontSize' must be a positive finite number`)
      }
      if (el.bgColor !== undefined && !HEX_COLOR_REGEX.test(el.bgColor)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (code): 'bgColor' must be a 6-digit hex string`)
      }
      if (el.color !== undefined && !HEX_COLOR_REGEX.test(el.color)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (code): 'color' must be a 6-digit hex string`)
      }
      if (el.padding !== undefined && (typeof el.padding !== 'number' || el.padding < 0 || !isFinite(el.padding))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (code): 'padding' must be a non-negative finite number`)
      }
      if (el.spaceAfter !== undefined && (typeof el.spaceAfter !== 'number' || el.spaceAfter < 0 || !isFinite(el.spaceAfter))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (code): 'spaceAfter' must be a non-negative finite number`)
      }
      if (el.spaceBefore !== undefined && (typeof el.spaceBefore !== 'number' || el.spaceBefore < 0 || !isFinite(el.spaceBefore))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (code): 'spaceBefore' must be a non-negative finite number`)
      }
      break
    }

    case 'blockquote': {
      if (typeof el.text !== 'string') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (blockquote): 'text' must be a string`)
      }
      if (el.text.trim() === '') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (blockquote): 'text' must be a non-empty string`)
      }
      if (el.borderColor !== undefined && !HEX_COLOR_REGEX.test(el.borderColor)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (blockquote): 'borderColor' must be a 6-digit hex string`)
      }
      if (el.borderWidth !== undefined && (typeof el.borderWidth !== 'number' || el.borderWidth < 0 || !isFinite(el.borderWidth))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (blockquote): 'borderWidth' must be a non-negative finite number`)
      }
      if (el.bgColor !== undefined && !HEX_COLOR_REGEX.test(el.bgColor)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (blockquote): 'bgColor' must be a 6-digit hex string`)
      }
      if (el.color !== undefined && !HEX_COLOR_REGEX.test(el.color)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (blockquote): 'color' must be a 6-digit hex string`)
      }
      if (el.fontWeight !== undefined && ![400, 700].includes(el.fontWeight)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (blockquote): 'fontWeight' must be 400 or 700`)
      }
      if (el.fontStyle !== undefined && !['normal', 'italic'].includes(el.fontStyle)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (blockquote): 'fontStyle' must be 'normal' or 'italic'`)
      }
      if (el.fontSize !== undefined && (typeof el.fontSize !== 'number' || el.fontSize <= 0 || !isFinite(el.fontSize))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (blockquote): 'fontSize' must be a positive finite number`)
      }
      if (el.lineHeight !== undefined && typeof el.lineHeight === 'number') {
        const effectiveFontSize = el.fontSize ?? 12
        if (el.lineHeight < effectiveFontSize) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (blockquote): lineHeight (${el.lineHeight}) is less than fontSize (${effectiveFontSize}). Lines would overlap.`)
        }
      }
      if (el.padding !== undefined && (typeof el.padding !== 'number' || el.padding < 0 || !isFinite(el.padding))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (blockquote): 'padding' must be a non-negative finite number`)
      }
      if (el.paddingH !== undefined && (typeof el.paddingH !== 'number' || el.paddingH < 0 || !isFinite(el.paddingH))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (blockquote): 'paddingH' must be a non-negative finite number`)
      }
      if (el.paddingV !== undefined && (typeof el.paddingV !== 'number' || el.paddingV < 0 || !isFinite(el.paddingV))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (blockquote): 'paddingV' must be a non-negative finite number`)
      }
      if (el.align !== undefined && !['left', 'center', 'right', 'justify'].includes(el.align)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (blockquote): 'align' must be 'left', 'center', 'right', or 'justify'`)
      }
      if (el.spaceBefore !== undefined && (typeof el.spaceBefore !== 'number' || el.spaceBefore < 0 || !isFinite(el.spaceBefore))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (blockquote): 'spaceBefore' must be a non-negative finite number`)
      }
      if (el.spaceAfter !== undefined && (typeof el.spaceAfter !== 'number' || el.spaceAfter < 0 || !isFinite(el.spaceAfter))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (blockquote): 'spaceAfter' must be a non-negative finite number`)
      }
      break
    }

    case 'toc': {
      if (el.minLevel !== undefined && ![1, 2, 3, 4].includes(el.minLevel)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (toc): 'minLevel' must be 1, 2, 3, or 4`)
      }
      if (el.maxLevel !== undefined && ![1, 2, 3, 4].includes(el.maxLevel)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (toc): 'maxLevel' must be 1, 2, 3, or 4`)
      }
      if (el.minLevel !== undefined && el.maxLevel !== undefined && el.minLevel > el.maxLevel) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (toc): 'minLevel' cannot exceed 'maxLevel'`)
      }
      if (el.fontSize !== undefined && (typeof el.fontSize !== 'number' || el.fontSize <= 0 || !isFinite(el.fontSize))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (toc): 'fontSize' must be a positive finite number`)
      }
      if (el.titleFontSize !== undefined && (typeof el.titleFontSize !== 'number' || el.titleFontSize <= 0 || !isFinite(el.titleFontSize))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (toc): 'titleFontSize' must be a positive finite number`)
      }
      if (el.levelIndent !== undefined && (typeof el.levelIndent !== 'number' || el.levelIndent < 0 || !isFinite(el.levelIndent))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (toc): 'levelIndent' must be a non-negative finite number`)
      }
      if (el.leader !== undefined && (typeof el.leader !== 'string' || el.leader.length === 0)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (toc): 'leader' must be a non-empty string`)
      }
      if (el.entrySpacing !== undefined && (typeof el.entrySpacing !== 'number' || el.entrySpacing < 0 || !isFinite(el.entrySpacing))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (toc): 'entrySpacing' must be a non-negative finite number`)
      }
      if (el.spaceBefore !== undefined && (typeof el.spaceBefore !== 'number' || el.spaceBefore < 0 || !isFinite(el.spaceBefore))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (toc): 'spaceBefore' must be a non-negative finite number`)
      }
      if (el.spaceAfter !== undefined && (typeof el.spaceAfter !== 'number' || el.spaceAfter < 0 || !isFinite(el.spaceAfter))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (toc): 'spaceAfter' must be a non-negative finite number`)
      }
      break
    }

    case 'toc-entry': {
      // Internal type — should never appear in user input
      throw new PretextPdfError('VALIDATION_ERROR', `${prefix}: 'toc-entry' is an internal type and cannot be used in document content`)
    }

    default: {
      const type = (el as { type: unknown }).type
      throw new PretextPdfError('VALIDATION_ERROR', `${prefix}: unknown element type '${String(type)}'. Valid types: 'paragraph', 'heading', 'spacer', 'table', 'image', 'svg', 'list', 'hr', 'page-break', 'code', 'rich-paragraph', 'blockquote', 'toc'`)
    }
  }
}

function validateFontSpec(font: FontSpec): void {
  if (!font.family || typeof font.family !== 'string') {
    throw new PretextPdfError('VALIDATION_ERROR', `FontSpec: 'family' must be a non-empty string`)
  }
  if (font.weight !== undefined && ![400, 700].includes(font.weight)) {
    throw new PretextPdfError('VALIDATION_ERROR', `FontSpec '${font.family}': 'weight' must be 400 or 700`)
  }
  if (font.style !== undefined && !['normal', 'italic'].includes(font.style)) {
    throw new PretextPdfError('VALIDATION_ERROR', `FontSpec '${font.family}': 'style' must be 'normal' or 'italic'`)
  }
  if (font.src === undefined || font.src === null) {
    throw new PretextPdfError('VALIDATION_ERROR', `FontSpec '${font.family}': 'src' is required (file path or Uint8Array)`)
  }
}

