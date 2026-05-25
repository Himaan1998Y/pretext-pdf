/**
 * Vector asset loader — extracted from src/assets.ts in v1.6.0 commit 14/16.
 *
 * Two-phase load for SVG / QR / barcode / chart elements:
 *   Phase A — generate svg + rasterize to PNG in bounded-parallel (CPU/I/O,
 *             safe to fan out)
 *   Phase B — embed PNGs sequentially because pdf-lib xref mutation is not
 *             concurrency-safe
 *
 * One failed asset must not block other embeds (error isolation matches
 * prior behavior). SVG failures propagate; QR/barcode/chart failures warn
 * and leave the slot blank.
 */
import { PDFDocument } from '@cantoo/pdf-lib'
import type { PdfDocument, SvgElement } from '../../types.js'
import type { ImageMap } from '../../types-internal.js'
import { PretextPdfError } from '../../errors.js'
import { resolveSvgContent } from '../svg/resolve-content.js'
import { resolveSvgDimensions } from '../svg/dimensions.js'
import { rasterizeSvgToPng } from '../svg/rasterize.js'
import { generateQrSvg } from '../generators/qr.js'
import { generateBarcodeSvg } from '../generators/barcode.js'
import { generateChartSvg } from '../generators/chart.js'

/** Maximum number of vector-asset rasterization tasks allowed to run in parallel. */
export const VECTOR_RASTER_CONCURRENCY = 4

/**
 * Bounded-parallel allSettled. Runs at most `limit` tasks concurrently and
 * collects per-task fulfilled/rejected results in the original order.
 */
export async function allSettledWithLimit<T>(
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

export async function loadVectorAssets(
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
