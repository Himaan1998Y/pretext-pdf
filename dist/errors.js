/**
 * Thrown by all pretext-pdf operations on failure.
 * @public
 */
export class PretextPdfError extends Error {
    code;
    constructor(code, message, options) {
        super(message, options);
        this.name = 'PretextPdfError';
        this.code = code;
        // Maintains proper stack trace in V8
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, PretextPdfError);
        }
    }
}
//# sourceMappingURL=errors.js.map