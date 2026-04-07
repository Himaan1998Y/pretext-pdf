/**
 * Visual regression testing helpers.
 *
 * Converts PDF pages to PNG images and compares them pixel-by-pixel against stored baselines.
 * Uses pdfjs-dist for rendering and pixelmatch for comparison.
 *
 * Usage:
 *   pnpm test:visual          — run comparison against baselines
 *   pnpm test:visual:update   — regenerate baselines from current output
 */
import { createCanvas } from '@napi-rs/canvas'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASELINES_DIR = path.join(__dirname, 'baselines')
const OUTPUT_DIR = path.join(__dirname, 'output')

// Render scale: 2x for sharper images (144 DPI equivalent)
const RENDER_SCALE = 2

/** Convert PDF bytes to an array of PNG buffers (one per page) */
export async function pdfToImages(pdfBytes: Uint8Array): Promise<Buffer[]> {
  // Polyfill browser globals required by pdfjs-dist in Node.js
  const canvasModule = await import('@napi-rs/canvas')
  if (typeof (globalThis as any).DOMMatrix === 'undefined') {
    (globalThis as any).DOMMatrix = canvasModule.DOMMatrix
  }
  if (typeof (globalThis as any).Path2D === 'undefined') {
    (globalThis as any).Path2D = canvasModule.Path2D
  }

  // Use the legacy build which is better suited for Node.js environments
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // Point to the legacy worker file so pdfjs can set up its fake worker in Node.js
  ;(pdfjsLib as any).GlobalWorkerOptions.workerSrc = new URL(
    '../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
    import.meta.url
  ).href

  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes })
  const pdfDoc = await loadingTask.promise
  const pageImages: Buffer[] = []

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale: RENDER_SCALE })

    // Use @napi-rs/canvas as the canvas implementation
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const ctx = canvas.getContext('2d')

    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise

    const pngBuffer = canvas.toBuffer('image/png')
    pageImages.push(pngBuffer)
  }

  return pageImages
}

export interface CompareResult {
  mismatchPercent: number
  totalPixels: number
  mismatchPixels: number
}

/**
 * Compare a rendered PNG buffer against the stored baseline.
 *
 * If UPDATE_BASELINES env var is set, saves the rendered buffer as the new baseline instead.
 * Saves a diff image to test/visual/output/<name>-diff.png for debugging failed tests.
 */
export async function compareToBaseline(
  rendered: Buffer,
  baselineName: string,
  options: { threshold?: number } = {}
): Promise<CompareResult> {
  const threshold = options.threshold ?? 0.1 // per-pixel threshold (0–1)
  const baselinePath = path.join(BASELINES_DIR, baselineName)

  // If updating baselines: write and return 0 mismatch
  if (process.env['UPDATE_BASELINES'] === '1') {
    fs.mkdirSync(BASELINES_DIR, { recursive: true })
    fs.writeFileSync(baselinePath, rendered)
    return { mismatchPercent: 0, totalPixels: 0, mismatchPixels: 0 }
  }

  if (!fs.existsSync(baselinePath)) {
    throw new Error(
      `Baseline "${baselineName}" not found at ${baselinePath}.\n` +
      `Run "pnpm test:visual:update" to generate baselines from the current output.`
    )
  }

  const { default: pixelmatch } = await import('pixelmatch')
  const { PNG } = await import('pngjs')

  const baseline = PNG.sync.read(fs.readFileSync(baselinePath))
  const current = PNG.sync.read(rendered)

  if (baseline.width !== current.width || baseline.height !== current.height) {
    throw new Error(
      `Image size mismatch for "${baselineName}": ` +
      `baseline=${baseline.width}x${baseline.height}, ` +
      `current=${current.width}x${current.height}`
    )
  }

  const { width, height } = baseline
  const diff = new PNG({ width, height })

  const mismatchPixels = pixelmatch(
    baseline.data,
    current.data,
    diff.data,
    width,
    height,
    { threshold }
  )

  // Save diff image for debugging
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  const diffName = baselineName.replace('.png', '-diff.png')
  fs.writeFileSync(path.join(OUTPUT_DIR, diffName), PNG.sync.write(diff))

  // Save current render for comparison
  fs.writeFileSync(path.join(OUTPUT_DIR, baselineName), rendered)

  const totalPixels = width * height
  const mismatchPercent = (mismatchPixels / totalPixels) * 100

  return { mismatchPercent, totalPixels, mismatchPixels }
}
