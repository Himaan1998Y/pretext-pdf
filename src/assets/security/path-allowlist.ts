import { PretextPdfError } from '../../errors.js'

/**
 * Enforce allowedFileDirs: resolved absolute path must start with an allowed dir.
 * Deny-by-default: when allowedFileDirs is undefined or empty, file:// access is
 * rejected unless the caller explicitly configures the allowed directories.
 *
 * Extracted from `src/assets.ts` in v1.6.0 commit 5/16 as part of the
 * post-v1.5.2 assets.ts file-size sprint. The original module re-exports
 * this symbol for back-compat with production consumers (fonts.ts,
 * post-process.ts) and the public API surface.
 */
export function assertPathAllowed(
  resolvedPath: string,
  allowedDirs: string[] | undefined,
  label: string,
): void {
  if (!allowedDirs || allowedDirs.length === 0) {
    throw new PretextPdfError(
      'PATH_TRAVERSAL',
      `${label} src uses a local file path but doc.allowedFileDirs is not set. ` +
        `Configure allowedFileDirs to explicitly list the directories from which files may be read.`,
    )
  }
  const norm = resolvedPath.replace(/\\/g, '/')
  const allowed = allowedDirs.some((dir) => {
    const d = dir.replace(/\\/g, '/').replace(/\/$/, '')
    return norm === d || norm.startsWith(d + '/')
  })
  if (!allowed) {
    throw new PretextPdfError(
      'PATH_TRAVERSAL',
      `${label} src is outside allowedFileDirs. Configure doc.allowedFileDirs to include the file's directory.`,
    )
  }
}
