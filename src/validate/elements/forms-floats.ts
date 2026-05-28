/**
 * validate/elements/forms-floats.ts — Heavy structural element validators.
 * Covers: form-field, footnote-def, float-group.
 * Split from structural.ts in v1.5.0 (B): float-group recurses into nested
 * ContentElements and uses withCycleGuard + depth + ctx.strict; form-field and
 * footnote-def belong here because they share the "heavier feature" concern.
 */
import type { ContentElement } from '../../types.js'
import { PretextPdfError } from '../../errors.js'
import { ALLOWED_PROPS, FORM_FIELD_VARIANT_PROPS } from '../../allowed-props.js'
import {
  assertUnknownProps,
  withCycleGuard,
  type ValidationContext,
} from '../helpers.js'

export function validateFormField(
  el: Extract<ContentElement, { type: 'form-field' }>,
  prefix: string,
  ctx: ValidationContext,
): void {
  // Derive valid fieldType values directly from the variant map — never drifts.
  const validFieldTypes = Object.keys(FORM_FIELD_VARIANT_PROPS) as Array<keyof typeof FORM_FIELD_VARIANT_PROPS>
  if (!(el.fieldType in FORM_FIELD_VARIANT_PROPS)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): fieldType must be one of: ${validFieldTypes.join(', ')}. Got: "${String(el.fieldType)}"`)
  }
  if (!el.name || typeof el.name !== 'string' || el.name.trim() === '') {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): name is required and must be a non-empty string`)
  }
  // AcroForm field names and option export values are written as PDF literal
  // strings by pdf-lib. Restrict to characters that are safe inside a PDF
  // literal string without escaping — this prevents /T and option-value
  // injection via unbalanced parentheses, backslashes, or null bytes.
  const ACROFORM_SAFE = /^[a-zA-Z0-9_.@\-]+$/
  if (!ACROFORM_SAFE.test(el.name)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): name must contain only letters, digits, underscores, hyphens, dots, or @. Got: "${el.name}"`)
  }
  if ((el.fieldType === 'radio' || el.fieldType === 'dropdown') && (!el.options || el.options.length === 0)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): type "${el.fieldType}" requires a non-empty options array`)
  }
  // Validate each options item has non-empty string value and label (H2)
  if (el.fieldType === 'radio' || el.fieldType === 'dropdown') {
    for (let i = 0; i < (el.options ?? []).length; i++) {
      const opt = (el.options ?? [])[i]
      if (!opt || typeof opt !== 'object') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): options[${i}] must be an object with 'value' and 'label' strings`)
      }
      if (typeof opt.value !== 'string' || opt.value.trim() === '') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): options[${i}].value must be a non-empty string`)
      }
      if (!ACROFORM_SAFE.test(opt.value)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): options[${i}].value must contain only letters, digits, underscores, hyphens, dots, or @`)
      }
      if (typeof opt.label !== 'string' || opt.label.trim() === '') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): options[${i}].label must be a non-empty string`)
      }
    }
  }
  if (el.width !== undefined && (typeof el.width !== 'number' || el.width <= 0)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): width must be a positive number`)
  }
  if (el.height !== undefined && (typeof el.height !== 'number' || el.height <= 0)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): height must be a positive number`)
  }
  if (el.borderColor !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(el.borderColor)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): borderColor must be a 6-digit hex color`)
  }
  if (el.backgroundColor !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(el.backgroundColor)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): backgroundColor must be a 6-digit hex color`)
  }
  if (el.accessibilityLabel !== undefined && (typeof el.accessibilityLabel !== 'string' || el.accessibilityLabel.trim() === '')) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): accessibilityLabel must be a non-empty string`)
  }
  // Per-variant strict unknown-props check. The top-level dispatch in validate/index.ts
  // uses ALLOWED_PROPS['form-field'] (the full union of all variant keys) so it never
  // false-flags valid variant-specific props. This check then narrows to the exact
  // variant's allowed set and rejects cross-variant contamination (e.g. 'checked' on text).
  if (ctx.strict) {
    const variantAllowed = FORM_FIELD_VARIANT_PROPS[el.fieldType as keyof typeof FORM_FIELD_VARIANT_PROPS]
    assertUnknownProps(el, variantAllowed as Set<string>, prefix, ctx.errors)
  }
}

export function validateFootnoteDef(
  el: Extract<ContentElement, { type: 'footnote-def' }>,
  prefix: string,
  _ctx: ValidationContext,
): void {
  if (!el.id || typeof el.id !== 'string' || el.id.trim() === '') {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (footnote-def): 'id' must be a non-empty string`)
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(el.id)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (footnote-def): 'id' must contain only letters, numbers, hyphens, or underscores. Got: "${el.id}"`)
  }
  if (!el.text || typeof el.text !== 'string' || el.text.trim() === '') {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (footnote-def): 'text' must be a non-empty string`)
  }
  if (el.fontSize !== undefined && (typeof el.fontSize !== 'number' || el.fontSize <= 0)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (footnote-def): 'fontSize' must be a positive number`)
  }
}

export function validateFloatGroup(
  el: Extract<ContentElement, { type: 'float-group' }>,
  prefix: string,
  depth: number,
  ctx: ValidationContext,
): void {
  // Validate image
  if (!el.image || !el.image.src || (typeof el.image.src !== 'string' && !(el.image.src instanceof Uint8Array))) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'image.src' must be a non-empty string path or Uint8Array`)
  }
  if (el.image.format !== undefined && el.image.format !== 'png' && el.image.format !== 'jpg' && el.image.format !== 'auto') {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'image.format' must be 'png', 'jpg', or 'auto'`)
  }
  if (el.image.height !== undefined && (typeof el.image.height !== 'number' || el.image.height <= 0)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'image.height' must be a positive number`)
  }
  // Validate float
  if (el.float !== 'left' && el.float !== 'right') {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'float' must be 'left' or 'right'`)
  }
  // Validate floatWidth
  if (el.floatWidth !== undefined && (typeof el.floatWidth !== 'number' || el.floatWidth < 30)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'floatWidth' must be a number >= 30`)
  }
  // Validate floatGap
  if (el.floatGap !== undefined && (typeof el.floatGap !== 'number' || el.floatGap < 0)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'floatGap' must be a non-negative number`)
  }
  // Validate content
  if (!Array.isArray(el.content) || el.content.length === 0) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'content' must be a non-empty array`)
  }
  if (el.content.length > 100) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'content' exceeds maximum of 100 items (${el.content.length} provided) — prevents DoS via resource exhaustion`)
  }

  // Wrap content walk with cycle guard
  withCycleGuard(ctx.seen, el, depth + 1, prefix, () => {
    for (let i = 0; i < el.content.length; i++) {
      const item = el.content[i]!
      if (!['paragraph', 'heading', 'rich-paragraph'].includes(item.type)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group).content[${i}]: only 'paragraph', 'heading', and 'rich-paragraph' elements are allowed in float groups`)
      }
      // Strict: validate nested content element properties
      if (ctx.strict) {
        const allowed = ALLOWED_PROPS[item.type as keyof typeof ALLOWED_PROPS]
        if (allowed) {
          assertUnknownProps(item, allowed, `${prefix} (float-group).content[${i}]`, ctx.errors)
        }
      }
    }
  })

  // Validate spacing
  if (el.spaceBefore !== undefined && (typeof el.spaceBefore !== 'number' || el.spaceBefore < 0)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'spaceBefore' must be a non-negative number`)
  }
  if (el.spaceAfter !== undefined && (typeof el.spaceAfter !== 'number' || el.spaceAfter < 0)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'spaceAfter' must be a non-negative number`)
  }
}
