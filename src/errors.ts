/** Error codes for PretextPdfError */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'FONT_LOAD_FAILED'
  | 'FONT_EMBED_FAILED'
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

export class PretextPdfError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.name = 'PretextPdfError'
    this.code = code
    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PretextPdfError)
    }
  }
}
