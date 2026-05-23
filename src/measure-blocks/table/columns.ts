/**
 * measure-blocks/table/columns.ts — Column-width resolution for tables.
 *
 * resolveColumnWidths is exported by name — it's part of the package's public
 * shape because tests and external consumers import it directly.
 */

import type { ColumnDef } from '../../types.js'
import { PretextPdfError } from '../../errors.js'

/**
 * Resolve column width definitions to concrete pt values.
 * Fixed widths are used as-is. Star widths ('2*', '*') share the remaining space.
 * 'auto' columns use naturalWidths[i] (measured content width) — caller must pre-compute these.
 *
 * naturalWidths is required if any column uses 'auto'. It maps column index → natural text width in pt
 * (the minimum width needed to display cell text on one line, including cellPaddingH on both sides).
 */
export function resolveColumnWidths(
  columns: ColumnDef[],
  contentWidth: number,
  cellPaddingH: number,
  borderWidth: number,
  naturalWidths?: number[]
): number[] {
  const MIN_COLUMN_WIDTH = cellPaddingH * 2 + borderWidth * 2 + 4 // minimum usable pt

  let totalFixed = 0
  let totalStars = 0
  let totalAutoNatural = 0
  let autoCount = 0

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]!
    if (typeof col.width === 'number') {
      totalFixed += col.width
    } else if (col.width === 'auto') {
      // Auto columns reserve their natural width from remaining space
      const natural = naturalWidths?.[i] ?? MIN_COLUMN_WIDTH
      totalAutoNatural += natural
      autoCount++
    } else {
      // '*' → 1 star, '2*' → 2 stars, '1.5*' → 1.5 stars
      const match = col.width.match(/^(\d*\.?\d*)?\*$/)
      const stars = (match && match[1]) ? parseFloat(match[1]) : 1
      totalStars += stars
    }
  }

  const remaining = contentWidth - totalFixed

  if (remaining < -0.01) {
    throw new PretextPdfError(
      'TABLE_COLUMN_OVERFLOW',
      `Table fixed column widths (${totalFixed.toFixed(1)}pt) exceed content width (${contentWidth.toFixed(1)}pt). ` +
      `Reduce column widths or page margins.`
    )
  }

  // How much space is available after fixed columns
  const availableForFlexible = Math.max(0, remaining)

  // Auto columns claim their natural width (capped at available space).
  // Star columns share whatever remains after auto columns.
  // If auto columns overflow, they get proportional shares of available space.
  const autoFits = totalAutoNatural <= availableForFlexible
  const autoUsed = autoFits ? totalAutoNatural : availableForFlexible
  const availableForStars = availableForFlexible - autoUsed
  const starUnit = totalStars > 0 ? Math.max(0, availableForStars) / totalStars : 0

  return columns.map((col, i) => {
    let resolved: number
    if (typeof col.width === 'number') {
      resolved = col.width
    } else if (col.width === 'auto') {
      const natural = naturalWidths?.[i] ?? MIN_COLUMN_WIDTH
      if (autoFits) {
        resolved = natural
      } else {
        // Constrained: proportional share based on natural widths
        resolved = totalAutoNatural > 0
          ? (natural / totalAutoNatural) * availableForFlexible
          : MIN_COLUMN_WIDTH
      }
    } else {
      const match = col.width.match(/^(\d*\.?\d*)?\*$/)
      const stars = (match && match[1]) ? parseFloat(match[1]) : 1
      resolved = stars * starUnit
    }

    if (resolved < MIN_COLUMN_WIDTH) {
      throw new PretextPdfError(
        'TABLE_COLUMN_TOO_NARROW',
        `Table column ${i} resolved to ${resolved.toFixed(1)}pt, minimum is ${MIN_COLUMN_WIDTH.toFixed(1)}pt. ` +
        `Increase the column width or reduce cellPaddingH/borderWidth.`
      )
    }

    return resolved
  })
}
