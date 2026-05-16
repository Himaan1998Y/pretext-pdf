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
 * Thrown by all pretext-pdf operations on failure.
 * @public
 */
export class PretextPdfError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PretextPdfError'
    this.code = code
    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PretextPdfError)
    }
  }
}
