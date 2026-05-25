import { PDFDocument } from '@cantoo/pdf-lib'
import type { PdfDocument, ImageElement, Logger } from './types.js'
import type { ImageMap } from './types-internal.js'
import { PretextPdfError } from './errors.js'
import type { PluginDefinition } from './plugin-types.js'
import { findPlugin, runPluginLoadAsset } from './plugin-registry.js'
import { redactPath } from './assets/util/redact-path.js'
import { assertPathAllowed } from './assets/security/path-allowlist.js'
import { normalizeIpv4Hostname } from './assets/security/ipv4-normalize.js'
import {
  resolveAndValidateUrl,
  assertSafeUrl,
  type ResolvedSafeUrl,
} from './assets/security/url-validation.js'
import { fetchWithTimeout } from './assets/security/fetch.js'
import { sanitizeSvg } from './assets/svg/sanitize.js'
import { loadImageBytes, resolveImageFormat } from './assets/loaders/images.js'
import { loadVectorAssets } from './assets/loaders/vectors.js'

// v1.6.0 commit 4/16: redactPath extracted to assets/util/redact-path.ts.
// v1.6.0 commit 5/16: assertPathAllowed extracted to assets/security/path-allowlist.ts.
// v1.6.0 commit 6/16: normalizeIpv4Hostname extracted to assets/security/ipv4-normalize.ts.
// v1.6.0 commit 7/16: URL validation (resolveAndValidateUrl, assertSafeUrl,
//   ResolvedSafeUrl, plus private isPrivateAddress) extracted to
//   assets/security/url-validation.ts.
// v1.6.0 commit 8/16: fetchWithTimeout + private createPinnedAgent extracted
//   to assets/security/fetch.ts. (HIGH-RISK: undici Agent stays lazy — no
//   module-level allocation in either old or new home.) The undici import
//   moved with it.
// v1.6.0 commit 9/16: sanitizeSvg + SVG_MAX_BYTES constant extracted to
//   assets/svg/sanitize.ts. Re-exported here so svg-sanitizer.test.ts and
//   the assets-split-tripwire keep working via dist/assets.js.
// v1.6.0 commit 10/16: parseSvgViewBox + parseSvgAttributes + resolveSvgDimensions
//   moved to assets/svg/dimensions.ts. resolveSvgContent moved to
//   assets/svg/resolve-content.ts. All callers are inside this module.
// v1.6.0 commit 11/16: rasterizeSvgToPng moved to assets/svg/rasterize.ts.
//   The @napi-rs/canvas dynamic import moved with it; lazy-load is preserved.
// v1.6.0 commit 12/16: generateQrSvg, generateBarcodeSvg, generateChartSvg
//   moved to assets/generators/{qr,barcode,chart}.ts. Optional peer-dep
//   dynamic imports (qrcode, bwip-js, vega, vega-lite) moved with them.
// v1.6.0 commit 13/16: loadImageBytes + resolveImageFormat moved to
//   assets/loaders/images.ts. loadImages() orchestrator stays here for now.
// v1.6.0 commit 14/16: loadVectorAssets + allSettledWithLimit +
//   VECTOR_RASTER_CONCURRENCY moved to assets/loaders/vectors.ts. All
//   SVG/QR/barcode/chart task wiring lives there now.
// Re-exported here so existing consumers (fonts.ts, post-process.ts, the
// public API surface, and direct test imports from `dist/assets.js`
// — security-ssrf, security-ipv4-bypass, assets-dns-dedup, svg-sanitizer)
// keep working unchanged.
export { redactPath, assertPathAllowed, normalizeIpv4Hostname }
export { resolveAndValidateUrl, assertSafeUrl, fetchWithTimeout }
export { sanitizeSvg }
export type { ResolvedSafeUrl }

// Re-export VECTOR_RASTER_CONCURRENCY from new location to keep the public
// constant addressable via dist/assets.js for back-compat.
export { VECTOR_RASTER_CONCURRENCY } from './assets/loaders/vectors.js'

/**
 * Stage 2b: Load and embed all images into pdfDoc.
 * Runs after loadFonts(), receives the same pdfDoc.
 *
 * Image keys are 'img-N' where N is the element's position in doc.content.
 * This makes keys stable and avoids collisions from duplicate src paths.
 *
 * IMPORTANT: @cantoo/pdf-lib image embedding is NOT thread-safe.
 * We load bytes in parallel but embed sequentially.
 *
 * Images that fail to load (network error, file not found, unreachable URL) are
 * logged as warnings but do not crash the document — the document renders without that image.
 */
export async function loadImages(doc: PdfDocument, pdfDoc: PDFDocument, contentWidth: number, plugins?: PluginDefinition[], logger?: Logger): Promise<ImageMap> {
  const warn = logger ? logger.warn.bind(logger) : console.warn.bind(console)
  const imageMap: ImageMap = new Map()
  const allowedDirs = doc.allowedFileDirs

  // Collect all ImageElement entries with their content index for stable keys
  const imageEntries: Array<{ el: ImageElement; key: string }> = []
  for (let i = 0; i < doc.content.length; i++) {
    const el = doc.content[i]!
    if (el.type === 'image') {
      imageEntries.push({ el, key: `img-${i}` })
    } else if (el.type === 'float-group') {
      const fgImage: ImageElement = {
        type: 'image',
        src: el.image.src,
        ...(el.image.format !== undefined ? { format: el.image.format } : {}),
        ...(el.image.height !== undefined ? { height: el.image.height } : {}),
        align: 'left',
        spaceAfter: 0,
        spaceBefore: 0,
      }
      imageEntries.push({ el: fgImage, key: `float-group-${i}` })
    }
  }

  // Load all image bytes in parallel; capture both successes and failures
  const loadResults = imageEntries.length > 0
    ? await Promise.allSettled(
        imageEntries.map(async ({ el, key }) => {
          const bytes = await loadImageBytes(el, key, allowedDirs)
          return { el, key, bytes }
        })
      )
    : []

  // Process results: embed successful images, warn on failures
  for (let ri = 0; ri < loadResults.length; ri++) {
    const result = loadResults[ri]!
    const entry = imageEntries[ri]!

    if (result.status === 'rejected') {
      const err = result.reason instanceof Error ? result.reason : new Error(String(result.reason))
      const action = doc.onImageLoadError ? doc.onImageLoadError(entry.el.src, err) : 'skip'
      if (action === 'throw') throw err
      warn(`[pretext-pdf] Image load skipped: ${err.message}`)
      continue
    }

    const { el, key, bytes } = result.value
    const resolvedFormat = resolveImageFormat(el, bytes, key)
    try {
      const pdfImage = resolvedFormat === 'png'
        ? await pdfDoc.embedPng(bytes)
        : await pdfDoc.embedJpg(bytes)
      imageMap.set(key, pdfImage)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      const action = doc.onImageLoadError ? doc.onImageLoadError(entry.el.src, error) : 'skip'
      if (action === 'throw') throw error
      warn(`[pretext-pdf] Image embed failed: key "${key}" (format: '${resolvedFormat}')`)
      // Continue without this image rather than crashing
    }
  }

  await loadVectorAssets(doc, pdfDoc, imageMap, contentWidth, allowedDirs, warn)

  // Load plugin assets
  if (plugins && plugins.length > 0) {
    for (let i = 0; i < doc.content.length; i++) {
      const el = doc.content[i]!
      const plugin = findPlugin(plugins, el.type)
      if (!plugin) continue
      try {
        const assetResult = await runPluginLoadAsset(plugin, el as unknown as Record<string, unknown>, pdfDoc, contentWidth, i)
        if (assetResult) {
          imageMap.set(assetResult.key, assetResult.image)
        }
      } catch (err) {
        if (err instanceof PretextPdfError) throw err
        warn(`[pretext-pdf] Plugin '${plugin.type}' loadAsset failed at index ${i}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  // Load watermark image if provided
  if (doc.watermark?.image) {
    const src = doc.watermark.image
    try {
      let bytes: Uint8Array
      if (src instanceof Uint8Array) {
        bytes = src
      } else {
        const [fs, pathMod] = await Promise.all([import('fs'), import('path')])
        const filePath = pathMod.resolve(src as string)
        assertPathAllowed(filePath, allowedDirs, 'watermark image')
        if (!fs.existsSync(filePath)) throw new Error(`Watermark image not found`)
        bytes = new Uint8Array(fs.readFileSync(filePath))
      }
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
      const pdfImage = isPng
        ? await pdfDoc.embedPng(bytes)
        : await pdfDoc.embedJpg(bytes)
      imageMap.set('watermark', pdfImage)
    } catch (err) {
      if (err instanceof PretextPdfError && err.code === 'PATH_TRAVERSAL') throw err
      warn(`[pretext-pdf] Watermark image skipped: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return imageMap
}

