// Source of truth: F:\Antigravity\brain\projects\pretext-pdf\UPSTREAM.md
//
// These constants identify the vendored snapshot of @chenglou/pretext that
// lives under `src/vendor/pretext/`. They are consumed by `src/version-check.ts`
// at render time to detect manual edits / accidental drift.
//
// When you re-vendor from upstream, update BOTH fields here and the matching
// row in UPSTREAM.md. The boot-time check compares VENDORED_PRETEXT_VERSION
// against COMPATIBLE_RANGE in `src/version-check.ts`.
export const VENDORED_PRETEXT_VERSION = '0.0.6-patched.2'
export const VENDORED_PRETEXT_COMMIT = '658edfec'
