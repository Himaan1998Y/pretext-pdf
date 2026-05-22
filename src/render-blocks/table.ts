/**
 * render-blocks/table.ts — Table rendering
 */

import { PDFDocument, rgb } from '@cantoo/pdf-lib'
import type {
  PagedBlock, FontMap, PageGeometry
} from '../types-internal.js'
import { PretextPdfError } from '../errors.js'
import {
  toPdfY,
  resolveX,
  hexToRgb,
  drawTabularText,
} from '../render-utils.js'

// ─── Table rendering ──────────────────────────────────────────────────────────

export function renderTable(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  pagedBlock: PagedBlock,
  geo: PageGeometry,
  fontMap: FontMap
): void {
  const { measuredBlock, yFromTop } = pagedBlock
  const tableData = measuredBlock.tableData!
  const startRow = pagedBlock.startRow ?? 0
  const endRow = pagedBlock.endRow ?? tableData.rows.length - tableData.headerRowCount

  const { columnWidths, cellPaddingH, cellPaddingV, borderWidth, borderColor, headerBgColor } = tableData

  // Collect the rows to render for this chunk: headers (always) + body slice
  const headerRows = tableData.rows.slice(0, tableData.headerRowCount)
  const bodyRows = tableData.rows.slice(tableData.headerRowCount)
  const chunkBodyRows = bodyRows.slice(startRow, endRow)
  const chunkRows = [...headerRows, ...chunkBodyRows]

  const chunkStartAbsY = yFromTop + geo.margins.top + geo.headerHeight
  const totalTableWidth = columnWidths.reduce((s, w) => s + w, 0)
  const totalChunkHeight = chunkRows.reduce((s, r) => s + r.height, 0)

  // ── Pass 1: Cell backgrounds ──────────────────────────────────────────────
  let rowAbsY = chunkStartAbsY
  for (const row of chunkRows) {
    let cellX = geo.margins.left
    for (const cell of row.cells) {
      if (!cell.isSpanPlaceholder) {
        const cellRenderHeight = cell.spanHeight ?? row.height
        const bgColorHex = cell.bgColor ?? (row.isHeader ? headerBgColor : undefined)
        if (bgColorHex) {
          const [r, g, b] = hexToRgb(bgColorHex)
          pdfPage.drawRectangle({ x: cellX, y: toPdfY(rowAbsY, cellRenderHeight, geo.pageHeight), width: cell.mergedWidth, height: cellRenderHeight, color: rgb(r, g, b), borderWidth: 0 })
        }
      }
      cellX += cell.mergedWidth
    }
    rowAbsY += row.height
  }

  // ── Pass 2: Grid (border-collapse model) ─────────────────────────────────
  // Draw outer border + internal lines — single-thickness at every edge.
  if (borderWidth > 0) {
    const [br, bg, bb] = hexToRgb(borderColor)
    const borderRgb = rgb(br, bg, bb)
    const tableTopPdfY = toPdfY(chunkStartAbsY, totalChunkHeight, geo.pageHeight)

    // Outer border rectangle (no fill)
    pdfPage.drawRectangle({
      x: geo.margins.left,
      y: tableTopPdfY,
      width: totalTableWidth,
      height: totalChunkHeight,
      borderColor: borderRgb,
      borderWidth,
    })

    // Internal horizontal lines (row separators, between rows, not at edges)
    // Suppressed after rows that have a spanning cell crossing into the next row
    let lineAbsY = chunkStartAbsY
    for (let ri = 0; ri < chunkRows.length - 1; ri++) {
      lineAbsY += chunkRows[ri]!.height
      if (!chunkRows[ri]!.hasRowspan) {
        const linePdfY = geo.pageHeight - lineAbsY
        pdfPage.drawLine({
          start: { x: geo.margins.left, y: linePdfY },
          end:   { x: geo.margins.left + totalTableWidth, y: linePdfY },
          thickness: borderWidth,
          color: borderRgb,
        })
      }
    }

    // Internal vertical lines (column separators, between columns, not at edges)
    // Draw per-row segments: a boundary absent from a row's activeBoundaries means a merged cell
    // spans it — a full-chunk line would cut through it. Per-row drawing preserves colspan correctness.
    // Pre-compute X positions once; convert each row's activeBoundaries to a Set for O(1) lookup.
    const colBoundaryXPositions: number[] = []
    let bx = geo.margins.left
    for (let ci = 0; ci < columnWidths.length - 1; ci++) {
      bx += columnWidths[ci]!
      colBoundaryXPositions.push(bx)
    }
    const rowBoundarySets = chunkRows.map(row => new Set(row.activeBoundaries))

    let vertRowAbsY = chunkStartAbsY
    for (let ri = 0; ri < chunkRows.length; ri++) {
      const row = chunkRows[ri]!
      const rowBoundarySet = rowBoundarySets[ri]!
      const rowTopPdfY    = geo.pageHeight - vertRowAbsY
      const rowBottomPdfY = geo.pageHeight - (vertRowAbsY + row.height)
      for (let ci = 0; ci < colBoundaryXPositions.length; ci++) {
        if (rowBoundarySet.has(ci)) {
          pdfPage.drawLine({
            start: { x: colBoundaryXPositions[ci]!, y: rowTopPdfY },
            end:   { x: colBoundaryXPositions[ci]!, y: rowBottomPdfY },
            thickness: borderWidth,
            color: borderRgb,
          })
        }
      }
      vertRowAbsY += row.height
    }
  }

  // ── Pass 3: Cell text ─────────────────────────────────────────────────────
  rowAbsY = chunkStartAbsY
  for (const row of chunkRows) {
    let cellX = geo.margins.left
    for (const cell of row.cells) {
      if (!cell.isSpanPlaceholder && cell.lines.length > 0) {
        const pdfFont = fontMap.get(cell.fontKey)
        if (!pdfFont) {
          throw new PretextPdfError('FONT_NOT_LOADED', `Table cell font "${cell.fontKey}" not found in fontMap. This is a bug — font validation should have caught this.`)
        }

        const fontHeight = pdfFont.heightAtSize(cell.fontSize)
        const [r, g, b] = hexToRgb(cell.color)
        const textAreaX = cellX + cellPaddingH
        const textAreaWidth = cell.mergedWidth - 2 * cellPaddingH

        // For rowspan cells, vertically center within the full spanHeight
        const cellRenderHeight = cell.spanHeight ?? row.height
        const totalTextHeight = cell.lines.length * cell.lineHeight
        const verticalOffset = Math.max(0, (cellRenderHeight - totalTextHeight - 2 * cellPaddingV) / 2)

        for (let li = 0; li < cell.lines.length; li++) {
          const line = cell.lines[li]!
          if (line.text === '') continue

          const lineYFromPageTop = rowAbsY + cellPaddingV + verticalOffset + li * cell.lineHeight
          const pdfY = toPdfY(lineYFromPageTop, fontHeight, geo.pageHeight)

          const trimmedText = line.text.trimEnd()
          const lineWidth = pdfFont.widthOfTextAtSize(trimmedText, cell.fontSize)
          const x = resolveX(cell.align, textAreaX, textAreaWidth, lineWidth)

          if (cell.tabularNumbers) {
            drawTabularText(pdfPage, trimmedText, x, pdfY, cell.fontSize, pdfFont, rgb(r, g, b))
          } else {
            pdfPage.drawText(trimmedText, { x, y: pdfY, size: cell.fontSize, font: pdfFont, color: rgb(r, g, b) })
          }
        }
      }

      cellX += cell.mergedWidth
    }
    rowAbsY += row.height
  }
}
