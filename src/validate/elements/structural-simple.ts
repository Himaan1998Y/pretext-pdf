/**
 * validate/elements/structural-simple.ts — Light structural element validators.
 * Covers: spacer, hr, toc, toc-entry, comment.
 * Split from structural.ts in v1.5.0 (B): these validators don't recurse into
 * nested ContentElements and don't need withCycleGuard / depth / ctx.strict.
 */
import type { ContentElement, CommentElement } from '../../types.js'
import { PretextPdfError } from '../../errors.js'
import {
  HEX_COLOR_REGEX,
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
