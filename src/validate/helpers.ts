/**
 * validate/helpers.ts — Pure helpers + shared regex + ValidationContext type.
 * Extracted from src/validate.ts during the v1.4.0 god-file split (#11a).
 * No behavior changes — every error code, message, and order preserved.
 */
import type { FontSpec, RenderOptions } from '../types.js'
import { PretextPdfError } from '../errors.js'

// ── Cycle Detection & Depth Guards ─────────────────────────────────────────
export const MAX_VALIDATION_DEPTH = 32

/**
 * ValidationContext — threaded through every element validator.
 *
 * Replaces the free-floating module-level closures that previously lived
 * inside validate()'s function body. Created once at the top of validate()
 * so concurrent validate() calls on a multi-document server cannot share
 * state (see withCycleGuard docblock for the race-condition rationale).
 */
export interface ValidationContext {
  /** Strict-mode accumulator for unknown-property errors */
  errors: string[]
  /** Whether strict validation is active for this call */
  strict: boolean
  /** Loaded font families (bundled + doc.fonts), used by element validators */
  loadedFamilies: Set<string>
  /** Per-call cycle-detection set — MUST NOT be shared across validate() calls */
  seen: WeakSet<object>
  /** Original RenderOptions, used for plugin lookups in the default switch arm */
  options?: RenderOptions | undefined
}

/**
 * Cycle/depth guard for recursive validation.
 *
 * The `seen` WeakSet MUST be created per top-level validate() call and threaded
 * through the recursion. A module-scoped WeakSet would race under concurrent
 * validate() calls on a multi-document server: two parallel calls touching the
 * same node reference would see each other's "in progress" mark and throw a
 * false-positive cyclic-reference error.
 */
export function withCycleGuard<T extends object>(
  seen: WeakSet<object>,
  node: T,
  depth: number,
  path: string,
  fn: () => void,
): void {
  if (depth > MAX_VALIDATION_DEPTH) {
    throw new PretextPdfError('VALIDATION_ERROR', `${path}: nesting depth exceeds ${MAX_VALIDATION_DEPTH}`)
  }
  if (seen.has(node)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${path}: cyclic reference detected`)
  }
  seen.add(node)
  try { fn() } finally { seen.delete(node) }
}

/**
 * Lightweight depth-only check used at the top of validateElement so the
 * MAX_VALIDATION_DEPTH = 32 cap fires even when entering elements whose
 * recursive validator does not itself open a withCycleGuard scope (e.g. an
 * unrecognised plugin element). The full cycle/depth guard is still applied
 * by the inner withCycleGuard calls for container elements.
 */
export function assertDepthOk(depth: number, path: string): void {
  if (depth > MAX_VALIDATION_DEPTH) {
    throw new PretextPdfError('VALIDATION_ERROR', `${path}: nesting depth exceeds ${MAX_VALIDATION_DEPTH}`)
  }
}

/**
 * RTL strong bidi characters — Bidi_Class=R or AL per UAX #9.
 * See src/validate.ts (pre-split) for full block list. Range preserved bit-exact.
 */
export const RTL_REGEX = /[֐-ࣿיִ-ﭏﭐ-﷿ﹰ-﻿\u{10800}-\u{10CFF}\u{10D00}-\u{10D3F}\u{10E80}-\u{10EFF}\u{10F30}-\u{10FFF}\u{1E800}-\u{1E95F}\u{1EC70}-\u{1ECBF}\u{1EE00}-\u{1EEFF}]/u

/** Valid 6-digit hex color */
export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/

/** Allowed URL schemes for hyperlinks — blocks javascript:, data:, vbscript: */
export const SAFE_URL_SCHEME = /^(https?|mailto|ftp|#)/i

/** BCP47 language tag pattern for hyphenation.language — prevents dynamic-import path injection */
export const LANGUAGE_TAG_REGEX = /^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{2,8})*$/

/** Valid column width: positive number OR '2*', '*', '1.5*' format */
export const STAR_WIDTH_REGEX = /^(\d*\.?\d+)?\*$/

/** Families always available without explicit doc.fonts entry */
export const BUNDLED_FAMILIES = new Set(['Inter'])

/** Font variants (family-weight-style) always available without explicit doc.fonts entry */
export const BUNDLED_VARIANTS = new Set(['Inter-400-normal', 'Inter-700-normal', 'Inter-400-italic', 'Inter-700-italic'])

/** Levenshtein distance, returns 999 if result would exceed 2 */
function levenshteinDist(a: string, b: string): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 2) return 999
  const m = a.length
  const n = b.length
  const prev = Array(n + 1)
    .fill(0)
    .map((_, j) => j)
  const curr = Array(n + 1).fill(0)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost)
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]
  }
  return prev[n]! > 2 ? 999 : prev[n]!
}

/** Find closest match with edit distance <= 2 */
function closestMatch(prop: string, allowed: Iterable<string>): string | null {
  let best: string | null = null
  let bestDist = 999
  for (const candidate of allowed) {
    const d = levenshteinDist(prop, candidate)
    if (d > 0 && d <= 2 && d < bestDist) {
      best = candidate
      bestDist = d
    }
  }
  return best
}

/** Accumulate unknown property errors for an object */
export function assertUnknownProps(
  obj: unknown,
  allowed: Set<string>,
  path: string,
  errors: string[]
): void {
  // Type guard first — narrows `obj` to a non-null object below.
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (!allowed.has(key)) {
      const suggestion = closestMatch(key, allowed)
      const hint = suggestion ? `; did you mean "${suggestion}"` : ''
      errors.push(`${path}.${key}: unknown property${hint}`)
    }
  }
}

/** Format accumulated errors into a single message (cap at 20 errors) */
export function formatErrors(errors: string[]): string {
  if (errors.length === 0) return ''
  const header = `Strict validation failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):\n`
  const msgs = errors.slice(0, 20)
  const suffix = errors.length > 20 ? `\n... and ${errors.length - 20} more error(s)` : ''
  return header + msgs.join('\n') + suffix
}

// URL-shaped detection used by validators that accept either a file path
// or a remote URL (image src, watermark image). Matches the runtime SSRF
// guard's posture so validate-only callers catch unsafe schemes pre-render.
const URL_LIKE_PREFIXES = ['data:', 'javascript:', 'vbscript:', 'blob:', 'about:', 'file:']

/** Returns true if the string looks like a URL (scheme://... or a known scheme prefix) */
export function looksLikeUrl(src: string): boolean {
  const lc = src.toLowerCase()
  if (URL_LIKE_PREFIXES.some(p => lc.startsWith(p))) return true
  // Generic scheme test: any `scheme://...` form (http, https, ftp, gopher, …)
  return /^[a-z][a-z0-9+.-]*:\/\//.test(lc)
}

/** Validate a hyperlink URL — throws VALIDATION_ERROR for unsafe schemes */
export function validateUrl(url: string, prefix: string): void {
  if (!SAFE_URL_SCHEME.test(url)) {
    throw new PretextPdfError(
      'VALIDATION_ERROR',
      `${prefix}: URL scheme not allowed — only http, https, mailto, ftp, and anchor (#) links are permitted. Got: "${url.slice(0, 60)}"`
    )
  }
}

/** Validate a metadata string field — rejects control chars and enforces length */
export function validateMetadataString(value: string, fieldName: string): void {
  if (value.length > 1000) {
    throw new PretextPdfError('VALIDATION_ERROR', `metadata.${fieldName} must not exceed 1000 characters`)
  }
  if (/[\x00\r\n]/.test(value)) {
    throw new PretextPdfError('VALIDATION_ERROR', `metadata.${fieldName} must not contain null bytes or newline characters`)
  }
}

/** Validate a single FontSpec entry from doc.fonts */
export function validateFontSpec(font: FontSpec): void {
  if (!font.family || typeof font.family !== 'string') {
    throw new PretextPdfError('VALIDATION_ERROR', `FontSpec: 'family' must be a non-empty string`)
  }
  if (font.weight !== undefined && ![400, 700].includes(font.weight)) {
    throw new PretextPdfError('VALIDATION_ERROR', `FontSpec '${font.family}': 'weight' must be 400 or 700`)
  }
  if (font.style !== undefined && !['normal', 'italic'].includes(font.style)) {
    throw new PretextPdfError('VALIDATION_ERROR', `FontSpec '${font.family}': 'style' must be 'normal' or 'italic'`)
  }
  if (font.src === undefined || font.src === null) {
    throw new PretextPdfError('VALIDATION_ERROR', `FontSpec '${font.family}': 'src' is required (file path or Uint8Array)`)
  }
  // If src is a string, ensure it's not a dangerous URL — only 'bundled' or file paths allowed
  if (typeof font.src === 'string' && font.src !== 'bundled') {
    try {
      const parsed = new URL(font.src)
      throw new PretextPdfError('VALIDATION_ERROR', `FontSpec '${font.family}': 'src' contains a URL (${parsed.protocol}) — use 'bundled', a file path, or Uint8Array instead`)
    } catch (err) {
      // new URL() throws if string is not a valid URL, which is expected for file paths
      if (err instanceof PretextPdfError) throw err
    }
  }
}

// Re-exported for submodule convenience.
export type { RenderOptions }
