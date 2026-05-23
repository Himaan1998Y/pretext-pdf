/**
 * validate/document.ts — Document-level checks extracted from validate/index.ts.
 *
 * Holds the inline doc-level guards (pageSize, margins, fonts, header/footer,
 * defaultParagraphStyle, sections, watermark, encryption, signature,
 * bookmarks, hyphenation, metadata) that used to live in the body of
 * validate(). Extracted in v1.5.0 item A to keep validate/index.ts focused
 * on orchestration + per-element dispatch.
 *
 * Every error code, error message, and check order is preserved bit-exact
 * from the pre-extraction inline implementation. The
 * test/validate-document-snapshot.test.ts tripwire guards this contract.
 *
 * Reads `ctx.strict`. Writes to `ctx.errors` (strict-mode unknown-prop
 * accumulator). Throws `PretextPdfError` on first invalid value, matching
 * the original eager-throw semantics.
 */
import type { PdfDocument } from '../types.js'
import { PretextPdfError } from '../errors.js'
import { resolvePageDimensions } from '../page-sizes.js'
import { ALLOWED_PROPS_SUB } from '../allowed-props.js'
import {
  HEX_COLOR_REGEX,
  LANGUAGE_TAG_REGEX,
  assertUnknownProps,
  validateFontSpec,
  validateMetadataString,
  type ValidationContext,
} from './helpers.js'

/**
 * Run every document-level validation check, in the original order.
 *
 * @internal — not part of the public API; called by validate() in
 * validate/index.ts between the memory-guard warning and the element-dispatch
 * loop.
 */
export function validateDocumentLevel(doc: PdfDocument, ctx: ValidationContext): void {
  const strict = ctx.strict
  const errors = ctx.errors

  // ── pageSize ──
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

  // ── margins ──
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

  // ── fonts ──
  // font specs
  if (doc.fonts) {
    for (const font of doc.fonts) {
      validateFontSpec(font)
    }
  }

  // ── header / footer ──
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

  // ── defaultParagraphStyle ──
  if (doc.defaultParagraphStyle !== undefined) {
    const dps = doc.defaultParagraphStyle
    if (typeof dps !== 'object' || dps === null || Array.isArray(dps)) {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.defaultParagraphStyle must be an object')
    }
    if (dps.fontSize !== undefined && (typeof dps.fontSize !== 'number' || dps.fontSize <= 0 || dps.fontSize > 500 || !isFinite(dps.fontSize))) {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.defaultParagraphStyle.fontSize must be a number > 0 and <= 500')
    }
    if (dps.lineHeight !== undefined && (typeof dps.lineHeight !== 'number' || dps.lineHeight <= 0 || !isFinite(dps.lineHeight))) {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.defaultParagraphStyle.lineHeight must be a positive finite number')
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

  // ── sections ──
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

  // ── watermark ──
  if (doc.watermark) {
    const wm = doc.watermark
    if (!wm.text && !wm.image) {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.watermark requires either text or image — received an object with neither.')
    }
    if (wm.opacity !== undefined && (typeof wm.opacity !== 'number' || wm.opacity < 0 || wm.opacity > 1 || !isFinite(wm.opacity))) {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.watermark.opacity must be a number 0.0–1.0')
    }
    if (wm.fontSize !== undefined && (typeof wm.fontSize !== 'number' || wm.fontSize <= 0 || wm.fontSize > 500 || !isFinite(wm.fontSize))) {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.watermark.fontSize must be a positive finite number and <= 500')
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

  // ── encryption ──
  if (doc.encryption) {
    const enc = doc.encryption
    if (strict) {
      assertUnknownProps(enc, ALLOWED_PROPS_SUB['encryption'], 'doc.encryption', errors)
    }
    if (enc.userPassword !== undefined && typeof enc.userPassword !== 'string') {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.encryption.userPassword must be a string if provided')
    }
    if (enc.userPassword !== undefined && enc.userPassword === '') {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.encryption.userPassword must not be an empty string — an empty password provides no access control. Omit userPassword for permissions-only encryption.')
    }
    if (enc.ownerPassword !== undefined && typeof enc.ownerPassword !== 'string') {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.encryption.ownerPassword must be a string if provided')
    }
    if (enc.ownerPassword !== undefined && enc.ownerPassword === '') {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.encryption.ownerPassword must not be an empty string')
    }
    // permissions sub-fields are booleans — TypeScript enforces the type, no runtime check needed
    if (doc.encryption.userPassword === undefined) {
      console.warn(
        '[pretext-pdf] doc.encryption is set without userPassword — ' +
        'the PDF will open without a password (owner-only encryption). ' +
        'Set userPassword to require a password to open the document.'
      )
    }
  }

  // ── signature ──
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
    // Crypto signature validation
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
      throw new PretextPdfError('SIGNATURE_CERT_AND_ENCRYPTION', 'Cannot use both signature.p12 (cryptographic signing) and encryption together — the encryption step would invalidate the cryptographic signature.')
    }
  }

  // ── bookmarks ──
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

  // ── hyphenation ──
  if (doc.hyphenation) {
    const h = doc.hyphenation
    if (!h.language || typeof h.language !== 'string') {
      throw new PretextPdfError('VALIDATION_ERROR', 'doc.hyphenation.language is required (e.g. "en-us")')
    }
    if (!LANGUAGE_TAG_REGEX.test(h.language)) {
      throw new PretextPdfError('VALIDATION_ERROR', `doc.hyphenation.language must be a BCP47 tag like "en-us" or "de" (letters and hyphens only). Got: "${h.language}"`)
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

  // ── metadata ──
  if (doc.metadata) {
    const m = doc.metadata
    if (m.language !== undefined && (typeof m.language !== 'string' || m.language.trim() === '')) {
      throw new PretextPdfError('VALIDATION_ERROR', 'metadata.language must be a non-empty string (BCP47 tag e.g. "en-US")')
    }
    if (m.language !== undefined && typeof m.language === 'string') validateMetadataString(m.language, 'language')
    if (m.producer !== undefined && (typeof m.producer !== 'string' || m.producer.trim() === '')) {
      throw new PretextPdfError('VALIDATION_ERROR', 'metadata.producer must be a non-empty string')
    }
    // Validate free-text fields for injection chars and length
    for (const field of ['title', 'author', 'subject', 'keywords', 'creator', 'producer'] as const) {
      const val = m[field]
      if (val !== undefined && typeof val === 'string') validateMetadataString(val, field)
    }
  }
}
