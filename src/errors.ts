/**
 * Error codes for PretextPdfError.
 * @public
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'FONT_LOAD_FAILED'
  | 'FONT_EMBED_FAILED'
  | 'FONT_ENCODE_FAIL'
  | 'PAGE_TOO_SMALL'
  | 'CANVAS_UNAVAILABLE'
  | 'PAGE_LIMIT_EXCEEDED'
  | 'IMAGE_LOAD_FAILED'
  | 'IMAGE_FORMAT_MISMATCH'
  | 'IMAGE_TOO_TALL'
  | 'TABLE_COLUMN_OVERFLOW'
  | 'TABLE_COLUMN_TOO_NARROW'
  | 'MONOSPACE_FONT_REQUIRED'
  | 'ITALIC_FONT_NOT_LOADED'
  | 'FONT_NOT_LOADED'
  | 'COLUMN_WIDTH_TOO_NARROW'
  | 'COLSPAN_OVERFLOW'
  | 'UNSUPPORTED_LANGUAGE'
  | 'SVG_LOAD_FAILED'
  | 'SVG_RENDER_FAILED'
  | 'WATERMARK_ROTATION_OUT_OF_RANGE'
  | 'SVG_INVALID_MARKUP'
  | 'ASSEMBLY_EMPTY'
  | 'ASSEMBLY_FAILED'
  | 'FORM_FIELD_NAME_DUPLICATE'
  | 'FORM_FLATTEN_FAILED'
  | 'SIGNATURE_DEP_MISSING'
  | 'SIGNATURE_P12_LOAD_FAILED'
  | 'SIGNATURE_FAILED'
  | 'SIGNATURE_CERT_AND_ENCRYPTION'
  | 'FOOTNOTE_REF_ORPHANED'
  | 'FOOTNOTE_DEF_ORPHANED'
  | 'FOOTNOTE_DEF_DUPLICATE'
  | 'PAGINATION_FAILED'
  | 'RENDER_FAILED'
  | 'PATH_TRAVERSAL'
  | 'QR_DEP_MISSING'
  | 'QR_GENERATE_FAILED'
  | 'BARCODE_DEP_MISSING'
  | 'BARCODE_GENERATE_FAILED'
  | 'BARCODE_SYMBOLOGY_INVALID'
  | 'CHART_DEP_MISSING'
  | 'CHART_SPEC_INVALID'
  | 'CHART_RENDER_FAILED'
  | 'UNKNOWN_PROPERTY'
  | 'INVALID_INPUT'
  | 'MARKDOWN_DEP_MISSING'
  | 'RTL_REORDER_FAILED'
  | 'CHART_LOAD_FAILED'

/**
 * High-level category grouping for {@link ErrorCode} values.
 *
 * Lets callers branch on class of failure without exhaustive switches over
 * all 50+ codes. For example:
 *
 * ```ts
 * catch (err) {
 *   if (err instanceof PretextPdfError && err.category === 'dependency') {
 *     // optional peer dep missing — inform user to install it
 *   }
 * }
 * ```
 *
 * @public
 */
export type ErrorCategory =
  | 'validation'   // Input / schema problems
  | 'font'         // Font loading, embedding, encoding
  | 'image'        // Image / SVG / watermark loading or rendering
  | 'layout'       // Pagination, table geometry, column sizing
  | 'security'     // Path traversal, URL validation
  | 'dependency'   // Missing optional peer deps (QR, barcode, chart, markdown, signing)
  | 'signature'    // PDF signing failures
  | 'render'       // Assembly, form, footnote, pagination, general render failures

/** @internal */
const CODE_CATEGORY: Record<ErrorCode, ErrorCategory> = {
  VALIDATION_ERROR:               'validation',
  UNKNOWN_PROPERTY:               'validation',
  INVALID_INPUT:                  'validation',

  FONT_LOAD_FAILED:               'font',
  FONT_EMBED_FAILED:              'font',
  FONT_ENCODE_FAIL:               'font',
  FONT_NOT_LOADED:                'font',
  ITALIC_FONT_NOT_LOADED:         'font',
  MONOSPACE_FONT_REQUIRED:        'font',

  IMAGE_LOAD_FAILED:              'image',
  IMAGE_FORMAT_MISMATCH:          'image',
  IMAGE_TOO_TALL:                 'image',
  SVG_LOAD_FAILED:                'image',
  SVG_RENDER_FAILED:              'image',
  SVG_INVALID_MARKUP:             'image',
  WATERMARK_ROTATION_OUT_OF_RANGE:'image',
  CANVAS_UNAVAILABLE:             'image',

  PAGE_TOO_SMALL:                 'layout',
  PAGE_LIMIT_EXCEEDED:            'layout',
  TABLE_COLUMN_OVERFLOW:          'layout',
  TABLE_COLUMN_TOO_NARROW:        'layout',
  COLUMN_WIDTH_TOO_NARROW:        'layout',
  COLSPAN_OVERFLOW:               'layout',
  UNSUPPORTED_LANGUAGE:           'layout',

  PATH_TRAVERSAL:                 'security',

  QR_DEP_MISSING:                 'dependency',
  BARCODE_DEP_MISSING:            'dependency',
  CHART_DEP_MISSING:              'dependency',
  MARKDOWN_DEP_MISSING:           'dependency',
  SIGNATURE_DEP_MISSING:          'dependency',

  QR_GENERATE_FAILED:             'render',
  BARCODE_GENERATE_FAILED:        'render',
  BARCODE_SYMBOLOGY_INVALID:      'render',
  CHART_SPEC_INVALID:             'render',
  CHART_RENDER_FAILED:            'render',
  CHART_LOAD_FAILED:              'render',
  RTL_REORDER_FAILED:             'render',
  ASSEMBLY_EMPTY:                 'render',
  ASSEMBLY_FAILED:                'render',
  FORM_FIELD_NAME_DUPLICATE:      'render',
  FORM_FLATTEN_FAILED:            'render',
  FOOTNOTE_REF_ORPHANED:          'render',
  FOOTNOTE_DEF_ORPHANED:          'render',
  FOOTNOTE_DEF_DUPLICATE:         'render',
  PAGINATION_FAILED:              'render',
  RENDER_FAILED:                  'render',

  SIGNATURE_P12_LOAD_FAILED:      'signature',
  SIGNATURE_FAILED:               'signature',
  SIGNATURE_CERT_AND_ENCRYPTION:  'signature',
}

/**
 * Maps legacy / alternate error code spellings to their canonical {@link ErrorCode}.
 *
 * Consumers who switch on `.code` and have older code that predates a rename
 * can use this map as a migration reference. Keys are the old strings;
 * values are the current canonical codes.
 *
 * ```ts
 * import { LEGACY_ERROR_CODE_MAP } from 'pretext-pdf'
 * ```
 *
 * @public
 */
export const LEGACY_ERROR_CODE_MAP: Record<string, ErrorCode> = {
  // Historic spelling kept for reference — the canonical code has always been
  // FONT_ENCODE_FAIL (no rename has occurred yet, but future renames live here).
  FONT_ENCODE_FAIL: 'FONT_ENCODE_FAIL',
}

/**
 * Thrown by all pretext-pdf operations on failure.
 * @public
 */
export class PretextPdfError extends Error {
  readonly code: ErrorCode
  /**
   * High-level category grouping for this error code.
   * Useful for branching on class of failure without exhaustive switches.
   * See {@link ErrorCategory} for the full set of values.
   */
  readonly category: ErrorCategory

  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PretextPdfError'
    this.code = code
    this.category = CODE_CATEGORY[code]
    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PretextPdfError)
    }
  }
}
