/**
 * Internal barrel for the assets module — created in v1.6.0 commit 15/16.
 *
 * Aggregates every public symbol that was previously exported from
 * src/assets.ts. src/assets.ts now re-exports this barrel as a one-line
 * back-compat shim so the compiled dist/assets.js retains the same
 * surface (fonts.ts, post-process.ts, pipeline.ts, plus direct test
 * imports for security-ssrf, security-ipv4-bypass, assets-dns-dedup,
 * svg-sanitizer all keep working unchanged).
 */
export { redactPath } from './util/redact-path.js'
export { assertPathAllowed } from './security/path-allowlist.js'
export { normalizeIpv4Hostname } from './security/ipv4-normalize.js'
export {
  resolveAndValidateUrl,
  assertSafeUrl,
  type ResolvedSafeUrl,
} from './security/url-validation.js'
export { fetchWithTimeout } from './security/fetch.js'
export { sanitizeSvg } from './svg/sanitize.js'
export { VECTOR_RASTER_CONCURRENCY } from './loaders/vectors.js'
export { loadImages } from './loaders/orchestrator.js'
