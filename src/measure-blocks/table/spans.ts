/**
 * measure-blocks/table/spans.ts — Table span-grid construction and active-boundary
 * computation. Pure synchronous helpers.
 */

import type { TableRow } from '../../types.js'

export type SpanEntry = {
  originRowIdx: number
  originColStart: number
  colspan: number
  rowspan: number
}

/** Build a map from "rowIdx,colIdx" → span origin info for all positions occupied by a rowspan cell from an earlier row. */
export function buildSpanGrid(rows: TableRow[]): Map<string, SpanEntry> {
  const grid = new Map<string, SpanEntry>()
  for (let ri = 0; ri < rows.length; ri++) {
    let ci = 0
    for (const cell of rows[ri]!.cells) {
      while (grid.has(`${ri},${ci}`)) ci++
      const cs = cell.colspan ?? 1
      const rs = cell.rowspan ?? 1
      for (let r2 = ri + 1; r2 < ri + rs; r2++) {
        for (let c2 = ci; c2 < ci + cs; c2++) {
          grid.set(`${r2},${c2}`, { originRowIdx: ri, originColStart: ci, colspan: cs, rowspan: rs })
        }
      }
      ci += cs
    }
  }
  return grid
}

/**
 * Compute which column boundaries have visible vertical lines.
 * A boundary is "active" (visible) if it's not spanned by any merged cell.
 * Returns array of boundary indices (0 = between col 0 and 1, 1 = between col 1 and 2, etc.)
 * where vertical lines should be drawn.
 *
 * Example: 3 columns with a cell spanning cols 0-1 → active boundaries are [1] (only between cols 1-2)
 */
export function computeActiveBoundaries(cells: Array<{ colspan?: number }>, colCount: number): number[] {
  // Track which boundaries are "spanned" (internal to a merged cell)
  const spannedBoundaries = new Set<number>()
  let colIdx = 0

  for (const cell of cells) {
    const cs = cell.colspan ?? 1
    // Boundaries internal to this cell's span are: colIdx to colIdx + cs - 1
    // The internal boundaries are colIdx, colIdx+1, ..., colIdx+cs-2
    for (let b = colIdx; b < colIdx + cs - 1; b++) {
      spannedBoundaries.add(b)
    }
    colIdx += cs
  }

  // Active boundaries are all boundaries (0 to colCount-2) that are NOT spanned
  const activeBoundaries: number[] = []
  for (let b = 0; b < colCount - 1; b++) {
    if (!spannedBoundaries.has(b)) {
      activeBoundaries.push(b)
    }
  }

  return activeBoundaries
}
