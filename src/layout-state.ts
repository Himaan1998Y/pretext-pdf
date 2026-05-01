/**
 * Layout inspection API — run the pipeline up to pagination without rendering.
 * @internal Not part of the stable public API. Subject to change without a semver bump.
 */
import { PDFDocument } from '@cantoo/pdf-lib'
import type { PdfDocument, RenderOptions } from './types-public.js'
import type { MeasuredBlock, PaginatedDocument, PageGeometry, FontMap, ImageMap } from './types-internal.js'
import { stageValidate, stageInit, stageLoadAssets, stageFinalizeGeo, stageMeasure, stagePaginate } from './pipeline.js'
import { PretextPdfError } from './errors.js'

export interface LayoutState {
  doc: PdfDocument
  measuredBlocks: MeasuredBlock[]
  paginatedDoc: PaginatedDocument
  pdfDoc: PDFDocument
  fontMap: FontMap
  imageMap: ImageMap
  pageGeometry: PageGeometry
}

export interface LayoutTrace {
  document: { contentCount: number }
  measuredBlocks: Array<{ type: string; height: number; isRTL: boolean }>
  pages: Array<{ blockCount: number }>
}

/**
 * Run pipeline stages 1-4 (validate → init → loadAssets → measure → paginate)
 * without rendering. Returns intermediate state for inspection and testing.
 */
export async function prepareLayoutState(doc: PdfDocument, options?: RenderOptions): Promise<LayoutState> {
  if (typeof Intl?.Segmenter !== 'function') {
    throw new PretextPdfError('RENDER_FAILED', 'Intl.Segmenter is not available in this runtime. Upgrade to Node.js 18+ or set NODE_ICU_DATA to a full-icu data file.')
  }
  if (typeof OffscreenCanvas === 'undefined' && typeof window === 'undefined') {
    try {
      const { installNodePolyfill } = await import('./node-polyfill.js')
      await installNodePolyfill()
    } catch (e) {
      throw new PretextPdfError('CANVAS_UNAVAILABLE', `Failed to initialize Node.js canvas polyfill: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  stageValidate(doc, options)

  const { pdfDoc, geo: partialGeo, defaultFont } = await stageInit(doc)
  const { fontMap, imageMap } = await stageLoadAssets(doc, pdfDoc, partialGeo.contentWidth, options?.plugins)
  const geo = await stageFinalizeGeo(doc, partialGeo, defaultFont)
  const measuredBlocks = await stageMeasure(doc, geo.contentWidth, imageMap, geo.contentHeight, options?.plugins)
  const paginatedDoc = stagePaginate(measuredBlocks, geo.contentHeight, doc)

  return { doc, measuredBlocks, paginatedDoc, pdfDoc, fontMap, imageMap, pageGeometry: geo }
}

/**
 * Produce a JSON-serializable summary of a LayoutState for debugging and contracts.
 */
export function summarizeLayoutState(state: LayoutState): LayoutTrace {
  return {
    document: {
      contentCount: state.doc.content.length,
    },
    measuredBlocks: state.measuredBlocks.map(block => ({
      type: block.element.type,
      height: block.height,
      isRTL: 'dir' in block.element && (block.element as { dir?: string }).dir === 'rtl',
    })),
    pages: state.paginatedDoc.pages.map(page => ({
      blockCount: page.blocks.length,
    })),
  }
}
