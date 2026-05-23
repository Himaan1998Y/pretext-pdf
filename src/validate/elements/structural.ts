/**
 * validate/elements/structural.ts — Structural element validators.
 * Covers: spacer, hr, page-break, toc, toc-entry, comment, footnote-def,
 *         float-group, form-field.
 * Extracted from src/validate.ts (#11a).
 */
import type { ContentElement, CommentElement } from '../../types.js'
import { PretextPdfError } from '../../errors.js'
import { ALLOWED_PROPS } from '../../allowed-props.js'
import {
  HEX_COLOR_REGEX,
  assertUnknownProps,
  withCycleGuard,
  type ValidationContext,
} from '../helpers.js'

export function validateSpacer(
  el: Extract<ContentElement, { type: 'spacer' }>,
  prefix: string,
  _ctx: ValidationContext,
): void {
  if (typeof el.height !== 'number' || el.height < 0 || el.height > 14400 || !isFinite(el.height)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (spacer): 'height' must be a non-negative finite number and <= 14400pt (200 inches)`)
  }
}

export function validateHr(
  el: Extract<ContentElement, { type: 'hr' }>,
  prefix: string,
  _ctx: ValidationContext,
): void {
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
}

// page-break has no fields to validate

export function validateToc(
  el: Extract<ContentElement, { type: 'toc' }>,
  prefix: string,
  _ctx: ValidationContext,
): void {
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
}

/**
 * Internal toc-entry validator.
 * toc-entry elements are produced internally by the TOC two-pass processor;
 * users normally don't author them. Validate shape defensively in case they do.
 */
export function validateTocEntry(
  el: unknown,
  prefix: string,
  _ctx: ValidationContext,
): void {
  const tocEntry = el as import('../../types-internal.js').TocEntryElement
  if (typeof tocEntry.text !== 'string') {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (toc-entry): 'text' must be a string`)
  }
  if (typeof tocEntry.pageNumber !== 'number' || !isFinite(tocEntry.pageNumber) || tocEntry.pageNumber < 0) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (toc-entry): 'pageNumber' must be a non-negative finite number`)
  }
  if (tocEntry.level !== undefined && ![1, 2, 3, 4].includes(tocEntry.level)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (toc-entry): 'level' must be 1, 2, 3, or 4`)
  }
  if (tocEntry.levelIndent !== undefined && (typeof tocEntry.levelIndent !== 'number' || tocEntry.levelIndent < 0 || !isFinite(tocEntry.levelIndent))) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (toc-entry): 'levelIndent' must be a non-negative finite number`)
  }
  if (tocEntry.leader !== undefined && (typeof tocEntry.leader !== 'string' || tocEntry.leader.length === 0)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (toc-entry): 'leader' must be a non-empty string`)
  }
}

export function validateComment(
  el: Extract<ContentElement, { type: 'comment' }>,
  prefix: string,
  _ctx: ValidationContext,
): void {
  const commentEl = el as CommentElement
  if (!commentEl.contents || typeof commentEl.contents !== 'string' || commentEl.contents.trim() === '') {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (comment): 'contents' is required and must be a non-empty string`)
  }
  if (commentEl.color !== undefined && !HEX_COLOR_REGEX.test(commentEl.color)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (comment): 'color' must be a valid 6-digit hex color`)
  }
}

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
