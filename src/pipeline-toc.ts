import type { PdfDocument } from './types-public/index.js'
import type { MeasuredBlock, TocEntryElement } from './types-internal.js'
import { paginate } from './paginate.js'

/**
 * Two-pass TOC entry building, with a page-number correction pass.
 *
 * Pass 1 (draft): paginate with the TOC as a zero-height placeholder, to
 * learn which headings exist (text/level/order) and build correctly-sized
 * TOC entry blocks (their height depends only on entry count/text — the
 * page-number column has a fixed reserved width regardless of digit count,
 * so it doesn't need a correct number yet).
 *
 * Pass 2 (real): re-paginate with those real (now correctly-sized) TOC
 * blocks spliced in, and use each heading's page index from THIS pass to
 * correct the page numbers already baked into the pass-1 entry blocks.
 *
 * Why pass 2 is necessary: the draft pass's zero-height TOC placeholder
 * only produces correct page numbers if the real TOC ends up needing zero
 * extra pages beyond the placeholder — true for a short single-page TOC by
 * coincidence, false as soon as the TOC itself needs 2+ real pages (e.g. a
 * document with 30+ headings). Every heading page number recorded in the
 * draft pass then undercounts by exactly however many extra pages the real
 * TOC consumes, since the draft pass assumed the TOC took no space at all.
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

  // Pass 1: paginate without real TOC content to collect heading identities
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
  const splicedBlocks = [
    ...measuredBlocks.slice(0, tocIndex),
    ...tocEntryBlocks,
    ...measuredBlocks.slice(tocIndex + 1),
  ]

  // Pass 2: re-paginate with the real TOC blocks in place, then correct the
  // page numbers already drawn into tocEntryBlocks. Only the printed digits
  // change (mutating in place) — entry block height/layout is untouched, so
  // this doesn't require re-measuring or re-splicing anything.
  const realPaginatedDoc = paginate(splicedBlocks, contentHeight)
  const minLevel = tocElement.minLevel ?? 1
  const maxLevel = tocElement.maxLevel ?? 3
  const realHeadingsInRange = realPaginatedDoc.headings.filter(
    h => h.level >= minLevel && h.level <= maxLevel
  )
  let i = 0
  for (const block of tocEntryBlocks) {
    const el = block.element as TocEntryElement
    if (el.pageNumber === -1) continue // the title block, not a heading entry
    const real = realHeadingsInRange[i]
    i++
    if (real === undefined) continue // defensive: same headings, same order — should never happen
    const pageStr = String(real.pageIndex + 1)
    el.pageNumber = real.pageIndex + 1
    if (block.tocEntryData) block.tocEntryData.pageStr = pageStr
  }

  return splicedBlocks
}