/**
 * validate/elements/media.ts — Media element validators.
 * Covers: image, svg, qr-code, barcode, chart.
 * Extracted from src/validate.ts (#11a).
 */
import type { ContentElement } from '../../types.js'
import { PretextPdfError } from '../../errors.js'
import { HEX_COLOR_REGEX, looksLikeUrl, validateUrl, type ValidationContext } from '../helpers.js'

// v1.4.1 (M5): pre-flight URL scheme check. Matches the assets.ts runtime
// SSRF guard's posture so validate-only callers (CLI lint, MCP validate
// tool) catch unsafe schemes before render time. Helper moved to helpers.ts
// in v1.5.1 (H1) so the watermark validator can share it.

export function validateImage(
  el: Extract<ContentElement, { type: 'image' }>,
  prefix: string,
  _ctx: ValidationContext,
): void {
  if (!el.src || (typeof el.src !== 'string' && !(el.src instanceof Uint8Array))) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (image): 'src' must be a non-empty string path or Uint8Array`)
  }
  if (typeof el.src === 'string' && (el.src.startsWith('\\\\') || el.src.startsWith('//'))) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (image): 'src' must not be a UNC/network path`)
  }
  if (typeof el.src === 'string' && looksLikeUrl(el.src)) {
    // validateUrl throws VALIDATION_ERROR for any scheme outside the
    // SAFE_URL_SCHEME allow-list (http, https, mailto, ftp, anchor).
    // data:/javascript:/blob:/file: all fail here, matching the assets.ts
    // BLOCKED_SCHEMES guard.
    validateUrl(el.src, `${prefix} (image): 'src'`)
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
  // Float validation
  if (el.float !== undefined && el.float !== 'left' && el.float !== 'right') {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (image): 'float' must be 'left' or 'right'`)
  }
  if (el.float !== undefined && !el.floatText && !el.floatSpans) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (image): 'floatText' or 'floatSpans' is required when 'float' is set`)
  }
  if (el.floatText !== undefined && el.floatSpans !== undefined) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (image): 'floatText' and 'floatSpans' are mutually exclusive — use one or the other`)
  }
  if (el.floatText !== undefined && el.float === undefined) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (image): 'floatText' has no effect without 'float'`)
  }
  if (el.floatSpans !== undefined && el.float === undefined) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (image): 'floatSpans' has no effect without 'float'`)
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
}

export function validateSvg(
  el: Extract<ContentElement, { type: 'svg' }>,
  prefix: string,
  _ctx: ValidationContext,
): void {
  if (typeof el.svg === 'string' && el.svg.trim().length === 0) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (svg): 'svg' must not be an empty string`)
  }
  const hasSvg = typeof el.svg === 'string' && el.svg.trim().length > 0
  const hasSrc = typeof el.src === 'string' && el.src.trim().length > 0
  if (hasSvg && !el.svg!.trim().startsWith('<')) {
    throw new PretextPdfError('SVG_INVALID_MARKUP', `${prefix} (svg): 'svg' must be valid SVG markup (must start with '<')`)
  }
  if (hasSrc) {
    const src = el.src!
    const isUNC = src.startsWith('\\\\') || src.startsWith('//')
    if (isUNC) {
      throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (svg): 'src' must not be a UNC/network path`)
    }
    if (!src.startsWith('/') && !src.startsWith('https://') && !/^[A-Za-z]:[/\\]/.test(src)) {
      throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (svg): 'src' must be an absolute file path or an https:// URL`)
    }
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
}

export function validateQrCode(
  el: Extract<ContentElement, { type: 'qr-code' }>,
  prefix: string,
  _ctx: ValidationContext,
): void {
  if (typeof el.data !== 'string' || el.data.trim().length === 0) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (qr-code): 'data' must be a non-empty string`)
  }
  if (el.data.length > 2953) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (qr-code): 'data' exceeds maximum QR capacity of 2953 characters (got ${el.data.length})`)
  }
  if (el.errorCorrectionLevel !== undefined && !['L', 'M', 'Q', 'H'].includes(el.errorCorrectionLevel)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (qr-code): 'errorCorrectionLevel' must be 'L', 'M', 'Q', or 'H'`)
  }
  if (el.size !== undefined && (typeof el.size !== 'number' || el.size <= 0 || !isFinite(el.size))) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (qr-code): 'size' must be a positive finite number`)
  }
  if (el.foreground !== undefined && !HEX_COLOR_REGEX.test(el.foreground)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (qr-code): 'foreground' must be a 6-digit hex string like '#000000'`)
  }
  if (el.background !== undefined && !HEX_COLOR_REGEX.test(el.background)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (qr-code): 'background' must be a 6-digit hex string like '#ffffff'`)
  }
  if (el.margin !== undefined && (typeof el.margin !== 'number' || el.margin < 0 || !isFinite(el.margin))) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (qr-code): 'margin' must be a non-negative finite number`)
  }
  if (el.align !== undefined && !['left', 'center', 'right'].includes(el.align)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (qr-code): 'align' must be 'left', 'center', or 'right'`)
  }
  if (el.spaceAfter !== undefined && (typeof el.spaceAfter !== 'number' || el.spaceAfter < 0 || !isFinite(el.spaceAfter))) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (qr-code): 'spaceAfter' must be a non-negative finite number`)
  }
  if (el.spaceBefore !== undefined && (typeof el.spaceBefore !== 'number' || el.spaceBefore < 0 || !isFinite(el.spaceBefore))) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (qr-code): 'spaceBefore' must be a non-negative finite number`)
  }
}

export function validateBarcode(
  el: Extract<ContentElement, { type: 'barcode' }>,
  prefix: string,
  _ctx: ValidationContext,
): void {
  if (typeof el.symbology !== 'string' || el.symbology.trim().length === 0) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (barcode): 'symbology' must be a non-empty string (e.g. 'ean13', 'code128')`)
  }
  if (typeof el.data !== 'string' || el.data.trim().length === 0) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (barcode): 'data' must be a non-empty string`)
  }
  if (el.width !== undefined && (typeof el.width !== 'number' || el.width <= 0 || !isFinite(el.width))) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (barcode): 'width' must be a positive finite number`)
  }
  if (el.height !== undefined && (typeof el.height !== 'number' || el.height <= 0 || !isFinite(el.height))) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (barcode): 'height' must be a positive finite number`)
  }
  if (el.align !== undefined && !['left', 'center', 'right'].includes(el.align)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (barcode): 'align' must be 'left', 'center', or 'right'`)
  }
  if (el.spaceAfter !== undefined && (typeof el.spaceAfter !== 'number' || el.spaceAfter < 0 || !isFinite(el.spaceAfter))) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (barcode): 'spaceAfter' must be a non-negative finite number`)
  }
  if (el.spaceBefore !== undefined && (typeof el.spaceBefore !== 'number' || el.spaceBefore < 0 || !isFinite(el.spaceBefore))) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (barcode): 'spaceBefore' must be a non-negative finite number`)
  }
}

function _hasUnsafeChartKeys(node: unknown, depth = 0): boolean {
  if (depth > 32 || node === null || typeof node !== 'object') return false
  for (const key of Object.keys(node as Record<string, unknown>)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return true
    if (_hasUnsafeChartKeys((node as Record<string, unknown>)[key], depth + 1)) return true
  }
  return false
}

export function validateChart(
  el: Extract<ContentElement, { type: 'chart' }>,
  prefix: string,
  _ctx: ValidationContext,
): void {
  if (el.spec === null || typeof el.spec !== 'object' || Array.isArray(el.spec)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (chart): 'spec' must be a plain vega-lite specification object`)
  }
  if (_hasUnsafeChartKeys(el.spec)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (chart): 'spec' contains unsafe keys (__proto__, constructor, or prototype)`)
  }
  if (el.width !== undefined && (typeof el.width !== 'number' || el.width <= 0 || !isFinite(el.width))) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (chart): 'width' must be a positive finite number`)
  }
  if (el.height !== undefined && (typeof el.height !== 'number' || el.height <= 0 || !isFinite(el.height))) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (chart): 'height' must be a positive finite number`)
  }
  if (el.caption !== undefined && typeof el.caption !== 'string') {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (chart): 'caption' must be a string`)
  }
  if (el.align !== undefined && !['left', 'center', 'right'].includes(el.align)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (chart): 'align' must be 'left', 'center', or 'right'`)
  }
  if (el.spaceAfter !== undefined && (typeof el.spaceAfter !== 'number' || el.spaceAfter < 0 || !isFinite(el.spaceAfter))) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (chart): 'spaceAfter' must be a non-negative finite number`)
  }
  if (el.spaceBefore !== undefined && (typeof el.spaceBefore !== 'number' || el.spaceBefore < 0 || !isFinite(el.spaceBefore))) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (chart): 'spaceBefore' must be a non-negative finite number`)
  }
}
