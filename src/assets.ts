import { PDFDocument } from '@cantoo/pdf-lib'
import type { PdfDocument, ImageElement, SvgElement, QrCodeElement, BarcodeElement, ChartElement, Logger } from './types.js'
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
import { resolveSvgDimensions } from './assets/svg/dimensions.js'
import { resolveSvgContent } from './assets/svg/resolve-content.js'

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
// Re-exported here so existing consumers (fonts.ts, post-process.ts, the
// public API surface, and direct test imports from `dist/assets.js`
// — security-ssrf, security-ipv4-bypass, assets-dns-dedup, svg-sanitizer)
// keep working unchanged.
export { redactPath, assertPathAllowed, normalizeIpv4Hostname }
export { resolveAndValidateUrl, assertSafeUrl, fetchWithTimeout }
export { sanitizeSvg }
export type { ResolvedSafeUrl }

// ─── QR Code generator ────────────────────────────────────────────────────────

async function generateQrSvg(el: QrCodeElement): Promise<string> {
  type QRCodeModule = { toString: (data: string, opts: Record<string, unknown>) => Promise<string> }
  let qrLib: QRCodeModule
  try {
    qrLib = await import('qrcode' as string) as QRCodeModule
  } catch {
    throw new PretextPdfError(
      'QR_DEP_MISSING',
      'qr-code elements require the qrcode package. Install it: npm install qrcode'
    )
  }
  try {
    return await qrLib.toString(el.data, {
      type: 'svg',
      errorCorrectionLevel: el.errorCorrectionLevel ?? 'M',
      margin: el.margin ?? 4,
      color: {
        dark: el.foreground ?? '#000000',
        light: el.background ?? '#ffffff',
      },
    })
  } catch (err) {
    throw new PretextPdfError(
      'QR_GENERATE_FAILED',
      `QR code generation failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

// ─── Barcode generator ────────────────────────────────────────────────────────

async function generateBarcodeSvg(el: BarcodeElement): Promise<string> {
  type BwipModule = { toSVG: (opts: Record<string, unknown>) => string }
  let bwip: BwipModule
  try {
    bwip = await import('bwip-js' as string) as BwipModule
  } catch {
    throw new PretextPdfError(
      'BARCODE_DEP_MISSING',
      'barcode elements require the bwip-js package. Install it: npm install bwip-js'
    )
  }
  try {
    return bwip.toSVG({
      bcid: el.symbology,
      text: el.data,
      scale: 3,
      includetext: el.includeText !== false,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const isSymbology = msg.toLowerCase().includes('unknown') || msg.toLowerCase().includes('bcid')
    throw new PretextPdfError(
      isSymbology ? 'BARCODE_SYMBOLOGY_INVALID' : 'BARCODE_GENERATE_FAILED',
      `Barcode generation failed (symbology: '${el.symbology}'): ${msg}`
    )
  }
}

// ─── Chart generator (vega-lite, optional) ────────────────────────────────────

async function generateChartSvg(el: ChartElement, contentWidth: number): Promise<string> {
  type VegaLiteModule = { compile: (spec: Record<string, unknown>) => { spec: Record<string, unknown> } }
  type VegaLoader = { load: (uri: string, opt?: unknown) => Promise<string> }
  type VegaModule = { View: new (spec: unknown, opts: Record<string, unknown>) => { toSVG: () => Promise<string> }; parse: (spec: unknown) => unknown; loader: () => VegaLoader }
  let vegaLite: VegaLiteModule
  let vega: VegaModule
  try {
    vegaLite = await import('vega-lite' as string) as VegaLiteModule
    vega     = await import('vega' as string) as VegaModule
  } catch {
    throw new PretextPdfError(
      'CHART_DEP_MISSING',
      'chart elements require vega and vega-lite packages. Install them: npm install vega vega-lite'
    )
  }
  let vegaSpec: Record<string, unknown>
  try {
    const specWithSize = { ...el.spec, width: el.width ?? contentWidth, height: el.height ?? 300 }
    vegaSpec = vegaLite.compile(specWithSize).spec
  } catch (err) {
    throw new PretextPdfError(
      'CHART_SPEC_INVALID',
      `vega-lite spec compilation failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }
  try {
    // Block all remote data loading to prevent SSRF — vega's default loader
    // follows any data.url in the spec, which could reach internal services
    const blockedLoader = vega.loader()
    blockedLoader.load = (_uri: string): Promise<string> =>
      Promise.reject(new Error('Remote data loading is disabled in pretext-pdf'))
    const view = new vega.View(vega.parse(vegaSpec), { renderer: 'none', loader: blockedLoader })
    return await view.toSVG()
  } catch (err) {
    throw new PretextPdfError(
      'CHART_RENDER_FAILED',
      `Chart SVG rendering failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

// ─── SVG → PDF image ──────────────────────────────────────────────────────────

/**
 * Rasterize an SVG string to a PNG buffer at 2x scale.
 * Pure compute — no pdf-lib interaction — so it is safe to run in parallel.
 */
async function rasterizeSvgToPng(svg: string, widthPt: number, heightPt: number): Promise<Buffer> {
  let canvasLib: any
  try {
    canvasLib = await import('@napi-rs/canvas' as string)
  } catch {
    throw new PretextPdfError(
      'SVG_RENDER_FAILED',
      'SVG rendering requires the optional dependency @napi-rs/canvas. Install it with: pnpm add @napi-rs/canvas'
    )
  }

  const scale = 2
  const widthPx = Math.round(widthPt * scale)
  const heightPx = Math.round(heightPt * scale)

  try {
    const canvas = canvasLib.createCanvas(widthPx, heightPx)
    const ctx = canvas.getContext('2d')
    const img = new canvasLib.Image()
    img.src = Buffer.from(svg)
    ctx.drawImage(img, 0, 0, widthPx, heightPx)
    return canvas.toBuffer('image/png')
  } catch (err) {
    throw new PretextPdfError(
      'SVG_RENDER_FAILED',
      `Failed to rasterize SVG: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

/** Maximum number of vector-asset rasterization tasks allowed to run in parallel. */
export const VECTOR_RASTER_CONCURRENCY = 4

/**
 * Bounded-parallel allSettled. Runs at most `limit` tasks concurrently and
 * collects per-task fulfilled/rejected results in the original order.
 */
async function allSettledWithLimit<T>(
  items: ReadonlyArray<() => Promise<T>>,
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(items.length)
  let cursor = 0
  async function next(): Promise<void> {
    while (cursor < items.length) {
      const idx = cursor++
      try {
        const value = await items[idx]!()
        results[idx] = { status: 'fulfilled', value }
      } catch (reason) {
        results[idx] = { status: 'rejected', reason }
      }
    }
  }
  const workerCount = Math.min(Math.max(1, limit), items.length)
  await Promise.all(Array.from({ length: workerCount }, () => next()))
  return results
}

/**
 * Load SVG/QR/barcode/chart elements:
 *   Phase A — generate svg + rasterize to PNG in parallel (CPU/I/O bound, safe to fan out)
 *   Phase B — embed PNGs sequentially because pdf-lib xref mutation is not concurrency-safe
 *
 * One failed asset must not block other embeds (error isolation matches prior behavior).
 */
async function loadVectorAssets(
  doc: PdfDocument,
  pdfDoc: PDFDocument,
  imageMap: ImageMap,
  contentWidth: number,
  allowedDirs: string[] | undefined,
  warn: (msg: string) => void,
): Promise<void> {
  type RasterTask = {
    key: string
    index: number
    kind: 'svg' | 'qr-code' | 'barcode' | 'chart'
    run: () => Promise<Buffer>
  }
  const tasks: RasterTask[] = []
  for (let i = 0; i < doc.content.length; i++) {
    const el = doc.content[i]!
    if (el.type === 'svg') {
      tasks.push({ key: `svg-${i}`, index: i, kind: 'svg', run: async () => {
        const svgContent = await resolveSvgContent(el, allowedDirs)
        const svgWithContent: SvgElement = { type: 'svg', svg: svgContent, width: el.width, height: el.height, align: el.align, spaceBefore: el.spaceBefore, spaceAfter: el.spaceAfter } as SvgElement
        const { widthPt, heightPt } = resolveSvgDimensions(svgWithContent, contentWidth)
        return rasterizeSvgToPng(svgContent, widthPt, heightPt)
      } })
    } else if (el.type === 'qr-code') {
      tasks.push({ key: `qr-${i}`, index: i, kind: 'qr-code', run: async () => {
        const svgString = await generateQrSvg(el)
        const sizePt = el.size ?? 80
        return rasterizeSvgToPng(svgString, sizePt, sizePt)
      } })
    } else if (el.type === 'barcode') {
      tasks.push({ key: `barcode-${i}`, index: i, kind: 'barcode', run: async () => {
        const svgString = await generateBarcodeSvg(el)
        const widthPt = el.width ?? 200
        const heightPt = el.height ?? 60
        return rasterizeSvgToPng(svgString, widthPt, heightPt)
      } })
    } else if (el.type === 'chart') {
      tasks.push({ key: `chart-${i}`, index: i, kind: 'chart', run: async () => {
        const svgString = await generateChartSvg(el, contentWidth)
        const widthPt = el.width ?? contentWidth
        const heightPt = el.height ?? 300
        return rasterizeSvgToPng(svgString, widthPt, heightPt)
      } })
    }
  }
  if (tasks.length === 0) return

  // Phase A: bounded-parallel rasterization. allSettled isolates per-task failures.
  // Cap concurrency to avoid resource exhaustion (sharp/svg2pdfkit workers, FDs)
  // when a document carries many vector assets.
  const results = await allSettledWithLimit(tasks.map(t => () => t.run()), VECTOR_RASTER_CONCURRENCY)

  // Phase B: MUST remain sequential — pdf-lib xref mutation is not concurrency-safe
  for (let ti = 0; ti < tasks.length; ti++) {
    const task = tasks[ti]!
    const result = results[ti]!
    if (result.status === 'rejected') {
      const err = result.reason
      // SVG failures historically propagated (file/url/render errors thrown).
      if (task.kind === 'svg') throw err
      if (err instanceof PretextPdfError) throw err
      const message = err instanceof Error ? err.message : String(err)
      warn(`[pretext-pdf] ${task.kind} load failed at index ${task.index} (CHART_LOAD_FAILED): ${message}. Slot will be blank in PDF.`)
      continue
    }
    try {
      const pdfImage = await pdfDoc.embedPng(result.value)
      imageMap.set(task.key, pdfImage)
    } catch (err) {
      if (task.kind === 'svg') throw err
      if (err instanceof PretextPdfError) throw err
      const message = err instanceof Error ? err.message : String(err)
      warn(`[pretext-pdf] ${task.kind} embed failed at index ${task.index} (CHART_LOAD_FAILED): ${message}. Slot will be blank in PDF.`)
    }
  }
}

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

/**
 * Resolve the image format from the element spec, magic bytes, or file extension.
 * Priority: explicit 'png'/'jpg' → magic bytes → file extension → error.
 */
function resolveImageFormat(el: ImageElement, bytes: Uint8Array, key: string): 'png' | 'jpg' {
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
async function loadImageBytes(el: ImageElement, key: string, allowedDirs?: string[]): Promise<Uint8Array> {
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
