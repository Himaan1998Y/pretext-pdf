import type { PdfDocument } from './types-public.js'
import type { MeasuredBlock } from './types-internal.js'
import { paginate } from './paginate.js'

/**
 * Two-pass TOC entry building.
 *
 * Pass 1: draft pagination to collect heading page numbers.
 * Splices real TOC entry blocks into measuredBlocks at the placeholder index.
 * Returns the updated measuredBlocks array (new reference, original untouched).
 */
export async function runTocTwoPass(
  measuredBlocks: MeasuredBlock[],
  doc: Pick<PdfDocument, 'content' | 'defaultFont'> & Partial<PdfDocument>,
  contentWidth: number,
  contentHeight: number,
): Promise<MeasuredBlock[]> {
  const tocIndex = doc.content.findIndex(el => el.type === 'toc')
  if (tocIndex === -1) return measuredBlocks

  const tocElement = doc.content[tocIndex]
  if (!tocElement || tocElement.type !== 'toc') throw new Error('TOC element type mismatch')

  // Pass 1: paginate without real TOC content to collect heading page numbers
  const draftPaginatedDoc = paginate(measuredBlocks, contentHeight)

  // Dynamic import preserves lazy-load semantics (measure.ts can be heavy)
  const { buildTocEntryBlocks } = await import('./measure.js')

  const tocEntryBlocks = await buildTocEntryBlocks(
    draftPaginatedDoc.headings,
    tocElement,
    contentWidth,
    doc as PdfDocument,
  )

  // Splice TOC entries in place of the placeholder (zero-height) block at tocIndex
  return [
    ...measuredBlocks.slice(0, tocIndex),
    ...tocEntryBlocks,
    ...measuredBlocks.slice(tocIndex + 1),
  ]
}