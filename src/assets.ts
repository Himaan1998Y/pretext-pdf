import { PDFDocument } from '@cantoo/pdf-lib'
import type { PdfDocument, ImageElement, SvgElement, ImageMap } from './types.js'
import { PretextPdfError } from './errors.js'

// ─── SVG helpers ──────────────────────────────────────────────────────────────

const SVG_MAX_BYTES = 5 * 1024 * 1024  // 5 MB — prevent ReDoS on giant SVG strings

function parseSvgViewBox(svg: string): { width: number; height: number } | null {
  if (svg.length > SVG_MAX_BYTES) return null  // too large to scan safely
  const match = svg.match(/viewBox=["']([^"']+)["']/)
  if (!match) return null
  const parts = match[1]!.split(/[\s,]+/).map(Number)
  const w = parts[2], h = parts[3]
  if (!w || !h || !isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return null
  return { width: w, height: h }
}

function parseSvgAttributes(svg: string): { width: number; height: number } | null {
  if (svg.length > SVG_MAX_BYTES) return null  // too large to scan safely
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
  // No dimensions specified: use full contentWidth, clamped to available space
  const widthPt = Math.min(contentWidth, contentWidth)  // Already at contentWidth, but explicit for clarity
  const heightPt = aspectRatio !== null ? widthPt * aspectRatio : 200
  return { widthPt, heightPt }
}

/**
 * Resolve SVG content string from either an inline `svg` field or a `src` file/URL.
 * Throws PretextPdfError if neither is provided or the source cannot be loaded.
 */
async function resolveSvgContent(el: SvgElement): Promise<string> {
  if (el.svg) return el.svg

  if (!el.src) {
    throw new PretextPdfError('SVG_LOAD_FAILED', "SvgElement requires either 'svg' (inline string) or 'src' (file path or https:// URL)")
  }

  // HTTPS URL
  if (el.src.startsWith('https://') || el.src.startsWith('http://')) {
    let resp: Response
    try {
      resp = await fetch(el.src)
    } catch (err) {
      throw new PretextPdfError('SVG_LOAD_FAILED', `SVG URL fetch failed for "${el.src}": ${err instanceof Error ? err.message : String(err)}`)
    }
    if (!resp.ok) {
      throw new PretextPdfError('SVG_LOAD_FAILED', `SVG URL returned HTTP ${resp.status}: "${el.src}"`)
    }
    return resp.text()
  }

  // File path
  const [fs, pathMod] = await Promise.all([import('fs'), import('path')])
  const filePath = pathMod.normalize(el.src)
  if (!fs.existsSync(filePath)) {
    throw new PretextPdfError('SVG_LOAD_FAILED', `SVG file not found: "${filePath}"`)
  }
  return fs.readFileSync(filePath, 'utf-8')
}

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

  const scale = 2  // 2x for retina quality
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

  // Collect all ImageElement entries with their content index for stable keys
  const imageEntries: Array<{ el: ImageElement; key: string }> = []
  for (let i = 0; i < doc.content.length; i++) {
    const el = doc.content[i]!
    if (el.type === 'image') {
      imageEntries.push({ el, key: `img-${i}` })
    } else if (el.type === 'float-group') {
      // Convert float-group image to ImageElement for loading
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
          const bytes = await loadImageBytes(el, key)
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
      console.warn(`[pretext-pdf] Image embed failed: Image key "${key}" (format: '${resolvedFormat}'): ${error.message}`)
      // Continue without this image rather than crashing
    }
  }

  // Load SVG elements — rasterize to PNG and embed
  for (let i = 0; i < doc.content.length; i++) {
    const el = doc.content[i]!
    if (el.type === 'svg') {
      const key = `svg-${i}`
      const svgContent = await resolveSvgContent(el)
      const { widthPt, heightPt } = resolveSvgDimensions({ ...el, svg: svgContent }, contentWidth)
      const pdfImage = await loadSvgAsImage(svgContent, widthPt, heightPt, pdfDoc)
      imageMap.set(key, pdfImage)
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
        const filePath = pathMod.normalize(src as string)
        if (!fs.existsSync(filePath)) throw new Error(`Watermark image not found: "${filePath}"`)
        bytes = new Uint8Array(fs.readFileSync(filePath))
      }
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
      const pdfImage = isPng
        ? await pdfDoc.embedPng(bytes)
        : await pdfDoc.embedJpg(bytes)
      imageMap.set('watermark', pdfImage)
    } catch {
      // Watermark image load failure is non-fatal — watermark simply won't be rendered
    }
  }

  return imageMap
}

/**
 * Resolve the image format from the element spec, magic bytes, or file extension.
 * Priority: explicit 'png'/'jpg' → magic bytes → file extension → error.
 */
function resolveImageFormat(el: ImageElement, bytes: Uint8Array, key: string): 'png' | 'jpg' {
  // Explicit format — trust the user
  if (el.format === 'png') return 'png'
  if (el.format === 'jpg') return 'jpg'

  // Auto-detect from magic bytes (most reliable)
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'png'
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'jpg'

  // Fallback: file extension
  if (typeof el.src === 'string') {
    const ext = el.src.toLowerCase().split('.').pop()
    if (ext === 'png') return 'png'
    if (ext === 'jpg' || ext === 'jpeg') return 'jpg'
  }

  throw new PretextPdfError(
    'IMAGE_FORMAT_MISMATCH',
    `Image "${key}": format could not be auto-detected. Bytes start with [0x${bytes[0]?.toString(16) ?? '?'}, 0x${bytes[1]?.toString(16) ?? '?'}]. Specify format: 'png' or 'jpg' explicitly.`
  )
}

/** Load image bytes from a URL, file path, or Uint8Array */
async function loadImageBytes(el: ImageElement, key: string): Promise<Uint8Array> {
  // Already have bytes — use directly
  if (el.src instanceof Uint8Array) {
    return el.src
  }

  const src = el.src

  if (!src || typeof src !== 'string') {
    throw new PretextPdfError('IMAGE_LOAD_FAILED', `Image "${key}": 'src' must be a non-empty string path, URL, or Uint8Array`)
  }

  // HTTPS/HTTP URL — fetch it
  if (src.startsWith('https://') || src.startsWith('http://')) {
    let resp: Response
    try {
      resp = await fetch(src)
    } catch (err) {
      throw new PretextPdfError(
        'IMAGE_LOAD_FAILED',
        `Image "${key}": failed to fetch URL "${src}": ${err instanceof Error ? err.message : String(err)}`
      )
    }
    if (!resp.ok) {
      throw new PretextPdfError(
        'IMAGE_LOAD_FAILED',
        `Image "${key}": URL returned HTTP ${resp.status}: "${src}"`
      )
    }
    try {
      const buf = await resp.arrayBuffer()
      return new Uint8Array(buf)
    } catch (err) {
      throw new PretextPdfError(
        'IMAGE_LOAD_FAILED',
        `Image "${key}": failed to read response body from "${src}": ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  // File path — load from filesystem
  const fs = await import('fs')

  if (!fs.existsSync(src)) {
    throw new PretextPdfError(
      'IMAGE_LOAD_FAILED',
      `Image "${key}": file not found at "${src}". Check the path in the image element's 'src' field.`
    )
  }

  try {
    const buffer = fs.readFileSync(src)
    return new Uint8Array(buffer)
  } catch (err) {
    throw new PretextPdfError(
      'IMAGE_LOAD_FAILED',
      `Image "${key}": failed to read file "${src}": ${err instanceof Error ? err.message : String(err)}`
    )
  }
}
