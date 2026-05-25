/**
 * Return just the filename from a path. Used in error messages to avoid
 * leaking absolute directory structure to untrusted output sinks (logs,
 * PretextPdfError.message strings).
 *
 * Behavior: take the last `/` or `\` separated segment. Returns the literal
 * string `(file)` when the input has no useful trailing segment.
 *
 * Extracted from `src/assets.ts` in v1.6.0 commit 4/16 as part of the
 * post-v1.5.2 assets.ts file-size sprint. Pure function — no module-level
 * side effects.
 */
export function redactPath(src: string): string {
  return src.replace(/\\/g, '/').split('/').pop() ?? '(file)'
}
