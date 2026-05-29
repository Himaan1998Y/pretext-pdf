/**
 * SVG content resolver — extracted from src/assets.ts in v1.6.0 commit 10/16.
 *
 * Resolves an SvgElement's content string from either the inline `svg` field
 * or a `src` file/URL. All loaded content is sanitized before return.
 *
 * Dynamic imports of `fs`/`path` are preserved so cold-start cost stays the
 * same as the pre-split assets.ts.
 */
import type { SvgElement } from '../../types.js'
import { PretextPdfError } from '../../errors.js'
import { redactPath } from '../util/redact-path.js'
import { assertPathAllowed } from '../security/path-allowlist.js'
import { fetchWithTimeout } from '../security/fetch.js'
import { sanitizeSvg } from './sanitize.js'

/**
 * Resolve SVG content string from either an inline `svg` field or a `src` file/URL.
 * Throws PretextPdfError if neither is provided or the source cannot be loaded.
 */
export async function resolveSvgContent(el: SvgElement, allowedFileDirs?: string[]): Promise<string> {
  if (el.svg) return sanitizeSvg(el.svg)

  if (!el.src) {
    throw new PretextPdfError('SVG_LOAD_FAILED', "SvgElement requires either 'svg' (inline string) or 'src' (file path or https:// URL)")
  }

  if (el.src.startsWith('http://')) {
    throw new PretextPdfError('SVG_LOAD_FAILED', 'SVG HTTP URLs are not allowed — use HTTPS')
  }
  if (el.src.startsWith('https://')) {
    // SSRF validation happens inside fetchWithTimeout — no need to pre-validate
    let resp: Response
    try {
      resp = await fetchWithTimeout(el.src, 'SVG_LOAD_FAILED', 'SVG')
    } catch (err) {
      throw new PretextPdfError('SVG_LOAD_FAILED', `SVG URL fetch failed: ${err instanceof Error ? err.message : String(err)}`)
    }
    if (!resp.ok) {
      throw new PretextPdfError('SVG_LOAD_FAILED', `SVG URL returned HTTP ${resp.status}`)
    }
    return sanitizeSvg(await resp.text())
  }

  const [fs, pathMod] = await Promise.all([import('fs'), import('path')])
  const filePath = pathMod.resolve(el.src)
  assertPathAllowed(filePath, allowedFileDirs, 'SVG')
  if (!fs.existsSync(filePath)) {
    throw new PretextPdfError('SVG_LOAD_FAILED', `SVG file not found: "${redactPath(el.src)}"`)
  }
  return sanitizeSvg(fs.readFileSync(filePath, 'utf-8'))
}
