/**
 * validate/elements/forms-floats.ts — Heavy structural element validators.
 * Covers: form-field, footnote-def, float-group.
 * Split from structural.ts in v1.5.0 (B): float-group recurses into nested
 * ContentElements and uses withCycleGuard + depth + ctx.strict; form-field and
 * footnote-def belong here because they share the "heavier feature" concern.
 */
import type { ContentElement } from '../../types.js'
import { PretextPdfError } from '../../errors.js'
import { ALLOWED_PROPS } from '../../allowed-props.js'
import {
  assertUnknownProps,
  withCycleGuard,
  type ValidationContext,
} from '../helpers.js'

export function validateFormField(
  el: Extract<ContentElement, { type: 'form-field' }>,
  prefix: string,
  _ctx: ValidationContext,
): void {
  const fieldTypes = ['text', 'checkbox', 'radio', 'dropdown', 'button']
  if (!fieldTypes.includes(el.fieldType)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): fieldType must be one of: ${fieldTypes.join(', ')}`)
  }
  if (!el.name || el.name.trim() === '') {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): name is required and must be a non-empty string`)
  }
  if ((el.fieldType === 'radio' || el.fieldType === 'dropdown') && (!el.options || el.options.length === 0)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): type "${el.fieldType}" requires a non-empty options array`)
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
