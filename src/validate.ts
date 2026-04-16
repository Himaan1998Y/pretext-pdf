import type { PdfDocument, ContentElement, FontSpec, CommentElement } from './types.js'
import { PretextPdfError } from './errors.js'
import { resolvePageDimensions } from './page-sizes.js'

/**
 * RTL strong bidi characters — Bidi_Class=R or AL per UAX #9.
 * Block-level coverage following Unicode DerivedBidiClass defaults.
 * Source: https://www.unicode.org/Public/17.0.0/ucd/extracted/DerivedBidiClass.txt
 *
 * BMP blocks:
 *   0590–05FF  Hebrew
 *   0600–06FF  Arabic
 *   0700–074F  Syriac
 *   0750–077F  Arabic Supplement
 *   0780–07BF  Thaana (Maldivian)
 *   07C0–07FF  N'Ko (West African)
 *   0800–083F  Samaritan
 *   0840–085F  Mandaic
 *   0860–086F  Syriac Supplement
 *   0870–089F  Arabic Extended-B
 *   08A0–08FF  Arabic Extended-A
 *   FB1D–FB4F  Hebrew Presentation Forms
 *   FB50–FDFF  Arabic Presentation Forms-A
 *   FE70–FEFF  Arabic Presentation Forms-B
 * Supplementary plane blocks (requires /u flag):
 *   10800–10CFF  Ancient Semitic (Cypriot, Imperial Aramaic, Palmyrene,
 *                Nabataean, Hatran, Phoenician, Lydian, Old South/North
 *                Arabian, Manichaean, Avestan, Inscriptional Parthian/
 *                Pahlavi, Old Turkic, Old Hungarian)
 *   10D00–10D3F  Hanifi Rohingya
 *   10E80–10EFF  Yezidi + Arabic Extended-C
 *   10F30–10FFF  Sogdian, Old Uyghur, Chorasmian, Elymaic
 *   1E800–1E95F  Mende Kikakui + Adlam (Fulani)
 *   1EC70–1ECBF  Indic Siyaq Numbers (AL)
 *   1EE00–1EEFF  Arabic Mathematical Alphabetic Symbols
 */
const RTL_REGEX = /[\u0590-\u08FF\uFB1D-\uFB4F\uFB50-\uFDFF\uFE70-\uFEFF\u{10800}-\u{10CFF}\u{10D00}-\u{10D3F}\u{10E80}-\u{10EFF}\u{10F30}-\u{10FFF}\u{1E800}-\u{1E95F}\u{1EC70}-\u{1ECBF}\u{1EE00}-\u{1EEFF}]/u

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
  if (doc.content.length > 50_000) {
    throw new PretextPdfError('VALIDATION_ERROR', `document.content has ${doc.content.length} elements (hard limit: 50,000). Split into multiple documents.`)
  }
  if (doc.content.length > 10_000) {
    console.warn(`[pretext-pdf] Performance advisory: document.content has ${doc.content.length} elements (recommended max: 10,000). Large documents may be slow.`)
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
    if (w > 14400 || h > 14400) {
      throw new PretextPdfError(
        'VALIDATION_ERROR',
        `pageSize [${w}, ${h}] exceeds maximum 14400pt (200 inches). Values this large cause rendering overflow.`
      )
    }
  }

  // margins must be non-negative and can't make content area zero/negative
  if (doc.margins) {
    const m = doc.margins
    for (const side of ['top', 'bottom', 'left', 'right'] as const) {
      if (m[side] !== undefined && (typeof m[side] !== 'number' || m[side]! < 0 || !isFinite(m[side]!))) {
        throw new PretextPdfError('VALIDATION_ERROR', `margins.${side} must be a non-negative finite number. Got: ${m[side]}`)
      }
    }
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

  // defaultParagraphStyle
  if (doc.defaultParagraphStyle !== undefined) {
    const dps = doc.defaultParagraphStyle
    if (typeof dps !== 'object' || dps === null || Array.isArray(dps)) {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.defaultParagraphStyle must be an object')
    }
    if (dps.fontSize !== undefined && (typeof dps.fontSize !== 'number' || dps.fontSize <= 0 || dps.fontSize > 500 || !isFinite(dps.fontSize))) {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.defaultParagraphStyle.fontSize must be a number > 0 and <= 500')
    }
    if (dps.lineHeight !== undefined && (typeof dps.lineHeight !== 'number' || dps.lineHeight <= 0 || dps.lineHeight > 20 || !isFinite(dps.lineHeight))) {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.defaultParagraphStyle.lineHeight must be a number > 0 and <= 20')
    }
    if (dps.color !== undefined && !HEX_COLOR_REGEX.test(dps.color)) {
      throw new PretextPdfError('VALIDATION_ERROR', `doc.defaultParagraphStyle.color must be a 6-digit hex string like '#000000'. Got: '${dps.color}'`)
    }
    if (dps.align !== undefined && !['left', 'center', 'right', 'justify'].includes(dps.align)) {
      throw new PretextPdfError('VALIDATION_ERROR', "doc.defaultParagraphStyle.align must be 'left', 'center', 'right', or 'justify'")
    }
    if (dps.letterSpacing !== undefined && (typeof dps.letterSpacing !== 'number' || dps.letterSpacing < 0 || dps.letterSpacing > 200 || !isFinite(dps.letterSpacing))) {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.defaultParagraphStyle.letterSpacing must be a number >= 0 and <= 200')
    }
    if (dps.fontWeight !== undefined && ![400, 700].includes(dps.fontWeight)) {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.defaultParagraphStyle.fontWeight must be 400 or 700')
    }
  }

  // sections
  if (doc.sections !== undefined) {
    if (!Array.isArray(doc.sections)) {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.sections must be an array')
    }
    for (let i = 0; i < doc.sections.length; i++) {
      const s = doc.sections[i]!
      const label = `doc.sections[${i}]`
      if (s.fromPage !== undefined && (typeof s.fromPage !== 'number' || !Number.isInteger(s.fromPage) || s.fromPage < 1)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${label}.fromPage must be a positive integer`)
      }
      if (s.toPage !== undefined && (typeof s.toPage !== 'number' || !Number.isInteger(s.toPage) || s.toPage < 1)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${label}.toPage must be a positive integer`)
      }
      if (s.fromPage !== undefined && s.toPage !== undefined && s.fromPage > s.toPage) {
        throw new PretextPdfError('VALIDATION_ERROR', `${label}.fromPage (${s.fromPage}) must be <= toPage (${s.toPage})`)
      }
      for (const [spec, slabel] of [[s.header, `${label}.header`], [s.footer, `${label}.footer`]] as const) {
        if (!spec) continue
        if (typeof spec.text !== 'string') {
          throw new PretextPdfError('VALIDATION_ERROR', `${slabel}.text must be a string`)
        }
        if (spec.fontSize !== undefined && (typeof spec.fontSize !== 'number' || spec.fontSize <= 0 || !isFinite(spec.fontSize))) {
          throw new PretextPdfError('VALIDATION_ERROR', `${slabel}.fontSize must be a positive finite number`)
        }
        if (spec.align !== undefined && !['left', 'center', 'right'].includes(spec.align)) {
          throw new PretextPdfError('VALIDATION_ERROR', `${slabel}.align must be 'left', 'center', or 'right'`)
        }
        if (spec.fontWeight !== undefined && ![400, 700].includes(spec.fontWeight)) {
          throw new PretextPdfError('VALIDATION_ERROR', `${slabel}.fontWeight must be 400 or 700`)
        }
        if (spec.color !== undefined && !HEX_COLOR_REGEX.test(spec.color)) {
          throw new PretextPdfError('VALIDATION_ERROR', `${slabel}.color must be a 6-digit hex string like '#666666'. Got: '${spec.color}'`)
        }
      }
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

  if (doc.signature !== undefined) {
    const sig = doc.signature
    if (sig.width !== undefined && (typeof sig.width !== 'number' || sig.width <= 0)) {
      throw new PretextPdfError('VALIDATION_ERROR', 'signature.width must be a positive number')
    }
    if (sig.height !== undefined && (typeof sig.height !== 'number' || sig.height <= 0)) {
      throw new PretextPdfError('VALIDATION_ERROR', 'signature.height must be a positive number')
    }
    if (sig.page !== undefined && (!Number.isInteger(sig.page) || sig.page < 0)) {
      throw new PretextPdfError('VALIDATION_ERROR', 'signature.page must be a non-negative integer')
    }
    if (sig.borderColor !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(sig.borderColor)) {
      throw new PretextPdfError('VALIDATION_ERROR', 'signature.borderColor must be a 6-digit hex color e.g. "#000000"')
    }
    if (sig.fontSize !== undefined && (typeof sig.fontSize !== 'number' || sig.fontSize <= 0)) {
      throw new PretextPdfError('VALIDATION_ERROR', 'signature.fontSize must be a positive number')
    }
    // Phase 3: crypto signature validation
    if (sig.p12 !== undefined) {
      if (typeof sig.p12 !== 'string' && !(sig.p12 instanceof Uint8Array)) {
        throw new PretextPdfError('VALIDATION_ERROR', 'signature.p12 must be a file path string or Uint8Array of certificate bytes')
      }
      if (typeof sig.p12 === 'string' && sig.p12.trim() === '') {
        throw new PretextPdfError('VALIDATION_ERROR', 'signature.p12 must not be an empty string')
      }
    }
    if (sig.passphrase !== undefined && typeof sig.passphrase !== 'string') {
      throw new PretextPdfError('VALIDATION_ERROR', 'signature.passphrase must be a string')
    }
    if (sig.contactInfo !== undefined && typeof sig.contactInfo !== 'string') {
      throw new PretextPdfError('VALIDATION_ERROR', 'signature.contactInfo must be a string')
    }
    if (sig.invisible !== undefined && typeof sig.invisible !== 'boolean') {
      throw new PretextPdfError('VALIDATION_ERROR', 'signature.invisible must be a boolean')
    }
    if (sig.p12 !== undefined && doc.encryption !== undefined) {
      throw new PretextPdfError('VALIDATION_ERROR', 'Cannot use both signature.p12 (cryptographic signing) and encryption together — the encryption step would invalidate the cryptographic signature.')
    }
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

  // metadata
  if (doc.metadata) {
    const m = doc.metadata
    if (m.language !== undefined && (typeof m.language !== 'string' || m.language.trim() === '')) {
      throw new PretextPdfError('VALIDATION_ERROR', 'metadata.language must be a non-empty string (BCP47 tag e.g. "en-US")')
    }
    if (m.producer !== undefined && (typeof m.producer !== 'string' || m.producer.trim() === '')) {
      throw new PretextPdfError('VALIDATION_ERROR', 'metadata.producer must be a non-empty string')
    }
  }

  // validate each content element
  const loadedFamilies = new Set([
    ...BUNDLED_FAMILIES,
    ...(doc.fonts ?? []).map(f => f.family),
  ])
  // Check for duplicate form field names
  const formFieldNames = new Set<string>()
  for (const el of doc.content) {
    if (el.type === 'form-field') {
      if (formFieldNames.has(el.name)) {
        throw new PretextPdfError('FORM_FIELD_NAME_DUPLICATE', `Duplicate form field name: "${el.name}". Each form field must have a unique name.`)
      }
      formFieldNames.add(el.name)
    }
  }

  for (let i = 0; i < doc.content.length; i++) {
    validateElement(doc.content[i]!, i, loadedFamilies)
  }

  // ── Footnote ref/def cross-validation ─────────────────────────────────────
  const footnoteDefIds = new Map<string, number>()  // id → content index
  const footnoteRefIds = new Set<string>()

  // Collect all def ids
  for (let i = 0; i < doc.content.length; i++) {
    const el = doc.content[i]!
    if (el.type === 'footnote-def') {
      if (footnoteDefIds.has(el.id)) {
        throw new PretextPdfError('FOOTNOTE_DEF_DUPLICATE',
          `content[${i}] (footnote-def): duplicate id "${el.id}". Each footnote must have a unique id.`)
      }
      footnoteDefIds.set(el.id, i)
    }
  }

  // Collect all ref ids from rich-paragraph spans
  for (const el of doc.content) {
    if (el.type === 'rich-paragraph') {
      for (const span of el.spans) {
        if (span.footnoteRef) {
          footnoteRefIds.add(span.footnoteRef)
        }
      }
    }
  }

  // Orphaned ref: ref id with no matching def
  for (const refId of footnoteRefIds) {
    if (!footnoteDefIds.has(refId)) {
      throw new PretextPdfError('FOOTNOTE_REF_ORPHANED',
        `A rich-paragraph span references footnote id "${refId}" but no footnote-def with that id exists in doc.content.`)
    }
  }

  // Orphaned def: def id never referenced
  for (const [defId] of footnoteDefIds) {
    if (!footnoteRefIds.has(defId)) {
      throw new PretextPdfError('FOOTNOTE_DEF_ORPHANED',
        `footnote-def "${defId}" is defined but never referenced by any rich-paragraph span.`)
    }
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
      if (el.fontSize !== undefined && (typeof el.fontSize !== 'number' || el.fontSize <= 0 || !isFinite(el.fontSize) || el.fontSize > 500)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): 'fontSize' must be a positive finite number and <= 500`)
      }
      if (el.lineHeight !== undefined && typeof el.lineHeight === 'number') {
        // Compare against explicit fontSize if set, or default (12pt) if not
        const effectiveFontSize = el.fontSize ?? 12
        if (el.lineHeight < effectiveFontSize) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): lineHeight (${el.lineHeight}) is less than fontSize (${effectiveFontSize}). Lines would overlap. Set lineHeight >= fontSize.`)
        }
        if (el.lineHeight > 20) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): 'lineHeight' must be <= 20`)
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
      if (el.url !== undefined && (typeof el.url !== 'string' || el.url.trim() === '')) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): 'url' must be a non-empty string if provided`)
      }
      if (el.letterSpacing !== undefined && (typeof el.letterSpacing !== 'number' || el.letterSpacing < 0 || !isFinite(el.letterSpacing) || el.letterSpacing > 200)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): 'letterSpacing' must be a non-negative finite number and <= 200`)
      }
      if (el.annotation) {
        if (!el.annotation.contents || el.annotation.contents.trim() === '') {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): annotation.contents is required and must be non-empty`)
        }
      }
      break
    }

    case 'heading': {
      if (typeof el.text !== 'string') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): 'text' must be a string`)
      }
      if (el.text.trim() === '') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): heading text cannot be empty or whitespace-only`)
      }
      if (![1, 2, 3, 4].includes(el.level)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): 'level' must be 1, 2, 3, or 4. Got: ${el.level}`)
      }
      if (el.fontWeight !== undefined && ![400, 700].includes(el.fontWeight)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): 'fontWeight' must be 400 or 700`)
      }
      if (el.fontSize !== undefined && (typeof el.fontSize !== 'number' || el.fontSize <= 0 || !isFinite(el.fontSize) || el.fontSize > 500)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): 'fontSize' must be a positive finite number and <= 500`)
      }
      if (el.lineHeight !== undefined && typeof el.lineHeight === 'number') {
        const effectiveFontSize = el.fontSize ?? 12
        if (el.lineHeight < effectiveFontSize) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): lineHeight (${el.lineHeight}) is less than fontSize (${effectiveFontSize}). Lines would overlap.`)
        }
        if (el.lineHeight > 20) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): 'lineHeight' must be <= 20`)
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
      if (el.url !== undefined && (typeof el.url !== 'string' || el.url.trim() === '')) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): 'url' must be a non-empty string if provided`)
      }
      if (el.anchor !== undefined && (typeof el.anchor !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(el.anchor))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): 'anchor' must be alphanumeric with hyphens/underscores only. Got: '${el.anchor}'`)
      }
      if (el.letterSpacing !== undefined && (typeof el.letterSpacing !== 'number' || el.letterSpacing < 0 || !isFinite(el.letterSpacing) || el.letterSpacing > 200)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): 'letterSpacing' must be a non-negative finite number and <= 200`)
      }
      if (el.annotation) {
        if (!el.annotation.contents || el.annotation.contents.trim() === '') {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): annotation.contents is required and must be non-empty`)
        }
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
          if (col.width !== 'auto') {
            const multiplier = parseFloat(col.width)
            if (!isNaN(multiplier) && multiplier > 1000) {
              throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): columns[${ci}].width multiplier ${multiplier} exceeds maximum 1000`)
            }
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
          if (cell.dir !== undefined && !['ltr', 'rtl', 'auto'].includes(cell.dir)) {
            throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): rows[${ri}].cells[${cellI}].dir must be 'ltr', 'rtl', or 'auto'`)
          }
          if (cell.align !== undefined && !['left', 'center', 'right'].includes(cell.align)) {
            throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): rows[${ri}].cells[${cellI}].align must be 'left', 'center', or 'right'`)
          }
        }
      }

      if (el.dir !== undefined && !['ltr', 'rtl', 'auto'].includes(el.dir)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'dir' must be 'ltr', 'rtl', or 'auto'`)
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
      // Phase 5: float validation
      if (el.float !== undefined && el.float !== 'left' && el.float !== 'right') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (image): 'float' must be 'left' or 'right'`)
      }
      if (el.float !== undefined && (!el.floatText || el.floatText.trim() === '')) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (image): 'floatText' is required when 'float' is set`)
      }
      if (el.floatText !== undefined && el.float === undefined) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (image): 'floatText' has no effect without 'float'`)
      }
      if (el.floatWidth !== undefined && (typeof el.floatWidth !== 'number' || el.floatWidth <= 0 || !isFinite(el.floatWidth))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (image): 'floatWidth' must be a positive finite number`)
      }
      if (el.floatGap !== undefined && (typeof el.floatGap !== 'number' || el.floatGap < 0 || !isFinite(el.floatGap))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (image): 'floatGap' must be a non-negative number`)
      }
      if (el.floatFontSize !== undefined && (typeof el.floatFontSize !== 'number' || el.floatFontSize <= 0)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (image): 'floatFontSize' must be a positive number`)
      }
      break
    }

    case 'svg': {
      const hasSvg = typeof el.svg === 'string' && el.svg.trim().length > 0
      const hasSrc = typeof el.src === 'string' && el.src.trim().length > 0
      if (!hasSvg && !hasSrc) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (svg): either 'svg' (inline markup) or 'src' (file path / https:// URL) is required`)
      }
      if (hasSvg && !el.svg!.trim().startsWith('<')) {
        throw new PretextPdfError('SVG_INVALID_MARKUP', `${prefix} (svg): 'svg' must be valid SVG markup (must start with '<')`)
      }
      if (hasSrc && !el.src!.startsWith('/') && !el.src!.startsWith('https://') && !el.src!.startsWith('http://') && !/^[A-Za-z]:[/\\]/.test(el.src!)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (svg): 'src' must be an absolute file path or an https:// URL`)
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
        if (span.href !== undefined && (typeof span.href !== 'string' || span.href.trim() === '')) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): spans[${si}].href must be a non-empty string if provided`)
        }
        if (span.url !== undefined && span.href !== undefined) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): spans[${si}] cannot have both 'url' and 'href' — use one or the other`)
        }
        if (span.verticalAlign !== undefined && span.verticalAlign !== 'superscript' && span.verticalAlign !== 'subscript') {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): spans[${si}].verticalAlign must be "superscript" or "subscript"`)
        }
      }
      if (el.dir !== undefined && !['ltr', 'rtl', 'auto'].includes(el.dir)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): 'dir' must be 'ltr', 'rtl', or 'auto'`)
      }
      if (el.letterSpacing !== undefined && (typeof el.letterSpacing !== 'number' || el.letterSpacing < 0 || !isFinite(el.letterSpacing) || el.letterSpacing > 200)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): 'letterSpacing' must be a non-negative finite number and <= 200`)
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

    case 'callout': {
      if (!el.content || typeof el.content !== 'string' || el.content.trim() === '') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (callout): 'content' is required and must be a non-empty string`)
      }
      const validStyles = ['info', 'warning', 'tip', 'note']
      if (el.style !== undefined && !validStyles.includes(el.style)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (callout): 'style' must be one of: ${validStyles.join(', ')}`)
      }
      if (el.backgroundColor !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(el.backgroundColor)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (callout): 'backgroundColor' must be a 6-digit hex color`)
      }
      if (el.borderColor !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(el.borderColor)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (callout): 'borderColor' must be a 6-digit hex color`)
      }
      if (el.color !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(el.color)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (callout): 'color' must be a 6-digit hex color`)
      }
      if (el.fontSize !== undefined && (typeof el.fontSize !== 'number' || el.fontSize <= 0)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (callout): 'fontSize' must be a positive number`)
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

    case 'comment': {
      const commentEl = el as CommentElement
      if (!commentEl.contents || typeof commentEl.contents !== 'string' || commentEl.contents.trim() === '') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (comment): 'contents' is required and must be a non-empty string`)
      }
      if (commentEl.color !== undefined && !HEX_COLOR_REGEX.test(commentEl.color)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (comment): 'color' must be a valid 6-digit hex color`)
      }
      break
    }

    case 'form-field': {
      const fieldTypes = ['text', 'checkbox', 'radio', 'dropdown', 'button']
      if (!fieldTypes.includes((el as any).fieldType)) {
        throw new PretextPdfError('VALIDATION_ERROR', `[${index}] form-field.fieldType must be one of: ${fieldTypes.join(', ')}`)
      }
      if (!(el as any).name || (el as any).name.trim() === '') {
        throw new PretextPdfError('VALIDATION_ERROR', `[${index}] form-field.name is required and must be a non-empty string`)
      }
      if (((el as any).fieldType === 'radio' || (el as any).fieldType === 'dropdown') && (!(el as any).options || (el as any).options.length === 0)) {
        throw new PretextPdfError('VALIDATION_ERROR', `[${index}] form-field of type "${(el as any).fieldType}" requires a non-empty options array`)
      }
      if ((el as any).width !== undefined && (typeof (el as any).width !== 'number' || (el as any).width <= 0)) {
        throw new PretextPdfError('VALIDATION_ERROR', `[${index}] form-field.width must be a positive number`)
      }
      if ((el as any).height !== undefined && (typeof (el as any).height !== 'number' || (el as any).height <= 0)) {
        throw new PretextPdfError('VALIDATION_ERROR', `[${index}] form-field.height must be a positive number`)
      }
      if ((el as any).borderColor !== undefined && !/^#[0-9A-Fa-f]{6}$/.test((el as any).borderColor)) {
        throw new PretextPdfError('VALIDATION_ERROR', `[${index}] form-field.borderColor must be a 6-digit hex color`)
      }
      if ((el as any).backgroundColor !== undefined && !/^#[0-9A-Fa-f]{6}$/.test((el as any).backgroundColor)) {
        throw new PretextPdfError('VALIDATION_ERROR', `[${index}] form-field.backgroundColor must be a 6-digit hex color`)
      }
      break
    }

    case 'footnote-def': {
      const fn = el as import('./types.js').FootnoteDefElement
      if (!fn.id || typeof fn.id !== 'string' || fn.id.trim() === '') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (footnote-def): 'id' must be a non-empty string`)
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(fn.id)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (footnote-def): 'id' must contain only letters, numbers, hyphens, or underscores. Got: "${fn.id}"`)
      }
      if (!fn.text || typeof fn.text !== 'string' || fn.text.trim() === '') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (footnote-def): 'text' must be a non-empty string`)
      }
      if (fn.fontSize !== undefined && (typeof fn.fontSize !== 'number' || fn.fontSize <= 0)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (footnote-def): 'fontSize' must be a positive number`)
      }
      break
    }

    case 'toc-entry': {
      // Internal type — should never appear in user input
      throw new PretextPdfError('VALIDATION_ERROR', `${prefix}: 'toc-entry' is an internal type and cannot be used in document content`)
    }

    case 'float-group': {
      const fg = el as import('./types.js').FloatGroupElement
      // Validate image
      if (!fg.image || !fg.image.src || (typeof fg.image.src !== 'string' && !(fg.image.src instanceof Uint8Array))) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'image.src' must be a non-empty string path or Uint8Array`)
      }
      if (fg.image.format !== undefined && fg.image.format !== 'png' && fg.image.format !== 'jpg' && fg.image.format !== 'auto') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'image.format' must be 'png', 'jpg', or 'auto'`)
      }
      if (fg.image.height !== undefined && (typeof fg.image.height !== 'number' || fg.image.height <= 0)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'image.height' must be a positive number`)
      }
      // Validate float
      if (fg.float !== 'left' && fg.float !== 'right') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'float' must be 'left' or 'right'`)
      }
      // Validate floatWidth
      if (fg.floatWidth !== undefined && (typeof fg.floatWidth !== 'number' || fg.floatWidth <= 0 || fg.floatWidth < 30)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'floatWidth' must be a number >= 30`)
      }
      // Validate floatGap
      if (fg.floatGap !== undefined && (typeof fg.floatGap !== 'number' || fg.floatGap < 0)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'floatGap' must be a non-negative number`)
      }
      // Validate content
      if (!Array.isArray(fg.content) || fg.content.length === 0) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'content' must be a non-empty array`)
      }
      for (let i = 0; i < fg.content.length; i++) {
        const item = fg.content[i]!
        if (!['paragraph', 'heading', 'rich-paragraph'].includes(item.type)) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group).content[${i}]: only 'paragraph', 'heading', and 'rich-paragraph' elements are allowed in float groups`)
        }
      }
      // Validate spacing
      if (fg.spaceBefore !== undefined && (typeof fg.spaceBefore !== 'number' || fg.spaceBefore < 0)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'spaceBefore' must be a non-negative number`)
      }
      if (fg.spaceAfter !== undefined && (typeof fg.spaceAfter !== 'number' || fg.spaceAfter < 0)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'spaceAfter' must be a non-negative number`)
      }
      break
    }

    default: {
      const type = (el as { type: unknown }).type
      throw new PretextPdfError('VALIDATION_ERROR', `${prefix}: unknown element type '${String(type)}'. Valid types: 'paragraph', 'heading', 'spacer', 'table', 'image', 'svg', 'list', 'hr', 'page-break', 'code', 'rich-paragraph', 'blockquote', 'toc', 'comment', 'form-field', 'footnote-def'`)
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

