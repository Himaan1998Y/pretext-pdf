/**
 * url-utils.ts — Shared URL validation primitives
 *
 * This is a leaf module (no pretext-pdf imports) so it can be imported by
 * both the render path (render-utils.ts) and the validate path (validate/helpers.ts)
 * without creating a wrong-direction dependency.
 *
 * Previously SAFE_URL_SCHEME was duplicated in both sites. Consolidated here in v1.8.
 */

/** Allowed URL schemes for hyperlinks — blocks javascript:, data:, vbscript: */
export const SAFE_URL_SCHEME = /^(https?|mailto|ftp|#)/i
