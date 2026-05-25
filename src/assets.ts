/**
 * Back-compat shim — v1.6.0 commit 15/16.
 *
 * The assets module was split into src/assets/ during the v1.6.0 sprint
 * (commits 4–15). Everything still flows through dist/assets.js so that
 * internal consumers (fonts.ts, pipeline.ts, post-process.ts) and direct
 * test imports (security-ssrf, security-ipv4-bypass, assets-dns-dedup,
 * svg-sanitizer, public-api-surface) keep working unchanged.
 *
 * Public API contract is enforced by api-extractor (etc/pretext-pdf.api.md);
 * the snapshot tripwire (test/assets-split-tripwire.test.ts) plus the
 * six other G-gates pin the runtime contract.
 */
export * from './assets/index.js'
