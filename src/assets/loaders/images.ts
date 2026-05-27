/**
 * Image loaders — extracted from src/assets.ts in v1.6.0 commit 13/16.
 *
 * Two pieces:
 * - loadImageBytes(): fetch/read raw bytes from URL, file path, or Uint8Array.
 *   Used by the loadImages() orchestrator (src/assets/loaders/orchestrator.ts).
 * - resolveImageFormat(): pick 'png' vs 'jpg' from the element spec, magic
 *   bytes, or file extension. Pure compute.
 *
 * Dynamic fs/path imports preserved.
 */
import type { ImageElement } from '../../types.js'
import { PretextPdfError } from '../../errors.js'
import { redactPath } from '../util/redact-path.js'
import { assertPathAllowed } from '../security/path-allowlist.js'
import { fetchWithTimeout } from '../security/fetch.js'

/**
 * Resolve the image format from the element spec, magic bytes, or file extension.
 * Priority: explicit 'png'/'jpg' → magic bytes → file extension → error.
 */
export function resolveImageFormat(el: ImageElement, bytes: Uint8Array, key: string): 'png' | 'jpg' {
  if (el.format === 'png') return 'png'
  if (el.format === 'jpg') return 'jpg'

  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'png'
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'jpg'

  if (typeof el.src === 'string') {
    const ext = el.src.toLowerCase().split('.').pop()
    if (ext === 'png') return 'png'
    if (ext === 'jpg' || ext === 'jpeg') return 'jpg'
  }

  throw new PretextPdfError(
    'IMAGE_FORMAT_MISMATCH',
    `Image "${key}": format could not be auto-detected. Specify format: 'png' or 'jpg' explicitly.`
  )
}

/** Load image bytes from a URL, file path, or Uint8Array */
export async function loadImageBytes(el: ImageElement, key: string, allowedDirs?: string[]): Promise<Uint8Array> {
  if (el.src instanceof Uint8Array) {
    return el.src
  }

  const src = el.src

  if (!src || typeof src !== 'string') {
    throw new PretextPdfError('IMAGE_LOAD_FAILED', `Image "${key}": 'src' must be a non-empty string path, URL, or Uint8Array`)
  }

  if (src.startsWith('https://') || src.startsWith('http://')) {
    // SSRF validation happens inside fetchWithTimeout — no need to pre-validate
    let resp: Response
    try {
      resp = await fetchWithTimeout(src, 'IMAGE_LOAD_FAILED', `Image "${key}"`)
    } catch (err) {
      throw new PretextPdfError(
        'IMAGE_LOAD_FAILED',
        `Image "${key}": failed to fetch URL: ${err instanceof Error ? err.message : String(err)}`
      )
    }
    if (!resp.ok) {
      throw new PretextPdfError('IMAGE_LOAD_FAILED', `Image "${key}": URL returned HTTP ${resp.status}`)
    }
    try {
      return new Uint8Array(await resp.arrayBuffer())
    } catch (err) {
      throw new PretextPdfError(
        'IMAGE_LOAD_FAILED',
        `Image "${key}": failed to read response body: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  const fs = await import('fs')
  const pathMod = await import('path')
  const filePath = pathMod.resolve(src)
  assertPathAllowed(filePath, allowedDirs, `Image "${key}"`)

  if (!fs.existsSync(filePath)) {
    throw new PretextPdfError(
      'IMAGE_LOAD_FAILED',
      `Image "${key}": file not found — "${redactPath(src)}". Check the path in the image element's 'src' field.`
    )
  }

  try {
    return new Uint8Array(fs.readFileSync(filePath))
  } catch (err) {
    throw new PretextPdfError(
      'IMAGE_LOAD_FAILED',
      `Image "${key}": failed to read file "${redactPath(src)}": ${err instanceof Error ? err.message : String(err)}`
    )
  }
}
