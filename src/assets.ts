import { PDFDocument } from '@cantoo/pdf-lib'
import type { PdfDocument, ImageElement, SvgElement, QrCodeElement, BarcodeElement, ChartElement, ImageMap } from './types.js'
import { PretextPdfError } from './errors.js'

// ─── Security helpers ─────────────────────────────────────────────────────────

/**
 * Enforce allowedFileDirs: resolved absolute path must start with an allowed dir.
 * No-op when allowedFileDirs is unset (backwards-compatible default).
 */
export function assertPathAllowed(resolvedPath: string, allowedDirs: string[] | undefined, label: string): void {
  if (!allowedDirs || allowedDirs.length === 0) return
  const norm = resolvedPath.replace(/\\/g, '/')
  const allowed = allowedDirs.some(dir => {
    const d = dir.replace(/\\/g, '/').replace(/\/$/, '')
    return norm === d || norm.startsWith(d + '/')
  })
  if (!allowed) {
    throw new PretextPdfError(
      'PATH_TRAVERSAL',
      `${label} src is outside allowedFileDirs. Configure doc.allowedFileDirs to include the file's directory.`
    )
  }
}

/**
 * Validate a remote URL before fetching:
 * - Rejects http:// (plaintext only)
 * - Rejects private/internal IP ranges (SSRF prevention)
 * Throws IMAGE_LOAD_FAILED or SVG_LOAD_FAILED on violations.
 */
function assertSafeUrl(url: string, errorCode: 'IMAGE_LOAD_FAILED' | 'SVG_LOAD_FAILED', label: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new PretextPdfError(errorCode, `${label}: invalid URL`)
  }

  if (parsed.protocol === 'http:') {
    throw new PretextPdfError(errorCode, `${label}: HTTP URLs are not allowed — use HTTPS`)
  }

  const h = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '') // strip IPv6 brackets

  const isPrivate =
    h === 'localhost' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^169\.254\./.test(h) ||      // link-local / AWS IMDS
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h) || // CGNAT RFC 6598
    h.startsWith('fc') || h.startsWith('fd') ||            // IPv6 ULA fc00::/7
    /^fe[89ab]/i.test(h)                                   // IPv6 link-local fe80::/10

  if (isPrivate) {
    throw new PretextPdfError(errorCode, `${label}: connections to private or internal addresses are not allowed`)
  }
}

/** Fetch with a hard 10-second timeout */
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Strip dangerous content from SVG before rasterization:
 * - <script> blocks
 * - on* event handler attributes
 * - <image>/<use> with file://, data:, or javascript: hrefs (local-file and injection vectors)
 */
function sanitizeSvg(svg: string): string {
  // Skip regex passes on oversized strings — canvas will reject them anyway
  if (svg.length > SVG_MAX_BYTES) return svg
  // Remove self-closing <script/> then paired <script>...</script> blocks
  let s = svg.replace(/<script\b[^>]*\/>/gi, '')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  // Remove event handler attributes (onload, onclick, onerror, etc.)
  s = s.replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
  // Remove <image> and <use> hrefs pointing to unsafe schemes
  s = s.replace(
    /(<(?:image|use)\b[^>]*?)\s+(?:xlink:)?href\s*=\s*["'](?:file|data|javascript):[^"']*["']/gi,
    '$1'
  )
  return s
}

/** Return just the filename from a path — used in error messages to avoid leaking directory structure */
function redactPath(src: string): string {
  return src.replace(/\\/g, '/').split('/').pop() ?? '(file)'
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────

const SVG_MAX_BYTES = 5 * 1024 * 1024  // 5 MB — prevent ReDoS on giant SVG strings

function parseSvgViewBox(svg: string): { width: number; height: number } | null {
  if (svg.length > SVG_MAX_BYTES) return null
  const match = svg.match(/viewBox=["']([^"']+)["']/)
  if (!match) return null
  const parts = match[1]!.split(/[\s,]+/).map(Number)
  const w = parts[2], h = parts[3]
  if (!w || !h || !isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return null
  return { width: w, height: h }
}

function parseSvgAttributes(svg: string): { width: number; height: number } | null {
  if (svg.length > SVG_MAX_BYTES) return null
  const wMatch = svg.match(/<svg[^>]*\swidth=["'](\d+(?:\.\d+)?)["']/)
  const hMatch = svg.match(/<svg[^>]*\sheight=["'](\d+(?:\.\d+)?)["']/)
  if (!wMatch || !hMatch) return null
  const w = Number(wMatch[1]), h = Number(hMatch[1])
  if (!w || !h || w <= 0 || h <= 0) return null
  return { width: w, height: h }
}

function resolveSvgDimensions(el: SvgElement, contentWidth: number): { widthPt: number; heightPt: number } {
  const svgStr = el.svg ?? ''
  const viewbox = parseSvgViewBox(svgStr) ?? parseSvgAttributes(svgStr)
  const aspectRatio = viewbox ? viewbox.height / viewbox.width : null

  if (el.width !== undefined && el.height !== undefined) {
    return { widthPt: el.width, heightPt: el.height }
  }
  if (el.width !== undefined) {
    return { widthPt: el.width, heightPt: aspectRatio !== null ? el.width * aspectRatio : el.width }
  }
  if (el.height !== undefined) {
    return { widthPt: aspectRatio !== null ? el.height / aspectRatio : el.height, heightPt: el.height }
  }
  const widthPt = contentWidth
  const heightPt = aspectRatio !== null ? widthPt * aspectRatio : 200
  return { widthPt, heightPt }
}

/**
 * Resolve SVG content string from either an inline `svg` field or a `src` file/URL.
 * Throws PretextPdfError if neither is provided or the source cannot be loaded.
 */
async function resolveSvgContent(el: SvgElement, allowedFileDirs?: string[]): Promise<string> {
  if (el.svg) return sanitizeSvg(el.svg)

  if (!el.src) {
    throw new PretextPdfError('SVG_LOAD_FAILED', "SvgElement requires either 'svg' (inline string) or 'src' (file path or https:// URL)")
  }

  if (el.src.startsWith('https://') || el.src.startsWith('http://')) {
    assertSafeUrl(el.src, 'SVG_LOAD_FAILED', 'SVG')
    let resp: Response
    try {
      resp = await fetchWithTimeout(el.src)
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

async function loadSvgAsImage(
  svg: string,
  widthPt: number,
  heightPt: number,
  pdfDoc: PDFDocument
): Promise<import('@cantoo/pdf-lib').PDFImage> {
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
    const pngBuffer = canvas.toBuffer('image/png')
    return pdfDoc.embedPng(pngBuffer)
  } catch (err) {
    throw new PretextPdfError(
      'SVG_RENDER_FAILED',
      `Failed to rasterize SVG: ${err instanceof Error ? err.message : String(err)}`
    )
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
export async function loadImages(doc: PdfDocument, pdfDoc: PDFDocument, contentWidth: number): Promise<ImageMap> {
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
      console.warn(`[pretext-pdf] Image load skipped: ${err.message}`)
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
      console.warn(`[pretext-pdf] Image embed failed: key "${key}" (format: '${resolvedFormat}')`)
      // Continue without this image rather than crashing
    }
  }

  // Load SVG elements — rasterize to PNG and embed
  for (let i = 0; i < doc.content.length; i++) {
    const el = doc.content[i]!
    if (el.type === 'svg') {
      const key = `svg-${i}`
      const svgContent = await resolveSvgContent(el, allowedDirs)
      const { widthPt, heightPt } = resolveSvgDimensions({ ...el, svg: svgContent }, contentWidth)
      const pdfImage = await loadSvgAsImage(svgContent, widthPt, heightPt, pdfDoc)
      imageMap.set(key, pdfImage)
    } else if (el.type === 'qr-code') {
      const key = `qr-${i}`
      try {
        const svgString = await generateQrSvg(el)
        const sizePt = el.size ?? 80
        const pdfImage = await loadSvgAsImage(svgString, sizePt, sizePt, pdfDoc)
        imageMap.set(key, pdfImage)
      } catch (err) {
        if (err instanceof PretextPdfError) throw err
        console.warn(`[pretext-pdf] QR code skipped at index ${i}: ${err instanceof Error ? err.message : String(err)}`)
      }
    } else if (el.type === 'barcode') {
      const key = `barcode-${i}`
      try {
        const svgString = await generateBarcodeSvg(el)
        const widthPt = el.width ?? 200
        const heightPt = el.height ?? 60
        const pdfImage = await loadSvgAsImage(svgString, widthPt, heightPt, pdfDoc)
        imageMap.set(key, pdfImage)
      } catch (err) {
        if (err instanceof PretextPdfError) throw err
        console.warn(`[pretext-pdf] Barcode skipped at index ${i}: ${err instanceof Error ? err.message : String(err)}`)
      }
    } else if (el.type === 'chart') {
      const key = `chart-${i}`
      try {
        const svgString = await generateChartSvg(el, contentWidth)
        const widthPt = el.width ?? contentWidth
        const heightPt = el.height ?? 300
        const pdfImage = await loadSvgAsImage(svgString, widthPt, heightPt, pdfDoc)
        imageMap.set(key, pdfImage)
      } catch (err) {
        if (err instanceof PretextPdfError) throw err
        console.warn(`[pretext-pdf] Chart skipped at index ${i}: ${err instanceof Error ? err.message : String(err)}`)
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
      console.warn(`[pretext-pdf] Watermark image skipped: ${err instanceof Error ? err.message : String(err)}`)
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
    assertSafeUrl(src, 'IMAGE_LOAD_FAILED', `Image "${key}"`)
    let resp: Response
    try {
      resp = await fetchWithTimeout(src)
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
