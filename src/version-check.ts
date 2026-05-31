/**
 * Boot-time vendor integrity check.
 *
 * The library ships a vendored snapshot of @chenglou/pretext under
 * `src/vendor/pretext/`. If someone hand-edits that directory and forgets to
 * update `VERSION.ts`, the snapshot identifier will drift out of the range
 * this codebase was tested against. We emit a one-shot advisory warning so
 * the operator can investigate, but we DO NOT throw — the vendored code is
 * in-tree, so a hard failure would brick the library for an end user who is
 * unable to fix it.
 */
import type { Logger } from './types-public/index.js'
import { VENDORED_PRETEXT_VERSION } from './vendor/pretext/VERSION.js'

/**
 * Range the current pretext-pdf release is known-compatible with.
 *
 * Format: `MAJOR.MINOR.PATCH-LABEL.x` — the `.x` wildcard matches any
 * pre-release patch increment (e.g. `0.0.7-patched.1`, `0.0.7-patched.2`, …)
 * but NOT a different base version (`0.0.8-patched.0`) or a different label
 * (`0.0.7-rc.2`). Bump this string when re-vendoring.
 */
export const COMPATIBLE_RANGE = '0.0.7-patched.x'

/** Module-level idempotency guard — warn at most once per process. */
let _checked = false

/**
 * Inline semver-ish matcher.
 *
 * Matches a concrete version like `MAJOR.MINOR.PATCH-LABEL.N` against a
 * pattern like `MAJOR.MINOR.PATCH-LABEL.x`. The `.x` segment is the only
 * supported wildcard and matches any single segment (digits or label).
 *
 * Implemented inline so we don't drag in the full `semver` package just to
 * compare two known-shaped strings.
 */
export function matchesRange(version: string, range: string): boolean {
  // Split on `.` and `-` boundaries so each delimiter is preserved as its own
  // token. That keeps the comparison structural: `0.0.6-patched.2` becomes
  // [`0`,`.`,`0`,`.`,`6`,`-`,`patched`,`.`,`2`] and a single `.x` in the range
  // lines up with a single token in the version.
  const tokenize = (s: string): string[] => s.split(/([.\-])/).filter((t) => t.length > 0)
  const vTokens = tokenize(version)
  const rTokens = tokenize(range)
  if (vTokens.length !== rTokens.length) return false
  for (let i = 0; i < rTokens.length; i++) {
    const r = rTokens[i]
    const v = vTokens[i]
    if (r === 'x') continue // wildcard — accept any value at this position
    if (r !== v) return false
  }
  return true
}

/**
 * Verify the vendored pretext snapshot identifier falls inside the range this
 * pretext-pdf release was tested against. Idempotent: warns at most once per
 * process. Safe to call on every `render()` invocation.
 *
 * @param logger - Optional structured logger. Falls back to `console.warn`.
 */
export function assertVendorIntegrity(logger?: Logger): void {
  if (_checked) return
  _checked = true
  if (matchesRange(VENDORED_PRETEXT_VERSION, COMPATIBLE_RANGE)) return
  const msg =
    `[pretext-pdf] vendored pretext version "${VENDORED_PRETEXT_VERSION}" is outside ` +
    `the compatible range "${COMPATIBLE_RANGE}". src/vendor/pretext/ may have been ` +
    `manually edited or re-vendored without updating VERSION.ts. Proceeding anyway.`
  if (logger) {
    logger.warn(msg)
  } else {
    // eslint-disable-next-line no-console
    console.warn(msg)
  }
}

/**
 * Test-only hook. Resets the idempotency guard so unit tests can exercise the
 * one-warning-per-process behaviour deterministically. Not exported from the
 * package entrypoint.
 */
export function _resetVendorIntegrityCheckForTests(): void {
  _checked = false
}
