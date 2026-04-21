import type {
  MeasuredBlock, MeasuredCalloutBlock, MeasuredBlockquoteBlock,
  PagedBlock, RenderedPage, PaginatedDocument
} from './types.js'
import { PretextPdfError } from './errors.js'

const MAX_PAGES = 10_000
/** Floating-point tolerance for height comparisons. Prevents off-by-one-pixel "spill" caused by
 *  sub-point rounding when measured heights are computed via floating-point multiplication. */
const EPSILON = 0.01

// ─── Post-measurement contract enforcement ──────────────────────────────────
// validateMeasuredBlocks runs once at paginate() entry. It enforces the
// producer-side invariants that downstream helpers rely on:
//   - every callout block carries a complete, finite-valued CalloutData
//   - every blockquote block carries complete padding/border fields
// Any violation throws PAGINATION_FAILED so the root cause (measureBlock
// producing a partial shape) surfaces directly, instead of later as NaN
// arithmetic or PAGE_LIMIT_EXCEEDED.

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/**
 * Assert a callout MeasuredBlock carries complete, finite CalloutData.
 * @throws PretextPdfError('PAGINATION_FAILED') if calloutData is missing or has invalid fields.
 */
function assertValidCalloutBlock(block: MeasuredBlock): asserts block is MeasuredCalloutBlock {
  const cd = block.calloutData
  if (
    !cd ||
    !isFiniteNumber(cd.titleHeight) ||
    !isFiniteNumber(cd.paddingV) ||
    !isFiniteNumber(cd.paddingH)
  ) {
    throw new PretextPdfError(
      'PAGINATION_FAILED',
      'MeasuredBlock contract violated: callout block has missing or non-finite calloutData fields (titleHeight, paddingV, paddingH)'
    )
  }
}

/**
 * Assert a blockquote MeasuredBlock carries complete padding/border fields.
 * @throws PretextPdfError('PAGINATION_FAILED') if any field is missing or non-finite.
 */
function assertValidBlockquoteBlock(block: MeasuredBlock): asserts block is MeasuredBlockquoteBlock {
  if (
    !isFiniteNumber(block.blockquotePaddingV) ||
    !isFiniteNumber(block.blockquotePaddingH) ||
    !isFiniteNumber(block.blockquoteBorderWidth)
  ) {
    throw new PretextPdfError(
      'PAGINATION_FAILED',
      'MeasuredBlock contract violated: blockquote block has missing or non-finite padding/border fields'
    )
  }
}

/**
 * Validate producer-side invariants on every block before pagination begins.
 * Runs once per document in O(n). After this point, callout and blockquote
 * blocks can be cast to their narrowed types without defensive checks.
 * @throws PretextPdfError('PAGINATION_FAILED') on any invariant violation.
 */
function validateMeasuredBlocks(blocks: readonly MeasuredBlock[]): void {
  for (const block of blocks) {
    if (block.element.type === 'callout') {
      assertValidCalloutBlock(block)
    } else if (block.element.type === 'blockquote') {
      assertValidBlockquoteBlock(block)
    }
  }
}

/**
 * Return the title-row height to reserve for a callout block's first chunk.
 * - Non-callout blocks return 0 (loop-safe when called from a shared code path).
 * - Non-first chunks of a callout return 0 (title is only drawn on the first chunk).
 * - Callout blocks must satisfy validateMeasuredBlocks before reaching this
 *   helper; the cast below is safe because of that upstream invariant.
 */
function calloutTitleHeight(block: MeasuredBlock, isFirstChunk: boolean): number {
  if (block.element.type !== 'callout') return 0
  const cd = (block as MeasuredCalloutBlock).calloutData
  return isFirstChunk ? cd.titleHeight : 0
}

/**
 * Return the vertical padding for a blockquote or callout block.
 * Callout padding is read directly from the validated `calloutData.paddingV`.
 * Blockquote padding is read from the validated `blockquotePaddingV`.
 * The `fallback` is used only for types that opt into sharing this helper
 * without a pre-validated padding source (currently none, kept for safety).
 */
function verticalPadding(block: MeasuredBlock, fallback: number): number {
  if (block.element.type === 'callout') {
    return (block as MeasuredCalloutBlock).calloutData.paddingV
  }
  if (block.element.type === 'blockquote') {
    return (block as MeasuredBlockquoteBlock).blockquotePaddingV
  }
  return fallback
}

interface PaginateConfig {
  minOrphanLines: number  // min lines to keep at bottom of a page
  minWidowLines: number   // min lines to start at top of next page
  /**
   * Per-page height to reserve at the bottom for footnote zone.
   * Maps pageIndex (0-based) → pt to subtract from available content height.
   * Built by the two-pass orchestration in index.ts.
   */
  footnoteZones?: Map<number, number>
}

/**
 * Stage 4: Paginate — pure function.
 * Takes measured blocks + page content height → distributes blocks across pages.
 * No I/O, no side effects, fully unit-testable.
 *
 * @throws PretextPdfError('PAGE_TOO_SMALL') when pageContentHeight <= 0.
 * @throws PretextPdfError('PAGINATION_FAILED') when a callout or blockquote
 *   block violates its measurement contract (e.g. missing or non-finite fields).
 *   This is a producer-side invariant; normal inputs produced by measureBlock
 *   will not trigger it.
 * @throws PretextPdfError('PAGE_LIMIT_EXCEEDED') if pagination would exceed
 *   MAX_PAGES. Usually indicates a pagination bug or content so dense it
 *   cannot fit.
 */
export function paginate(
  blocks: MeasuredBlock[],
  pageContentHeight: number,
  config: PaginateConfig = { minOrphanLines: 2, minWidowLines: 2 }
): PaginatedDocument {
  if (pageContentHeight <= 0) {
    throw new PretextPdfError('PAGE_TOO_SMALL', `pageContentHeight is ${pageContentHeight}pt — nothing can be rendered. Check margins and page size.`)
  }

  // Enforce producer-side invariants once. After this call, callout and
  // blockquote blocks can be narrowed via cast without defensive checks.
  validateMeasuredBlocks(blocks)

  const pages: RenderedPage[] = [newPage(0)]
  let currentY = 0

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const block = blocks[blockIndex]!

    // Compute current page's effective height (reduced by footnote zone reservation)
    const currentPageIndex = pages.length - 1
    const footnoteReserve = config.footnoteZones?.get(currentPageIndex) ?? 0
    const effectivePageHeight = pageContentHeight - footnoteReserve

    // Cap spacer height so it can never cause infinite pagination
    const blockHeight = block.element.type === 'spacer'
      ? Math.min(block.height, effectivePageHeight)
      : block.height

    const effectiveBlock = blockHeight !== block.height
      ? { ...block, height: blockHeight }
      : block

    // Apply spaceBefore (only if not at the top of a page)
    if (effectiveBlock.spaceBefore > 0 && currentY > 0) {
      currentY += effectiveBlock.spaceBefore
      if (currentY >= effectivePageHeight) {
        pushNewPage(pages)
        currentY = 0
      }
    }

    // Route to appropriate paginator based on element type
    if (effectiveBlock.element.type === 'page-break') {
      // Push a new page only if we're not already at the top of a fresh page
      if (currentY > 0) {
        pushNewPage(pages)
        currentY = 0
      }
      continue
    } else if (effectiveBlock.element.type === 'table') {
      paginateTable(effectiveBlock, pages, currentY, effectivePageHeight)
    } else {
      placeBlock(effectiveBlock, pages, currentY, effectivePageHeight, config)
    }

    currentY = getCurrentY(pages)

    if (pages.length > MAX_PAGES) {
      throw new PretextPdfError('PAGE_LIMIT_EXCEEDED', `Document exceeded ${MAX_PAGES} pages. Split into multiple render() calls.`)
    }
  }

  // Remove trailing empty pages (e.g. page-break as last element)
  while (pages.length > 1 && pages[pages.length - 1]!.blocks.length === 0) {
    pages.pop()
  }

  // Collect headings for bookmark generation
  const headings: PaginatedDocument['headings'] = []
  for (const page of pages) {
    for (const block of page.blocks) {
      if (block.measuredBlock.element.type === 'heading') {
        const el = block.measuredBlock.element
        if (el.bookmark !== false) {
          headings.push({ text: el.text, level: el.level, pageIndex: page.pageIndex })
        }
      }
    }
  }

  return {
    pages,
    totalPages: pages.length,
    headings,
  }
}

// ─── Table pagination ─────────────────────────────────────────────────────────

/**
 * Paginate a table by rows. Never splits within a row.
 * On continuation pages, header rows are re-drawn at the top (handled in renderer).
 * The paginator tracks startRow/endRow into the BODY rows (non-header rows).
 */
function paginateTable(
  block: MeasuredBlock,
  pages: RenderedPage[],
  currentY: number,
  pageContentHeight: number
): void {
  const tableData = block.tableData!
  const bodyRows = tableData.rows.slice(tableData.headerRowCount)

  if (bodyRows.length === 0) {
    // Validator should have caught this — if we're here, it's a bug
    throw new PretextPdfError('VALIDATION_ERROR', 'Table has no body rows. This is a bug — validation should have caught this.')
  }

  let startRow = 0
  let pageY = currentY

  while (startRow < bodyRows.length) {
    const available = pageContentHeight - pageY
    // Always reserve space for header rows (drawn on every page chunk, including the first)
    const usableHeight = available - tableData.headerRowHeight

    // Count body rows that fit in usable height
    let rowsFit = 0
    let heightUsed = 0
    for (let ri = startRow; ri < bodyRows.length; ri++) {
      const row = bodyRows[ri]!
      if (heightUsed + row.height <= usableHeight + EPSILON) {
        rowsFit++
        heightUsed += row.height
      } else {
        break
      }
    }

    if (rowsFit === 0) {
      if (pageY > 0) {
        // Nothing fits — move to next page and retry
        pushNewPage(pages)
        pageY = 0
        continue
      } else {
        // Row is taller than the full page — force-place 1 row to prevent infinite loop
        rowsFit = 1
        heightUsed = bodyRows[startRow]!.height
      }
    }

    const endRow = startRow + rowsFit

    addToCurrentPage(pages, {
      measuredBlock: block,
      startLine: 0,
      endLine: 0,
      startRow,
      endRow,
      yFromTop: pageY,
    })

    startRow = endRow
    // pageY advances by header rows + body rows placed
    pageY += tableData.headerRowHeight + heightUsed + block.spaceAfter

    if (startRow < bodyRows.length) {
      // More rows to place — start a new page
      pushNewPage(pages)
      pageY = 0
    }
  }
}

// ─── Block placement (text elements, images, hr, spacers) ────────────────────

/**
 * Place a single block onto pages, potentially splitting it across multiple pages.
 * Mutates the pages array.
 */
function placeBlock(
  block: MeasuredBlock,
  pages: RenderedPage[],
  currentY: number,
  pageContentHeight: number,
  config: PaginateConfig
): void {
  const remainingSpace = pageContentHeight - currentY
  const spaceAfter = block.spaceAfter
  const totalHeight = block.height + spaceAfter

  // ── Fast path: block fits entirely on current page ──────────────────────────
  if (totalHeight <= remainingSpace + EPSILON) {
    addToCurrentPage(pages, {
      measuredBlock: block,
      startLine: 0,
      endLine: block.lines.length,
      yFromTop: currentY,
    })
    return
  }

  // ── Spacer overflow: just start a new page ───────────────────────────────────
  if (block.element.type === 'spacer') {
    pushNewPage(pages)
    addToCurrentPage(pages, {
      measuredBlock: block,
      startLine: 0,
      endLine: 0,
      yFromTop: 0,
    })
    return
  }

  // ── Images and HR: never split ───────────────────────────────────────────────
  if (block.element.type === 'image' || block.element.type === 'svg' || block.element.type === 'hr') {
    if (currentY > 0) {
      pushNewPage(pages)
    }
    addToCurrentPage(pages, {
      measuredBlock: block,
      startLine: 0,
      endLine: 0,
      yFromTop: 0,
    })
    return
  }

  // ── keepTogether or headings: move to next page if they don't fit ────────────
  // At this point block.element is paragraph | heading | list-item | code | blockquote
  const el = block.element
  // List items use the parent ListElement — keepTogether not applicable (always false)
  // Multi-column blocks are always keepTogether — no mid-column page breaks
  const keepTogether = (block.floatData !== undefined)
    ? true  // Float image blocks are atomic — never split across pages
    : (block.floatGroupData !== undefined)
    ? true  // Float group blocks are atomic — never split across pages
    : (block.columnData !== undefined)
    ? true  // Force keepTogether for multi-column blocks
    : (el.type === 'comment' || el.type === 'form-field')
      ? true  // Comment/annotation and form-field blocks are kept together
      : el.type === 'heading'
        ? (el.keepTogether ?? true)
        : (el.type === 'paragraph' || el.type === 'rich-paragraph' || el.type === 'code' || el.type === 'blockquote')
          ? (el.keepTogether ?? false)
          : el.type === 'callout'
            ? (el.keepTogether ?? false)
            : false  // list items (el.type === 'list') — never keepTogether

  if (keepTogether) {
    if (currentY > 0) {
      pushNewPage(pages)
    }
    if (block.height <= pageContentHeight) {
      addToCurrentPage(pages, {
        measuredBlock: block,
        startLine: 0,
        endLine: block.lines.length,
        yFromTop: 0,
      })
      return
    }
    // Falls through: keepTogether block is larger than one page — must split
  }

  // ── Must split: block spans more than one page ───────────────────────────────
  splitBlock(block, pages, currentY, pageContentHeight, config)
}

/**
 * Split a block across the current page and subsequent pages.
 * Applies orphan/widow control.
 */
function splitBlock(
  block: MeasuredBlock,
  pages: RenderedPage[],
  currentY: number,
  pageContentHeight: number,
  config: PaginateConfig
): void {
  let remainingLines = [...block.lines]
  let remainingStartIndex = 0
  let isFirstChunk = true
  let currentPageY = currentY

  // Code blocks have visual padding that must be reserved when computing line capacity.
  // Reserve topPad on the first chunk, bottomPad on the last chunk only.
  // Middle chunks have no padding drawn, so we don't reserve any.
  // We don't know if a chunk is "last" until we count lines, so we always reserve bottomPad
  // unless this is provably not the last chunk (remaining > linesInChunk after computation).
  // Code, blockquote, and callout all have visual padding that must be reserved.
  // Callout padding lives under calloutData (invariant enforced by calloutTitleHeight).
  const codePad = block.element.type === 'code'
    ? (block.codePadding ?? 0)
    : (block.element.type === 'blockquote' || block.element.type === 'callout')
      ? verticalPadding(block, 0)
      : 0

  while (remainingLines.length > 0) {
    const available = pageContentHeight - currentPageY
    const topPad = (codePad > 0 && isFirstChunk) ? codePad : 0
    // Reserve bottom padding only if there are potentially lines remaining after this chunk.
    // Use codePad as reservation — if it turns out this IS the last chunk, the padding fits.
    // If it's a middle chunk, we conservatively reserve it to avoid overflow, then correct below.
    const bottomPadReserve = codePad
    const availableForLines = available - topPad - bottomPadReserve - calloutTitleHeight(block, isFirstChunk)

    // Rich paragraphs may have variable line heights when spans use different font sizes
    let linesInChunk: number
    if (block.element.type === 'rich-paragraph' && block.richLines) {
      linesInChunk = countRichLinesInHeight(block.richLines, remainingStartIndex, availableForLines)
    } else {
      linesInChunk = countLinesInHeight(block.lineHeight, availableForLines)
    }

    if (linesInChunk <= 0) {
      pushNewPage(pages)
      currentPageY = 0
      continue
    }

    const totalRemainingLines = remainingLines.length

    // ── Orphan check: too few lines on this page ─────────────────────────────
    if (linesInChunk < config.minOrphanLines && totalRemainingLines > linesInChunk) {
      if (isFirstChunk && currentPageY > 0) {
        pushNewPage(pages)
        currentPageY = 0
        // isFirstChunk stays true — no lines placed yet, topPad must still be reserved
        continue
      }
    }

    // ── Widow check: too few lines would carry to next page ──────────────────
    const linesAfterChunk = totalRemainingLines - linesInChunk
    if (
      linesAfterChunk > 0 &&
      linesAfterChunk < config.minWidowLines &&
      linesInChunk > config.minWidowLines
    ) {
      const reduction = config.minWidowLines - linesAfterChunk
      linesInChunk = Math.max(config.minOrphanLines, linesInChunk - reduction)
    }

    linesInChunk = Math.min(linesInChunk, totalRemainingLines)

    if (linesInChunk > 0) {
      addToCurrentPage(pages, {
        measuredBlock: block,
        startLine: remainingStartIndex,
        endLine: remainingStartIndex + linesInChunk,
        yFromTop: currentPageY,
      })
    }

    remainingStartIndex += linesInChunk
    remainingLines = remainingLines.slice(linesInChunk)

    if (remainingLines.length > 0) {
      pushNewPage(pages)
      currentPageY = 0
      isFirstChunk = false
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newPage(pageIndex: number): RenderedPage {
  return { pageIndex, blocks: [] }
}

function pushNewPage(pages: RenderedPage[]): void {
  pages.push(newPage(pages.length))
}

function addToCurrentPage(pages: RenderedPage[], block: PagedBlock): void {
  const currentPage = pages[pages.length - 1]
  if (currentPage) {
    currentPage.blocks.push(block)
  }
}

/** Count how many lines of a given lineHeight fit in availableHeight */
function countLinesInHeight(lineHeight: number, availableHeight: number): number {
  if (lineHeight <= 0) return 0
  return Math.floor(availableHeight / lineHeight)
}

/** Get the Y position after all blocks on the current last page */
export function getCurrentY(pages: RenderedPage[]): number {
  const lastPage = pages[pages.length - 1]
  if (!lastPage || lastPage.blocks.length === 0) return 0

  let maxY = 0
  for (const pagedBlock of lastPage.blocks) {
    const block = pagedBlock.measuredBlock
    const el = block.element

    let blockBottom: number

    if (el.type === 'table' && block.tableData && pagedBlock.startRow !== undefined && pagedBlock.endRow !== undefined) {
      // Table block: height = header rows + body rows placed (headers drawn on every chunk)
      const bodyRows = block.tableData.rows.slice(block.tableData.headerRowCount)
      const placedRows = bodyRows.slice(pagedBlock.startRow, pagedBlock.endRow)
      const bodyHeight = placedRows.reduce((sum, r) => sum + r.height, 0)
      blockBottom = pagedBlock.yFromTop + block.tableData.headerRowHeight + bodyHeight + block.spaceAfter

    } else if (el.type === 'spacer') {
      blockBottom = pagedBlock.yFromTop + block.height

    } else if (el.type === 'image' || el.type === 'svg' || el.type === 'hr') {
      blockBottom = pagedBlock.yFromTop + block.height + block.spaceAfter

    } else if (el.type === 'code') {
      // Code blocks include padding in their height
      const lineCount = pagedBlock.endLine - pagedBlock.startLine
      const padding = block.codePadding ?? 8
      const isFirstChunk = pagedBlock.startLine === 0
      const isLastChunk = pagedBlock.endLine === block.lines.length
      const paddingTop = isFirstChunk ? padding : 0
      const paddingBottom = isLastChunk ? padding : 0
      blockBottom = pagedBlock.yFromTop +
        lineCount * block.lineHeight +
        paddingTop + paddingBottom +
        block.spaceAfter

    } else if (el.type === 'blockquote' || el.type === 'callout') {
      // Blockquote/callout blocks include vertical padding in their height (same pattern as code)
      const lineCount = pagedBlock.endLine - pagedBlock.startLine
      const paddingV = verticalPadding(block, 10)
      const isFirstChunk = pagedBlock.startLine === 0
      const isLastChunk = pagedBlock.endLine === block.lines.length
      const paddingTop = isFirstChunk ? paddingV : 0
      const paddingBottom = isLastChunk ? paddingV : 0
      blockBottom = pagedBlock.yFromTop +
        calloutTitleHeight(block, isFirstChunk) +
        lineCount * block.lineHeight +
        paddingTop + paddingBottom +
        block.spaceAfter

    } else if (el.type === 'rich-paragraph' && block.richLines) {
      // Rich paragraphs may have variable line heights when spans use different font sizes
      const visibleRichLines = block.richLines.slice(pagedBlock.startLine, pagedBlock.endLine)
      const contentHeight = visibleRichLines.reduce((sum, rl) => sum + rl.lineHeight, 0)
      blockBottom = pagedBlock.yFromTop + contentHeight + block.spaceAfter

    } else {
      // Text elements (paragraph, heading, list items)
      const lineCount = pagedBlock.endLine - pagedBlock.startLine
      blockBottom = pagedBlock.yFromTop +
        lineCount * block.lineHeight +
        block.spaceAfter
    }

    if (blockBottom > maxY) maxY = blockBottom
  }
  return maxY
}

/**
 * Count how many lines from richLines array fit in the available height.
 * Uses greedy accumulation of per-line heights (which may vary due to per-span fontSize).
 */
function countRichLinesInHeight(
  richLines: import('./types.js').RichLine[],
  startIdx: number,
  available: number
): number {
  let count = 0
  let used = 0
  for (let i = startIdx; i < richLines.length; i++) {
    const h = richLines[i]!.lineHeight
    if (used + h <= available + EPSILON) { count++; used += h }
    else break
  }
  return count
}
