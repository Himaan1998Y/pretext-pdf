/**
 * validate/index.ts — Orchestrator + public validate() / validateDocument().
 *
 * Top-level orchestration: plugin pre-flight, doc-shape guards, memory caps,
 * ValidationContext construction, document-level check dispatch (delegated to
 * ./document.ts), per-element dispatch (delegated to ./elements/*), footnote
 * cross-validation, and the strict-error flush. Every error code/message is
 * preserved bit-exact from the pre-split src/validate.ts.
 *
 * Extracted in v1.4.0 #11a — the original src/validate.ts was 1834 lines and
 * is now a thin re-export barrel pointing here. In v1.5.0 item A the inline
 * document-level checks (pageSize, margins, fonts, header/footer,
 * defaultParagraphStyle, sections, watermark, encryption, signature,
 * bookmarks, hyphenation, metadata) were extracted into ./document.ts.
 */
import type {
  PdfDocument,
  ContentElement,
  RenderOptions,
  ValidationResult,
  Logger,
} from '../types.js'
import { PretextPdfError } from '../errors.js'
import { ALLOWED_PROPS, ALLOWED_PROPS_SUB } from '../allowed-props.js'
import { ELEMENT_TYPES } from '../element-types.js'
import { findPlugin, runPluginValidate } from '../plugin-registry.js'

import {
  BUNDLED_FAMILIES,
  assertDepthOk,
  assertUnknownProps,
  formatErrors,
  type ValidationContext,
} from './helpers.js'
import { validateDocumentLevel } from './document.js'
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
  validateComment,
} from './elements/structural-simple.js'
import {
  validateFormField,
  validateFootnoteDef,
  validateFloatGroup,
} from './elements/forms-floats.js'

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

  // Document-level checks (pageSize, margins, fonts, header/footer,
  // defaultParagraphStyle, sections, watermark, encryption, signature,
  // bookmarks, hyphenation, metadata). Extracted to validate/document.ts in
  // v1.5.0 item A; order, error codes, and messages preserved bit-exact.
  // The ctx is constructed early so doc-level checks share the same errors[]
  // accumulator and strict flag used by element validators below.
  const loadedFamilies = new Set<string>()
  const seen: WeakSet<object> = new WeakSet()
  const ctx: ValidationContext = {
    errors,
    strict,
    loadedFamilies,
    seen,
    options,
  }
  validateDocumentLevel(doc, ctx)

  // validate each content element
  // Populate loadedFamilies AFTER document-level checks succeed (validateFontSpec
  // would have thrown above on any invalid font.family). Element validators
  // and validateFontReferences both read from this Set via ctx.
  for (const family of BUNDLED_FAMILIES) loadedFamilies.add(family)
  for (const f of doc.fonts ?? []) loadedFamilies.add(f.family)
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

  // ctx (with errors/strict/loadedFamilies/seen/options) was constructed
  // above so document-level checks and element validators share the same
  // ValidationContext. The per-call `seen` WeakSet keeps concurrent
  // validate() calls isolated on multi-document servers (see withCycleGuard
  // docblock for the race-condition rationale).

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
  // the same in forms-floats.ts). An outer guard here would run a no-op body
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
