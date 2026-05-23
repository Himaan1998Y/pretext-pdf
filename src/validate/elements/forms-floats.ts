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
  const ff = el as import('../../types.js').FormFieldElement
  const fieldTypes = ['text', 'checkbox', 'radio', 'dropdown', 'button']
  if (!fieldTypes.includes(ff.fieldType)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): fieldType must be one of: ${fieldTypes.join(', ')}`)
  }
  if (!ff.name || ff.name.trim() === '') {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): name is required and must be a non-empty string`)
  }
  if ((ff.fieldType === 'radio' || ff.fieldType === 'dropdown') && (!ff.options || ff.options.length === 0)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): type "${ff.fieldType}" requires a non-empty options array`)
  }
  if (ff.width !== undefined && (typeof ff.width !== 'number' || ff.width <= 0)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): width must be a positive number`)
  }
  if (ff.height !== undefined && (typeof ff.height !== 'number' || ff.height <= 0)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): height must be a positive number`)
  }
  if (ff.borderColor !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(ff.borderColor)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): borderColor must be a 6-digit hex color`)
  }
  if (ff.backgroundColor !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(ff.backgroundColor)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (form-field): backgroundColor must be a 6-digit hex color`)
  }
}

export function validateFootnoteDef(
  el: Extract<ContentElement, { type: 'footnote-def' }>,
  prefix: string,
  _ctx: ValidationContext,
): void {
  const fn = el as import('../../types.js').FootnoteDefElement
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
}

export function validateFloatGroup(
  el: Extract<ContentElement, { type: 'float-group' }>,
  prefix: string,
  depth: number,
  ctx: ValidationContext,
): void {
  const fg = el as import('../../types.js').FloatGroupElement
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
  if (fg.floatWidth !== undefined && (typeof fg.floatWidth !== 'number' || fg.floatWidth < 30)) {
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
  if (fg.content.length > 100) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'content' exceeds maximum of 100 items (${fg.content.length} provided) — prevents DoS via resource exhaustion`)
  }

  // Wrap content walk with cycle guard
  withCycleGuard(ctx.seen, fg, depth + 1, prefix, () => {
    for (let i = 0; i < fg.content.length; i++) {
      const item = fg.content[i]!
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
  if (fg.spaceBefore !== undefined && (typeof fg.spaceBefore !== 'number' || fg.spaceBefore < 0)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'spaceBefore' must be a non-negative number`)
  }
  if (fg.spaceAfter !== undefined && (typeof fg.spaceAfter !== 'number' || fg.spaceAfter < 0)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (float-group): 'spaceAfter' must be a non-negative number`)
  }
}
