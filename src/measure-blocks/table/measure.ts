/**
 * measure-blocks/table/measure.ts — Table cell + row measurement.
 */

import type { TableElement, ColumnDef, TableCell, TableRow, PdfDocument } from '../../types.js'
import type {
  MeasuredBlock, MeasuredTableData, MeasuredTableRow, MeasuredTableCell, PretextLine,
} from '../../types-internal.js'
import { buildFontKey } from '../../measure.js'
import { measureText, detectAndReorderRTL } from '../../measure-text.js'
import type { HyphenatorOpts } from '../../measure-text.js'
import { LINE_HEIGHT_BODY } from '../../render-utils.js'
import { measureNaturalTextWidth } from '../helpers.js'
import { buildSpanGrid, computeActiveBoundaries } from './spans.js'
import { resolveColumnWidths } from './columns.js'

export async function measureTable(
  element: TableElement,
  contentWidth: number,
  doc: PdfDocument,
  baseFontSize: number,
  hyphenatorOpts?: HyphenatorOpts,
  wordWidthCache?: Map<string, number>,
): Promise<MeasuredBlock> {
  const baseFontFamily = doc.defaultFont ?? 'Inter'
  const fontSize = element.fontSize ?? baseFontSize
  const cellPaddingH = element.cellPaddingH ?? 8
  const cellPaddingV = element.cellPaddingV ?? 6
  const borderWidth = element.borderWidth ?? 0.5
  const borderColor = element.borderColor ?? '#cccccc'
  const headerBgColor = element.headerBgColor ?? '#f5f5f5'

  // Build span occupancy grid (needed for correct colStart tracking in all passes)
  const spanGrid = buildSpanGrid(element.rows)

  // Pre-pass: measure natural widths for 'auto' columns — run all in parallel
  const hasAutoColumns = element.columns.some(c => c.width === 'auto')
  let naturalWidths: number[] | undefined
  if (hasAutoColumns) {
    naturalWidths = new Array(element.columns.length).fill(0)
    // Collect all auto-column cells first (sequential index tracking, span-grid-aware)
    type AutoCellJob = { colIdx: number; cs: number; fontWeight: 400|700; cellFontSize: number; cellFamily: string; text: string }
    const jobs: AutoCellJob[] = []
    for (let rowIdx = 0; rowIdx < element.rows.length; rowIdx++) {
      const row = element.rows[rowIdx]!
      let colIdx = 0
      for (const cell of row.cells) {
        while (spanGrid.has(`${rowIdx},${colIdx}`)) colIdx++
        const cs = cell.colspan ?? 1
        if (element.columns[colIdx]?.width === 'auto') {
          jobs.push({
            colIdx, cs,
            fontWeight: (cell.fontWeight ?? (row.isHeader ? 700 : 400)) as 400|700,
            cellFontSize: cell.fontSize ?? fontSize,
            cellFamily: cell.fontFamily ?? baseFontFamily,
            text: cell.text,
          })
        }
        colIdx += cs
      }
    }
    // Measure all auto cells in parallel
    const widths = await Promise.all(
      jobs.map(j => measureNaturalTextWidth(j.text, j.cellFontSize, j.cellFamily, j.fontWeight))
    )
    // Assign results back
    for (let i = 0; i < jobs.length; i++) {
      const { colIdx, cs } = jobs[i]!
      const cellNaturalWidth = widths[i]! + 2 * cellPaddingH
      const perColumn = cellNaturalWidth / cs
      for (let si = colIdx; si < colIdx + cs && si < element.columns.length; si++) {
        if (element.columns[si]?.width === 'auto') {
          naturalWidths[si] = Math.max(naturalWidths[si]!, perColumn)
        }
      }
    }
  }

  // Resolve column widths (passes naturalWidths for 'auto' columns)
  const columnWidths = resolveColumnWidths(element.columns, contentWidth, cellPaddingH, borderWidth, naturalWidths)

  // Determine header row count
  const headerRowCount = element.headerRows !== undefined
    ? element.headerRows
    : element.rows.filter(r => r.isHeader).length

  // Measure all rows — parallelize all cell async work across the entire table at once
  // Step 1: Compute all synchronous cell metadata (span-grid-aware colStart tracking)
  type CellMeta = {
    cell: TableCell
    row: TableRow
    rowIdx: number
    colStart: number
    cs: number
    rs: number
    col: ColumnDef
    mergedWidth: number
    fontWeight: 400 | 700
    fontFamily: string
    cellFontSize: number
    cellLineHeight: number
    cellFontKey: string
    textWidth: number
    cellDir: 'ltr' | 'rtl' | 'auto'
  }
  const allCellMeta: CellMeta[] = []
  for (let rowIdx = 0; rowIdx < element.rows.length; rowIdx++) {
    const row = element.rows[rowIdx]!
    let colStart = 0
    for (const cell of row.cells) {
      while (spanGrid.has(`${rowIdx},${colStart}`)) colStart++
      const cs = cell.colspan ?? 1
      const rs = cell.rowspan ?? 1
      const col = element.columns[colStart]!
      let mergedWidth = 0
      for (let si = colStart; si < colStart + cs && si < columnWidths.length; si++) {
        mergedWidth += columnWidths[si]!
        if (si < colStart + cs - 1) mergedWidth += borderWidth
      }
      const fontWeight = (cell.fontWeight ?? (row.isHeader ? 700 : 400)) as 400 | 700
      const fontFamily = cell.fontFamily ?? baseFontFamily
      const cellFontSize = cell.fontSize ?? fontSize
      const cellLineHeight = doc.defaultLineHeight ?? (cellFontSize * LINE_HEIGHT_BODY)
      const cellFontKey = buildFontKey(fontFamily, fontWeight, 'normal')
      const textWidth = mergedWidth - 2 * cellPaddingH - borderWidth
      const cellDir = (cell.dir ?? element.dir ?? 'auto') as 'ltr' | 'rtl' | 'auto'
      allCellMeta.push({ cell, row, rowIdx, colStart, cs, rs, col, mergedWidth, fontWeight, fontFamily, cellFontSize, cellLineHeight, cellFontKey, textWidth, cellDir })
      colStart += cs
    }
  }

  // Step 2: Run all RTL detection + text measurement in parallel across the whole table
  const cellResults = await Promise.all(
    allCellMeta.map(async (m) => {
      const { visual: cellVisualText, isRTL: cellIsRTL } = await detectAndReorderRTL(m.cell.text, m.cellDir)
      const lines = await measureText(cellVisualText, m.cellFontSize, m.fontFamily, m.fontWeight, Math.max(m.textWidth, 1), m.cellLineHeight, hyphenatorOpts, wordWidthCache)
      return { cellVisualText, cellIsRTL, lines }
    })
  )

  // Step 3: Reassemble into measuredRows with rowspan support
  // Build lookup: (rowIdx, colStart) → (meta, result)
  type CellAtCol = { meta: CellMeta; result: { cellIsRTL: boolean; lines: PretextLine[] } }
  const cellByKey = new Map<string, CellAtCol>()
  for (let i = 0; i < allCellMeta.length; i++) {
    const m = allCellMeta[i]!
    cellByKey.set(`${m.rowIdx},${m.colStart}`, { meta: m, result: cellResults[i]! })
  }

  // Sub-pass 3a: Compute raw row heights from non-spanning cells only
  const rowHeights: number[] = new Array(element.rows.length).fill(0)
  for (const { meta: m, result } of cellByKey.values()) {
    if (m.rs === 1) {
      const cellContentHeight = Math.max(result.lines.length, 1) * m.cellLineHeight
      rowHeights[m.rowIdx] = Math.max(rowHeights[m.rowIdx]!, cellContentHeight)
    }
  }
  for (let ri = 0; ri < rowHeights.length; ri++) {
    rowHeights[ri] = (rowHeights[ri] ?? 0) + 2 * cellPaddingV
  }

  // Sub-pass 3b: Expand last spanned row if spanning cell needs more space
  for (const { meta: m, result } of cellByKey.values()) {
    if (m.rs > 1) {
      const cellContentHeight = Math.max(result.lines.length, 1) * m.cellLineHeight + 2 * cellPaddingV
      let spanHeight = 0
      for (let r2 = m.rowIdx; r2 < m.rowIdx + m.rs && r2 < rowHeights.length; r2++) {
        spanHeight += rowHeights[r2]!
      }
      if (cellContentHeight > spanHeight) {
        const lastRowIdx = Math.min(m.rowIdx + m.rs - 1, rowHeights.length - 1)
        rowHeights[lastRowIdx]! += cellContentHeight - spanHeight
      }
    }
  }

  // Sub-pass 3c: Build measuredRows, inserting placeholder cells for rowspan continuations
  const measuredRows: MeasuredTableRow[] = []
  const numColumns = element.columns.length

  for (let rowIdx = 0; rowIdx < element.rows.length; rowIdx++) {
    const row = element.rows[rowIdx]!
    const rowHeight = rowHeights[rowIdx]!
    const measuredCells: MeasuredTableCell[] = []
    let hasRowspan = false

    let colCursor = 0
    while (colCursor < numColumns) {
      const spanEntry = spanGrid.get(`${rowIdx},${colCursor}`)
      if (spanEntry) {
        // Only insert ONE placeholder per span group (at the leftmost column of the span)
        if (colCursor === spanEntry.originColStart) {
          const originCell = cellByKey.get(`${spanEntry.originRowIdx},${spanEntry.originColStart}`)
          const pw = originCell?.meta.mergedWidth ?? (columnWidths[colCursor] ?? 0)
          measuredCells.push({
            lines: [], fontSize: 0, lineHeight: 0, fontKey: '', fontFamily: '',
            align: 'left', color: '#000000',
            colspan: spanEntry.colspan, mergedWidth: pw,
            isSpanPlaceholder: true,
          })
          colCursor += spanEntry.colspan
        } else {
          // Mid-span column not at origin — advance past the full span group
          colCursor += spanEntry.colspan
        }
      } else {
        const cellAtCol = cellByKey.get(`${rowIdx},${colCursor}`)
        if (!cellAtCol) { colCursor++; continue }
        const { meta: m, result: { cellIsRTL, lines } } = cellAtCol

        let spanHeight: number | undefined
        if (m.rs > 1) {
          spanHeight = 0
          for (let r2 = rowIdx; r2 < rowIdx + m.rs && r2 < rowHeights.length; r2++) {
            spanHeight += rowHeights[r2]!
          }
          hasRowspan = true
        }

        const align = m.cell.align ?? m.col.align ?? (cellIsRTL ? 'right' : 'left')
        const measuredCell: MeasuredTableCell = {
          lines,
          fontSize: m.cellFontSize,
          lineHeight: m.cellLineHeight,
          fontKey: m.cellFontKey,
          fontFamily: m.fontFamily,
          align,
          color: m.cell.color ?? '#000000',
          colspan: m.cs,
          mergedWidth: m.mergedWidth,
          isRTL: cellIsRTL,
          ...(m.cell.tabularNumbers !== undefined && { tabularNumbers: m.cell.tabularNumbers }),
          ...(m.rs > 1 ? { rowspan: m.rs } : {}),
          ...(spanHeight !== undefined ? { spanHeight } : {}),
        }
        if (m.cell.bgColor !== undefined) measuredCell.bgColor = m.cell.bgColor
        measuredCells.push(measuredCell)
        colCursor += m.cs
      }
    }

    const activeBoundaries = computeActiveBoundaries(measuredCells, numColumns)
    measuredRows.push({
      cells: measuredCells,
      height: rowHeight,
      isHeader: row.isHeader ?? false,
      activeBoundaries,
      ...(hasRowspan ? { hasRowspan: true } : {}),
    })
  }

  // Header rows are the first N rows
  const headerRows = measuredRows.slice(0, headerRowCount)
  const headerRowHeight = headerRows.reduce((sum, r) => sum + r.height, 0)

  // Total table height = sum of all row heights
  const totalHeight = measuredRows.reduce((sum, r) => sum + r.height, 0)

  const tableData: MeasuredTableData = {
    columnWidths,
    rows: measuredRows,
    headerRowCount,
    headerRowHeight,
    cellPaddingH,
    cellPaddingV,
    borderWidth,
    borderColor,
    headerBgColor,
  }

  return {
    element,
    height: totalHeight,
    lines: [],
    fontSize: 0,
    lineHeight: 0,
    fontKey: '',
    spaceAfter: element.spaceAfter ?? 0,
    spaceBefore: element.spaceBefore ?? 0,
    tableData,
  }
}
