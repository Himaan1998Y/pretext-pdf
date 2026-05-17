import { PDFDocument } from '@cantoo/pdf-lib'
import { promises as dnsPromises } from 'node:dns'
import { Agent, fetch as undiciFetch } from 'undici'
import type { PdfDocument, ImageElement, SvgElement, QrCodeElement, BarcodeElement, ChartElement, Logger } from './types.js'
import type { ImageMap } from './types-internal.js'
import { PretextPdfError } from './errors.js'
import type { PluginDefinition } from './plugin-types.js'
import { findPlugin, runPluginLoadAsset } from './plugin-registry.js'

// ─── Security helpers ─────────────────────────────────────────────────────────

/**
 * Enforce allowedFileDirs: resolved absolute path must start with an allowed dir.
 * Deny-by-default: when allowedFileDirs is undefined or empty, file:// access is
 * rejected unless the caller explicitly configures the allowed directories.
 */
export function assertPathAllowed(resolvedPath: string, allowedDirs: string[] | undefined, label: string): void {
  if (!allowedDirs || allowedDirs.length === 0) {
    throw new PretextPdfError(
      'PATH_TRAVERSAL',
      `${label} src uses a local file path but doc.allowedFileDirs is not set. ` +
      `Configure allowedFileDirs to explicitly list the directories from which files may be read.`
    )
  }
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
 * - Rejects private/internal IP ranges (SSRF prevention), including IPv4-mapped IPv6
 *   forms like [::ffff:127.0.0.1] which would otherwise bypass dotted-decimal regexes.
 * Throws IMAGE_LOAD_FAILED or SVG_LOAD_FAILED on violations.
 */
function isPrivateAddress(h: string, raw: string): boolean {
  // IPv6 prefix checks must only fire on actual IPv6 hostnames (which contain
  // a colon) — otherwise legitimate hostnames like `ffmpeg.com` or `fcc.gov`
  // would be blocked.
  const isV6 = raw.includes(':')
  return (
    h === 'localhost' ||
    h === '0.0.0.0' ||
    h === '::' ||                  // IPv6 unspecified address (== 0.0.0.0)
    h === '::1' ||
    raw === '::1' || raw === '::' || // also catch un-normalized IPv6 forms
    /^0\./.test(h) ||              // 0.0.0.0/8 "this network"
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^192\.0\.0\./.test(h) ||      // 192.0.0/24 IETF protocol assignments
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^169\.254\./.test(h) ||      // link-local / AWS IMDS
    /^198\.1[89]\./.test(h) ||    // 198.18/15 benchmark testing
    /^22[4-9]\./.test(h) || /^23\d\./.test(h) || // 224/4 multicast
    /^2[4-5]\d\./.test(h) ||      // 240/4 reserved (240–255)
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h) || // CGNAT RFC 6598
    (isV6 && (raw.startsWith('fc') || raw.startsWith('fd'))) ||  // IPv6 ULA fc00::/7
    (isV6 && /^fe[89ab]/i.test(raw)) ||                          // IPv6 link-local fe80::/10
    (isV6 && /^ff/i.test(raw))                                   // IPv6 multicast ff00::/8
  )
}

/**
 * Result of resolving a URL: the parsed URL plus the pre-validated IP that
 * downstream fetches should pin to (closing the TOCTOU rebinding window).
 * `ip` is null only for IP-literal hostnames (no DNS lookup performed).
 */
export interface ResolvedSafeUrl {
  url: URL
  ip: string | null
  family: 4 | 6 | null
}

/**
 * Validate that a URL is safe to fetch. Returns the parsed URL and the
 * pre-resolved IP so callers can pin the connection. Throws PretextPdfError
 * if the URL targets a private/internal address.
 */
export async function resolveAndValidateUrl(
  url: string,
  errorCode: 'IMAGE_LOAD_FAILED' | 'SVG_LOAD_FAILED',
  label: string,
): Promise<ResolvedSafeUrl> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new PretextPdfError(errorCode, `${label}: invalid URL`)
  }

  if (parsed.protocol === 'http:') {
    throw new PretextPdfError(errorCode, `${label}: HTTP URLs are not allowed — use HTTPS`)
  }

  if (parsed.protocol === 'data:' || parsed.protocol === 'file:' || parsed.protocol === 'javascript:') {
    throw new PretextPdfError(errorCode, `${label}: ${parsed.protocol} URLs are not allowed — use HTTPS only`)
  }

  if (parsed.protocol !== 'https:') {
    throw new PretextPdfError(errorCode, `${label}: refused scheme: ${parsed.protocol}`)
  }

  const raw = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '') // strip IPv6 brackets

  // Normalize IPv4-mapped IPv6 to its dotted-decimal form so the IPv4
  // private-range regexes catch it. WHATWG URL normalizes `[::ffff:127.0.0.1]`
  // to `[::ffff:7f00:1]` (hex form), so we must handle BOTH the dotted
  // (`::ffff:127.0.0.1`) and hex-compressed (`::ffff:7f00:1`) forms.
  // Without this an attacker can bypass the localhost/private-IP check via
  // `https://[::ffff:127.0.0.1]/admin` → resolves to 127.0.0.1.
  let h = raw
  const v4Dotted = raw.match(/^::ffff:(?:0:)?(\d{1,3}(?:\.\d{1,3}){3})$/i)
  const v4Hex = raw.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (v4Dotted) {
    h = v4Dotted[1]!
  } else if (v4Hex) {
    const hi = parseInt(v4Hex[1]!, 16)
    const lo = parseInt(v4Hex[2]!, 16)
    h = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
  }

  if (isPrivateAddress(h, raw)) {
    throw new PretextPdfError(errorCode, `${label}: connections to private or internal addresses are not allowed`)
  }

  // DNS pre-resolution: re-verify the resolved IP AND remember it so callers
  // can pin the actual TCP connection to this exact IP (closes the TOCTOU
  // window where an attacker with TTL=0 DNS could rebind between check and
  // connect).
  const isIpv4Literal = /^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname)
  const isIpv6Literal = parsed.hostname.startsWith('[')
  if (isIpv4Literal) {
    return { url: parsed, ip: parsed.hostname, family: 4 }
  }
  if (isIpv6Literal) {
    return { url: parsed, ip: raw, family: 6 }
  }
  if (!parsed.hostname) {
    return { url: parsed, ip: null, family: null }
  }
  try {
    const { address, family } = await dnsPromises.lookup(parsed.hostname)
    const resolvedH = address.toLowerCase()
    if (isPrivateAddress(resolvedH, resolvedH)) {
      throw new PretextPdfError(errorCode, `${label}: hostname resolves to a private address`)
    }
    return { url: parsed, ip: address, family: (family === 6 ? 6 : 4) }
  } catch (err) {
    if (err instanceof PretextPdfError) throw err
    // DNS unavailable: fetch() will also fail, so rebinding is not possible.
    // Without a resolved IP we cannot pin the connection; let undici resolve
    // itself, which will then fail with the same DNS error.
    return { url: parsed, ip: null, family: null }
  }
}

/**
 * Back-compat wrapper that drops the resolution result. Kept so existing
 * tests and call sites that only need the validation side-effect still work.
 */
export async function assertSafeUrl(
  url: string,
  errorCode: 'IMAGE_LOAD_FAILED' | 'SVG_LOAD_FAILED',
  label: string,
): Promise<void> {
  await resolveAndValidateUrl(url, errorCode, label)
}

/**
 * Build an undici Agent whose every TCP connection is pinned to the supplied
 * pre-validated IP. Closes the DNS-rebinding TOCTOU window: even if DNS is
 * re-resolved by the runtime mid-flight, the socket targets the IP we already
 * confirmed is public.
 *
 * Caller MUST `close()` the agent after the fetch completes.
 */
function createPinnedAgent(ip: string, family: 4 | 6): Agent {
  return new Agent({
    connect: {
      // Undici accepts a Node `dns.lookup`-compatible function here.
      // We unconditionally return the pre-validated IP so a malicious DNS
      // server cannot rebind to a private address between validation and
      // connect.
      lookup: (
        _hostname: string,
        _options: unknown,
        cb: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
      ): void => {
        cb(null, ip, family)
      },
    },
  })
}

/**
 * Fetch with a hard 10-second timeout AND a manual redirect chain that
 * re-validates each hop against `resolveAndValidateUrl`. Without manual
 * redirect handling, a public URL could 302 to `http://127.0.0.1:8080/internal`
 * and bypass the upfront check — the connection would still be made to
 * the private target.
 *
 * Each hop creates a fresh undici Agent that pins the socket to the IP
 * that just passed validation. This defeats DNS-rebinding TOCTOU attacks
 * where an attacker controls a TTL=0 DNS record and swaps the answer
 * between our `dns.lookup()` and the actual TCP connect.
 */
export async function fetchWithTimeout(
  url: string,
  errorCode: 'IMAGE_LOAD_FAILED' | 'SVG_LOAD_FAILED',
  label: string
): Promise<Response> {
  const MAX_REDIRECTS = 3
  let currentUrl = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const { url: parsed, ip, family } = await resolveAndValidateUrl(currentUrl, errorCode, label)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)

    // Only create a pinned dispatcher when we have a resolved IP. For
    // IP-literal hosts or DNS-unavailable cases we let undici handle
    // resolution itself (a DNS failure there is already safe).
    const pinnedAgent = ip && family ? createPinnedAgent(ip, family) : null

    let res: Response
    try {
      const fetchOpts: Parameters<typeof undiciFetch>[1] = {
        signal: controller.signal,
        redirect: 'manual',
      }
      if (pinnedAgent) {
        // `dispatcher` is an undici-specific extension; cast keeps fetch
        // typings happy without leaking undici types into the public API.
        ;(fetchOpts as unknown as { dispatcher: Agent }).dispatcher = pinnedAgent
      }
      res = (await undiciFetch(parsed.toString(), fetchOpts)) as unknown as Response
    } finally {
      clearTimeout(timer)
      if (pinnedAgent) {
        // Don't block the caller on agent shutdown; swallow close errors.
        void pinnedAgent.close().catch(() => undefined)
      }
    }

    // Undici fetch does not produce `opaqueredirect`, but keep parity with
    // the browser-fetch contract: if we somehow get one, refuse.
    if (res.type === 'opaqueredirect') {
      throw new PretextPdfError(errorCode, `${label}: cannot follow opaque redirect. Pre-resolve the URL.`)
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('Location')
      if (!loc) throw new PretextPdfError(errorCode, `${label}: redirect (${res.status}) with no Location header`)
      currentUrl = new URL(loc, parsed).toString()
      continue
    }
    return res
  }
  throw new PretextPdfError(errorCode, `${label}: too many redirects (max ${MAX_REDIRECTS})`)
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

async function loadSvgAsImage(
  svg: string,
  widthPt: number,
  heightPt: number,
  pdfDoc: PDFDocument
): Promise<import('@cantoo/pdf-lib').PDFImage> {
  const pngBuffer = await rasterizeSvgToPng(svg, widthPt, heightPt)
  return pdfDoc.embedPng(pngBuffer)
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
