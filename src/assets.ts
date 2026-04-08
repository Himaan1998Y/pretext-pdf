import { PDFDocument } from '@cantoo/pdf-lib'
import type { PdfDocument, ImageElement, SvgElement, ImageMap } from './types.js'
import { PretextPdfError } from './errors.js'

// ─── SVG helpers ──────────────────────────────────────────────────────────────

function parseSvgViewBox(svg: string): { width: number; height: number } | null {
  const match = svg.match(/viewBox=["']([^"']+)["']/)
  if (!match) return null
  const parts = match[1]!.split(/[\s,]+/).map(Number)
  const w = parts[2], h = parts[3]
  if (!w || !h || !isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return null
  return { width: w, height: h }
}

function parseSvgAttributes(svg: string): { width: number; height: number } | null {
  const wMatch = svg.match(/<svg[^>]*\swidth=["'](\d+(?:\.\d+)?)["']/)
  const hMatch = svg.match(/<svg[^>]*\sheight=["'](\d+(?:\.\d+)?)["']/)
  if (!wMatch || !hMatch) return null
  const w = Number(wMatch[1]), h = Number(hMatch[1])
  if (!w || !h || w <= 0 || h <= 0) return null
  return { width: w, height: h }
}

function resolveSvgDimensions(el: SvgElement, contentWidth: number): { widthPt: number; heightPt: number } {
  const viewbox = parseSvgViewBox(el.svg) ?? parseSvgAttributes(el.svg)
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
 */
export async function loadImages(doc: PdfDocument, pdfDoc: PDFDocument, contentWidth: number): Promise<ImageMap> {
  const imageMap: ImageMap = new Map()

  // Collect all ImageElement entries with their content index for stable keys
  const imageEntries: Array<{ el: ImageElement; key: string }> = []
  for (let i = 0; i < doc.content.length; i++) {
    const el = doc.content[i]!
    if (el.type === 'image') {
      imageEntries.push({ el, key: `img-${i}` })
    }
  }

  // Load all image bytes in parallel
  const loadResults = imageEntries.length > 0
    ? await Promise.all(
        imageEntries.map(async ({ el, key }) => {
          const bytes = await loadImageBytes(el, key)
          return { el, key, bytes }
        })
      )
    : []

  // Embed sequentially (@cantoo/pdf-lib limitation)
  for (const { el, key, bytes } of loadResults) {
    const resolvedFormat = resolveImageFormat(el, bytes, key)
    try {
      const pdfImage = resolvedFormat === 'png'
        ? await pdfDoc.embedPng(bytes)
        : await pdfDoc.embedJpg(bytes)
      imageMap.set(key, pdfImage)
    } catch (err) {
      throw new PretextPdfError(
        'IMAGE_FORMAT_MISMATCH',
        `Image key "${key}" (format: '${resolvedFormat}'): @cantoo/pdf-lib failed to embed — the bytes may not be a valid ${resolvedFormat.toUpperCase()} file. Error: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  // Load SVG elements — rasterize to PNG and embed
  for (let i = 0; i < doc.content.length; i++) {
    const el = doc.content[i]!
    if (el.type === 'svg') {
      const key = `svg-${i}`
      const { widthPt, heightPt } = resolveSvgDimensions(el, contentWidth)
      const pdfImage = await loadSvgAsImage(el.svg, widthPt, heightPt, pdfDoc)
      imageMap.set(key, pdfImage)
    }
  }

  // Load watermark image if provided
  if (doc.watermark?.image) {
    const src = doc.watermark.image
    try {
      const bytes = src instanceof Uint8Array
        ? src
        : new Uint8Array((await import('fs')).readFileSync(src as string))
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

/** Load image bytes from a file path or Uint8Array */
async function loadImageBytes(el: ImageElement, key: string): Promise<Uint8Array> {
  // Already have bytes — use directly
  if (el.src instanceof Uint8Array) {
    return el.src
  }

  // String path — load from filesystem
  const filePath = el.src

  if (!filePath || typeof filePath !== 'string') {
    throw new PretextPdfError('IMAGE_LOAD_FAILED', `Image "${key}": 'src' must be a non-empty string path or Uint8Array`)
  }

  // Dynamic import — tree-shaken in browser builds, only loaded when src is a file path
  const fs = await import('fs')

  if (!fs.existsSync(filePath)) {
    throw new PretextPdfError(
      'IMAGE_LOAD_FAILED',
      `Image "${key}": file not found at "${filePath}". Check the path in the image element's 'src' field.`
    )
  }

  try {
    const buffer = fs.readFileSync(filePath)
    return new Uint8Array(buffer)
  } catch (err) {
    throw new PretextPdfError(
      'IMAGE_LOAD_FAILED',
      `Image "${key}": failed to read file "${filePath}": ${err instanceof Error ? err.message : String(err)}`
    )
  }
}
