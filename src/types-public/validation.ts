/**
 * pretext-pdf — Validation and logging public types.
 */
import type { ErrorCode } from '../errors.js'

// ─── Validation API ───────────────────────────────────────────────────────────

/**
 * A single validation issue returned by {@link validateDocument}.
 * @public
 */
export interface ValidationError {
  /** JSONPath-style location — e.g. "doc.pageSize" or "doc.content[3].color" */
  readonly path: string
  /** Human-readable description of the issue */
  readonly message: string
  /** The unknown property name, when code is UNKNOWN_PROPERTY */
  readonly unknownProp?: string
  /** Levenshtein-nearest valid property name, when available */
  readonly suggestion?: string
  /** Severity of the issue */
  readonly severity: 'error' | 'warning'
  /** Machine-readable error code */
  readonly code: ErrorCode
}

/**
 * Return value of {@link validateDocument}.
 * @public
 */
export interface ValidationResult {
  /** True when the document passed validation with zero errors */
  readonly valid: boolean
  /** All validation errors found (empty when valid is true) */
  readonly errors: readonly ValidationError[]
  /** Total number of validation issues. May exceed errors.length when errors are capped at 20. */
  readonly errorCount: number
}

// ─── Logger ───────────────────────────────────────────────────────────────────

/**
 * Optional logger interface for routing pretext-pdf diagnostic messages.
 *
 * @remarks
 * Diagnostic messages include asset-loading failures (image, font, QR,
 * barcode, chart, plugin), validation advisories, and rendering warnings
 * (form-field clashes, watermark fallbacks, etc.). They are advisory — the
 * render still completes — but most of them indicate a real problem with
 * input or environment.
 *
 * **Behavior:**
 * - If `logger` is omitted on {@link RenderOptions}, diagnostics route to
 *   `console.warn` with sensible defaults.
 * - Passing a no-op (`{ warn: () => {} }`) silences **every** advisory
 *   warning. This is convenient for tests but **dangerous in production** —
 *   you lose visibility into broken images, missing fonts, and other
 *   recoverable failures that you almost certainly want to know about.
 * - For production, prefer a structured logger such as
 *   [pino](https://github.com/pinojs/pino) or
 *   [winston](https://github.com/winstonjs/winston) and adapt it to the
 *   single-method shape — e.g. `{ warn: pino().warn.bind(pino()) }`.
 *
 * @public
 */
export interface Logger {
  warn(message: string, ...args: unknown[]): void
}
