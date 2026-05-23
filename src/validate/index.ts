/**
 * validate/index.ts — Orchestrator + public validate() / validateDocument().
 *
 * Top-level orchestration of document-level checks (page size, margins, fonts,
 * metadata, encryption, watermark, signature, etc.) and dispatching per-element
 * validation to the submodules in ./elements/. The dispatch order and every
 * error code/message is preserved bit-exact from the pre-split src/validate.ts.
 *
 * Extracted in v1.4.0 #11a — the original src/validate.ts was 1834 lines and
 * is now a thin re-export barrel pointing here.
 */
import type {
  PdfDocument,
  ContentElement,
  RenderOptions,
  ValidationResult,
  Logger,
} from '../types.js'
import { PretextPdfError } from '../errors.js'
import { resolvePageDimensions } from '../page-sizes.js'
import { ALLOWED_PROPS, ALLOWED_PROPS_SUB } from '../allowed-props.js'
import { ELEMENT_TYPES } from '../element-types.js'
import { findPlugin, runPluginValidate } from '../plugin-registry.js'

import {
  BUNDLED_FAMILIES,
  HEX_COLOR_REGEX,
  LANGUAGE_TAG_REGEX,
  assertDepthOk,
  assertUnknownProps,
  formatErrors,
  validateFontSpec,
  validateMetadataString,
  type ValidationContext,
} from './helpers.js'
import { validateFontReferences } from './fonts.js'
import { isValidPdfDocumentLike, parseValidationErrorsStructured } from './errors.js'
import {
  validateParagraph,
  validateHeading,
  validateRichParagraph,
  validateBlockquote,
  validateCallout,
  validateCode,
} from './elements/text.js'
import { validateTable } from './elements/table.js'
import { validateList } from './elements/list.js'
import {
  validateImage,
  validateSvg,
  validateQrCode,
  validateBarcode,
  validateChart,
} from './elements/media.js'
import {
  validateSpacer,
  validateHr,
  validateToc,
  validateTocEntry,
  validateComment,
  validateFormField,
  validateFootnoteDef,
  validateFloatGroup,
} from './elements/structural.js'

/**
 * Validate a PdfDocument and throw a {@link PretextPdfError} if any errors are found.
 * @public
 */
export function validate(doc: PdfDocument, options?: RenderOptions): void {
  const strict = options?.strict ?? false
  const errors: string[] = []

  // Plugin pre-flight: enforce type string safety and no collision with built-ins
  for (const plugin of options?.plugins ?? []) {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(plugin.type)) {
      throw new PretextPdfError('VALIDATION_ERROR', `Plugin type '${plugin.type}' is invalid. Must start with a letter and contain only letters, digits, hyphens, or underscores.`)
    }
    if ((ELEMENT_TYPES as readonly string[]).includes(plugin.type)) {
      throw new PretextPdfError('VALIDATION_ERROR', `Plugin type '${plugin.type}' collides with a built-in element type. Choose a different type string.`)
    }
  }

  // Strict: check doc-level properties
  if (strict) {
    assertUnknownProps(doc, ALLOWED_PROPS_SUB['document'], 'doc', errors)
  }

  // content must be a non-empty array
  if (!Array.isArray(doc.content) || doc.content.length === 0) {
    throw new PretextPdfError('VALIDATION_ERROR', 'document.content must be a non-empty array')
  }

  // memory guard
  if (doc.content.length > 50_000) {
    throw new PretextPdfError('VALIDATION_ERROR', `document.content has ${doc.content.length} elements (hard limit: 50,000). Split into multiple documents.`)
  }
  if (doc.content.length > 10_000) {
    ;(options?.logger?.warn ?? console.warn)(`[pretext-pdf] Performance advisory: document.content has ${doc.content.length} elements (recommended max: 10,000). Large documents may be slow.`)
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

  // encryption
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

  // metadata
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

  // Per-call cycle-detection set — must NOT be shared across validate() calls
  // (see withCycleGuard docblock). Threading it through validateElement keeps
  // concurrent validations isolated on a multi-document server.
  const seen: WeakSet<object> = new WeakSet()

  // Build the ValidationContext. This object replaces the closure-captured
  // locals that used to live inside validate()'s body when the dispatcher
  // was a nested function. Threading the context (rather than free-floating
  // params) decouples element validators and removes hidden coupling.
  const ctx: ValidationContext = {
    errors,
    strict,
    loadedFamilies,
    seen,
    options,
  }

  for (let i = 0; i < doc.content.length; i++) {
    validateElement(doc.content[i]!, i, 0, ctx)
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

  // Throw collected strict validation errors
  if (errors.length > 0) {
    const msg = formatErrors(errors)
    throw new PretextPdfError('VALIDATION_ERROR', msg)
  }
}

/**
 * Validate a pretext-pdf document and return a structured result instead of throwing.
 *
 * Use this when you want to inspect all validation errors programmatically.
 * The existing {@link validate} function throws on first error and is unchanged.
 *
 * @param doc - The document to validate (typed as `unknown` to accept unverified input)
 * @param options - `{ strict?: boolean; logger?: Logger }` — strict defaults to false (matches render() behavior); logger routes diagnostic warnings away from console.warn
 * @returns {@link ValidationResult} with `valid`, `errors[]`, and `errorCount`
 * @public
 */
export function validateDocument(
  doc: unknown,
  options?: { strict?: boolean; logger?: Logger }
): ValidationResult {
  if (!isValidPdfDocumentLike(doc)) {
    return { valid: false, errors: [{ path: 'document', message: 'Document must be a non-null object', severity: 'error' as const, code: 'VALIDATION_ERROR' as const }], errorCount: 1, warningCount: 0 }
  }
  try {
    validate(doc, { strict: options?.strict ?? false, ...(options?.logger !== undefined ? { logger: options.logger } : {}) })
    return { valid: true, errors: [], errorCount: 0, warningCount: 0 }
  } catch (err) {
    if (err instanceof PretextPdfError) {
      const errors = parseValidationErrorsStructured(err.message, err.code)
      const warnings = errors.filter((e) => e.severity === 'warning')
      const warningCount = warnings.length
      const headerMatch = err.message.match(/^Strict validation failed \((\d+) issue/)
      const errorCount = headerMatch?.[1] != null ? parseInt(headerMatch[1]!, 10) : errors.filter((e) => e.severity === 'error').length
      return { valid: false, errors, errorCount, warningCount }
    }
    const msg = err instanceof Error ? err.message : String(err)
    return { valid: false, errors: [{ path: 'document', message: `Unexpected validation error: ${msg}`, severity: 'error' as const, code: 'VALIDATION_ERROR' as const }], errorCount: 1, warningCount: 0 }
  }
}

/**
 * Element-level dispatch. Order of checks (depth guard → type check → toc-entry
 * rejection → cycle guard → strict-props → switch) is preserved bit-exact from
 * the pre-split implementation.
 */
function validateElement(
  el: ContentElement,
  index: number,
  depth: number,
  ctx: ValidationContext,
): void {
  const prefix = `content[${index}]`

  // Depth cap: fires before any per-type logic runs, including for plugin
  // elements that do not open their own withCycleGuard scope.
  assertDepthOk(depth, prefix)

  if (!el || typeof el !== 'object' || !('type' in el)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix}: each element must have a 'type' field`)
  }

  // Reject the internal TOC entry type before normal element handling.
  // TocEntryElement is synthesized internally during the measurement pass and
  // is not part of the public ContentElement union, so users must not supply it.
  if ((el as { type: unknown }).type === 'toc-entry') {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix}: 'toc-entry' is an internal type and cannot be used in document content`)
  }

  // Cycle guard is owned by the per-type validators (validateList opens its
  // own withCycleGuard scope at the top of list.ts, validateFloatGroup does
  // the same in structural.ts). An outer guard here would run a no-op body
  // and finally-delete the element from `seen` BEFORE the inner guard adds
  // it, so it never actually protected anything. Removed in v1.4.1 (M1).

  // Strict: check element properties match allowed set for type
  if (ctx.strict) {
    const allowed = ALLOWED_PROPS[el.type as keyof typeof ALLOWED_PROPS]
    if (allowed) {
      assertUnknownProps(el, allowed, prefix, ctx.errors)
    }
  }

  switch (el.type) {
    case 'paragraph':       validateParagraph(el, prefix, ctx); break
    case 'heading':         validateHeading(el, prefix, ctx); break
    case 'spacer':          validateSpacer(el, prefix, ctx); break
    case 'table':           validateTable(el, prefix, depth, ctx); break
    case 'image':           validateImage(el, prefix, ctx); break
    case 'svg':             validateSvg(el, prefix, ctx); break
    case 'qr-code':         validateQrCode(el, prefix, ctx); break
    case 'barcode':         validateBarcode(el, prefix, ctx); break
    case 'chart':           validateChart(el, prefix, ctx); break
    case 'list':            validateList(el, prefix, depth, ctx); break
    case 'hr':              validateHr(el, prefix, ctx); break
    case 'page-break':      /* no fields to validate */ break
    case 'rich-paragraph':  validateRichParagraph(el, prefix, depth, ctx); break
    case 'code':            validateCode(el, prefix, ctx); break
    case 'blockquote':      validateBlockquote(el, prefix, ctx); break
    case 'callout':         validateCallout(el, prefix, ctx); break
    case 'toc':             validateToc(el, prefix, ctx); break
    // @ts-expect-error - toc-entry is internal but validated defensively
    case 'toc-entry':       validateTocEntry(el, prefix, ctx); break
    case 'comment':         validateComment(el, prefix, ctx); break
    case 'form-field':      validateFormField(el, prefix, ctx); break
    case 'footnote-def':    validateFootnoteDef(el, prefix, ctx); break
    case 'float-group':     validateFloatGroup(el, prefix, depth, ctx); break
    default: {
      const type = (el as { type: unknown }).type
      const plugins = ctx.options?.plugins ?? []
      const plugin = findPlugin(plugins, String(type))
      if (plugin) {
        let rejection: string | undefined
        try {
          rejection = runPluginValidate(plugin, el as Record<string, unknown>)
        } catch (err) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (${String(type)}): plugin validate hook threw: ${err instanceof Error ? err.message : String(err)}`)
        }
        if (rejection) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (${String(type)}): ${rejection}`)
        }
        break
      }
      const validList = ELEMENT_TYPES.map(t => `'${t}'`).join(', ')
      throw new PretextPdfError('VALIDATION_ERROR', `${prefix}: unknown element type '${String(type)}'. Valid types: ${validList}`)
    }
  }
}
