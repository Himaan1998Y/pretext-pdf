/**
 * validate/elements/text.ts — Text-bearing element validators.
 * Covers: paragraph, heading, rich-paragraph, blockquote, callout, code.
 * Extracted from src/validate.ts (#11a).
 */
import type { ContentElement } from '../../types.js'
import { PretextPdfError } from '../../errors.js'
import { ALLOWED_PROPS_SUB } from '../../allowed-props.js'
import {
  HEX_COLOR_REGEX,
  assertUnknownProps,
  validateUrl,
  withCycleGuard,
  type ValidationContext,
} from '../helpers.js'

export function validateParagraph(
  el: Extract<ContentElement, { type: 'paragraph' }>,
  prefix: string,
  ctx: ValidationContext,
): void {
  if (typeof el.text !== 'string') {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): 'text' must be a string`)
  }
  // NEW: Validate dir field
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
  if (el.url !== undefined && typeof el.url === 'string') validateUrl(el.url, `${prefix} (paragraph) url`)
  if (el.letterSpacing !== undefined && (typeof el.letterSpacing !== 'number' || el.letterSpacing < 0 || !isFinite(el.letterSpacing) || el.letterSpacing > 200)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): 'letterSpacing' must be a non-negative finite number and <= 200`)
  }
  if (el.annotation) {
    // Strict: validate annotation properties
    if (ctx.strict) {
      assertUnknownProps(el.annotation, ALLOWED_PROPS_SUB['annotation'], `${prefix}.annotation`, ctx.errors)
    }
    if (!el.annotation.contents || el.annotation.contents.trim() === '') {
      throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): annotation.contents is required and must be non-empty`)
    }
    if (el.annotation.contents.length > 5000) {
      throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): annotation.contents must be 5000 characters or fewer`)
    }
    if (el.annotation.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(el.annotation.color)) {
      throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): annotation.color must be a 6-digit hex color (e.g. "#FFFF00"). Got: "${el.annotation.color}"`)
    }
    if (el.annotation.author !== undefined && el.annotation.author.length > 100) {
      throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (paragraph): annotation.author must be 100 characters or fewer`)
    }
  }
}

export function validateHeading(
  el: Extract<ContentElement, { type: 'heading' }>,
  prefix: string,
  _ctx: ValidationContext,
): void {
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
  if (el.url !== undefined && typeof el.url === 'string') validateUrl(el.url, `${prefix} (heading) url`)
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
    if (el.annotation.contents.length > 5000) {
      throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): annotation.contents must be 5000 characters or fewer`)
    }
    if (el.annotation.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(el.annotation.color)) {
      throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): annotation.color must be a 6-digit hex color (e.g. "#FFFF00"). Got: "${el.annotation.color}"`)
    }
    if (el.annotation.author !== undefined && el.annotation.author.length > 100) {
      throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (heading): annotation.author must be 100 characters or fewer`)
    }
  }
}

export function validateRichParagraph(
  el: Extract<ContentElement, { type: 'rich-paragraph' }>,
  prefix: string,
  depth: number,
  ctx: ValidationContext,
): void {
  if (!Array.isArray(el.spans) || el.spans.length === 0) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): 'spans' must be a non-empty array`)
  }

  // Wrap spans walk with cycle guard
  withCycleGuard(ctx.seen, el, depth + 1, prefix, () => {
    for (let si = 0; si < el.spans.length; si++) {
      const span = el.spans[si]!
      // Strict: validate span properties
      if (ctx.strict) {
        assertUnknownProps(span, ALLOWED_PROPS_SUB['inline-span'], `${prefix}.spans[${si}]`, ctx.errors)
      }
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
      if (span.url !== undefined && typeof span.url === 'string') validateUrl(span.url, `${prefix} (rich-paragraph) spans[${si}].url`)
      if (span.href !== undefined && (typeof span.href !== 'string' || span.href.trim() === '')) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): spans[${si}].href must be a non-empty string if provided`)
      }
      if (span.href !== undefined && typeof span.href === 'string') validateUrl(span.href, `${prefix} (rich-paragraph) spans[${si}].href`)
      if (span.url !== undefined && span.href !== undefined) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): spans[${si}] cannot have both 'url' and 'href' — use one or the other`)
      }
      if (span.verticalAlign !== undefined && span.verticalAlign !== 'superscript' && span.verticalAlign !== 'subscript') {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): spans[${si}].verticalAlign must be "superscript" or "subscript"`)
      }
      if (span.letterSpacing !== undefined && (typeof span.letterSpacing !== 'number' || span.letterSpacing < 0 || !isFinite(span.letterSpacing) || span.letterSpacing > 200)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (rich-paragraph): spans[${si}].letterSpacing must be a non-negative finite number and <= 200`)
      }
    }
  })
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
}

export function validateBlockquote(
  el: Extract<ContentElement, { type: 'blockquote' }>,
  prefix: string,
  _ctx: ValidationContext,
): void {
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
}

export function validateCallout(
  el: Extract<ContentElement, { type: 'callout' }>,
  prefix: string,
  ctx: ValidationContext,
): void {
  // v2.1: Deprecation warning for 'content' field (will be renamed to 'text' in v3.0)
  if ('content' in el && !('style' in el)) {
    const logger = ctx.options?.logger || console
    logger.warn(
      '[pretext-pdf v2.1] DEPRECATION: callout element uses "content" field. ' +
      'This will be renamed to "text" in v3.0 for consistency with paragraph/heading/blockquote. ' +
      'Please update your code to use "text" instead of "content".'
    )
  }

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
}

export function validateCode(
  el: Extract<ContentElement, { type: 'code' }>,
  prefix: string,
  ctx: ValidationContext,
): void {
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
  if (!ctx.loadedFamilies.has(el.fontFamily)) {
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
  if (el.language !== undefined && typeof el.language !== 'string') {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (code): 'language' must be a string`)
  }
  if (el.highlightTheme !== undefined) {
    if (typeof el.highlightTheme !== 'object' || el.highlightTheme === null) {
      throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (code): 'highlightTheme' must be an object`)
    }
    for (const [k, v] of Object.entries(el.highlightTheme)) {
      if (v !== undefined && !HEX_COLOR_REGEX.test(v)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (code): highlightTheme.${k} must be a 6-digit hex string`)
      }
    }
  }
}
