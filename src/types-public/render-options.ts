/**
 * pretext-pdf — Top-level render options public type.
 */
import type { Logger } from './validation.js'

// ─── Render options ───────────────────────────────────────────────────────────

/** @public */
export type RenderOptions = {
  /** Enable strict validation: reject unknown properties on elements and sub-structures */
  strict?: boolean
  /**
   * Plugin definitions for custom element types.
   * Each plugin handles one `type` string across all 4 pipeline stages.
   */
  plugins?: import('../plugin-types.js').PluginDefinition[]
  /**
   * Optional logger for diagnostic messages. When provided, advisory warnings
   * from validation, asset loading (images, QR, barcodes, charts, plugins,
   * watermarks), and rendering (form fields) are routed through `logger.warn`
   * instead of `console.warn`.
   *
   * @remarks
   * **Silencing warnings is dangerous.** Passing `{ warn: () => {} }` (or any
   * no-op) suppresses every advisory warning. That includes silent failures
   * for broken images, missing fonts, and unreachable URLs — the document
   * still renders, but the output may be incomplete. Prefer a structured
   * logger (pino, winston, etc.) in production so warnings remain searchable
   * and alertable.
   *
   * Bidi-js fallback warnings from RTL reordering are routed through this
   * logger (since v1.3.x). They fire only when bidi-js itself errors on
   * an input sequence and the internal `setBidiWarnFn` shim is active.
   *
   * See {@link Logger} for the interface contract.
   */
  logger?: Logger
}
