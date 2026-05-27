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
  path: string
  /** Human-readable description of the issue */
  message: string
  /** The unknown property name, when code is UNKNOWN_PROPERTY */
  unknownProp?: string
  /** Levenshtein-nearest valid property name, when available */
  suggestion?: string
  /** Severity of the issue */
  severity: 'error' | 'warning'
  /** Machine-readable error code */
  code: ErrorCode
}

/**
 * Return value of {@link validateDocument}.
 * @public
 */
export interface ValidationResult {
  /** True when the document passed validation with zero errors */
  valid: boolean
  /** All validation errors found (empty when valid is true) */
  errors: ValidationError[]
  /** Total number of validation issues. May exceed errors.length when errors are capped at 20. */
  errorCount: number
  /**
   * Warning-severity issue count. Always 0 in v1.x — the validator currently emits errors only.
   * @deprecated Will be removed in v2.0. Use `errors.filter(e => e.severity === 'warning').length`
   *   directly when warning-severity items are introduced.
   */
  warningCount: number
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
