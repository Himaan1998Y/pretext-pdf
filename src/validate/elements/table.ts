/**
 * validate/elements/table.ts — Table element validator.
 * Extracted from src/validate.ts (#11a).
 */
import type { ContentElement } from '../../types.js'
import { PretextPdfError } from '../../errors.js'
import { ALLOWED_PROPS_SUB } from '../../allowed-props.js'
import {
  HEX_COLOR_REGEX,
  STAR_WIDTH_REGEX,
  adaptTableStructure,
  assertUnknownProps,
  withCycleGuard,
  type ValidationContext,
} from '../helpers.js'

export function validateTable(
  el: Extract<ContentElement, { type: 'table' }>,
  prefix: string,
  depth: number,
  ctx: ValidationContext,
): void {
  // Auto-adapt: detect pdfmake structure {headers, rows} and convert to {columns, rows[{cells}]}
  const adapted = adaptTableStructure(el)
  if (adapted !== el) {
    Object.assign(el, adapted)
  }

  if (!Array.isArray(el.columns) || el.columns.length === 0) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'columns' must be a non-empty array. Expected structure: {columns: [{width: '*'|number}], rows: [{cells: [{text: 'string'}]}]}`)
  }
  if (!Array.isArray(el.rows) || el.rows.length === 0) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'rows' must be a non-empty array. Expected: rows: [{isHeader?: true, cells: [{text: 'string'}]}]`)
  }

  const colCount = el.columns.length
  for (let ci = 0; ci < el.columns.length; ci++) {
    const col = el.columns[ci]!
    // Strict: validate column def properties
    if (ctx.strict) {
      assertUnknownProps(col, ALLOWED_PROPS_SUB['column-def'], `${prefix} (table).columns[${ci}]`, ctx.errors)
    }
    if (typeof col.width === 'number') {
      if (col.width <= 0 || !isFinite(col.width)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): columns[${ci}].width must be a positive number. Got: ${col.width}`)
      }
    } else if (typeof col.width === 'string') {
      if (col.width !== 'auto' && !STAR_WIDTH_REGEX.test(col.width)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): columns[${ci}].width must be a positive number, proportional string like '2*' or '*', or 'auto'. Got: '${col.width}'`)
      }
      if (col.width !== 'auto') {
        const multiplier = parseFloat(col.width)
        if (!isNaN(multiplier) && multiplier > 1000) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): columns[${ci}].width multiplier ${multiplier} exceeds maximum 1000`)
        }
      }
    } else {
      throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): columns[${ci}].width must be a number or string like '2*' or 'auto'`)
    }
    if (col.align !== undefined && !['left', 'center', 'right'].includes(col.align)) {
      throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): columns[${ci}].align must be 'left', 'center', or 'right'`)
    }
  }

  // Validate header row count
  const headerRowCount = el.headerRows !== undefined
    ? el.headerRows
    : el.rows.filter(r => r.isHeader).length
  if (headerRowCount > el.rows.length) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): headerRows (${headerRowCount}) exceeds total row count (${el.rows.length})`)
  }

  // Build span occupancy grid for colspan validation (rowspan cells occupy future rows)
  const spanOccupied = new Set<string>()
  for (let ri = 0; ri < el.rows.length; ri++) {
    const row = el.rows[ri]!
    let ci = 0
    for (const cell of row.cells) {
      while (spanOccupied.has(`${ri},${ci}`)) ci++
      const cs = cell.colspan ?? 1
      const rs = cell.rowspan ?? 1
      for (let r2 = ri + 1; r2 < ri + rs; r2++) {
        for (let c2 = ci; c2 < ci + cs; c2++) {
          spanOccupied.add(`${r2},${c2}`)
        }
      }
      ci += cs
    }
  }

  // Wrap rows/cells walk with cycle guard so a self-referential row or
  // cell array is rejected before the per-cell validators run.
  withCycleGuard(ctx.seen, el, depth + 1, prefix, () => {
    for (let ri = 0; ri < el.rows.length; ri++) {
      const row = el.rows[ri]!
      if (!Array.isArray(row.cells)) {
        throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): rows[${ri}].cells must be an array`)
      }
      // Guard each row so a cycle through row.cells → row is also detected
      withCycleGuard(ctx.seen, row, depth + 2, `${prefix}.rows[${ri}]`, () => {

      // Count how many columns in this row are occupied by rowspan cells from above
      let occupiedCols = 0
      for (let ci = 0; ci < colCount; ci++) {
        if (spanOccupied.has(`${ri},${ci}`)) occupiedCols++
      }

      // Validate colspan sum equals colCount minus occupied columns
      let colspanSum = 0
      for (let cellI = 0; cellI < row.cells.length; cellI++) {
        const cell = row.cells[cellI]!
        const cs = cell.colspan ?? 1
        if (typeof cs !== 'number' || cs < 1 || !Number.isInteger(cs)) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): rows[${ri}].cells[${cellI}].colspan must be a positive integer`)
        }
        colspanSum += cs
        const rs = cell.rowspan ?? 1
        if (typeof rs !== 'number' || rs < 1 || !Number.isInteger(rs)) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): rows[${ri}].cells[${cellI}].rowspan must be a positive integer`)
        }
      }
      if (colspanSum !== colCount - occupiedCols) {
        throw new PretextPdfError('COLSPAN_OVERFLOW', `${prefix} (table): rows[${ri}] colspan sum is ${colspanSum} but expected ${colCount - occupiedCols} (${colCount} columns minus ${occupiedCols} occupied by rowspan). Sum of explicit cell colspans must cover only unoccupied columns.`)
      }

      // Strict: validate row and column defs
      if (ctx.strict) {
        assertUnknownProps(row, ALLOWED_PROPS_SUB['table-row'], `${prefix}.rows[${ri}]`, ctx.errors)
      }

      for (let cellI = 0; cellI < row.cells.length; cellI++) {
        const cell = row.cells[cellI]!
        // Strict: validate cell properties
        if (ctx.strict) {
          assertUnknownProps(cell, ALLOWED_PROPS_SUB['table-cell'], `${prefix}.rows[${ri}].cells[${cellI}]`, ctx.errors)
        }
        if (typeof cell.text !== 'string') {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): rows[${ri}].cells[${cellI}].text must be a string`)
        }
        if (cell.fontFamily !== undefined && (typeof cell.fontFamily !== 'string' || cell.fontFamily.trim() === '')) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): rows[${ri}].cells[${cellI}].fontFamily must be a non-empty string`)
        }
        if (cell.fontWeight !== undefined && ![400, 700].includes(cell.fontWeight)) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): rows[${ri}].cells[${cellI}].fontWeight must be 400 or 700`)
        }
        if (cell.fontSize !== undefined && (typeof cell.fontSize !== 'number' || cell.fontSize <= 0 || !isFinite(cell.fontSize))) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): rows[${ri}].cells[${cellI}].fontSize must be a positive finite number`)
        }
        if (cell.color !== undefined && !HEX_COLOR_REGEX.test(cell.color)) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): rows[${ri}].cells[${cellI}].color must be a 6-digit hex string`)
        }
        if (cell.bgColor !== undefined && !HEX_COLOR_REGEX.test(cell.bgColor)) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): rows[${ri}].cells[${cellI}].bgColor must be a 6-digit hex string`)
        }
        if (cell.dir !== undefined && !['ltr', 'rtl', 'auto'].includes(cell.dir)) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): rows[${ri}].cells[${cellI}].dir must be 'ltr', 'rtl', or 'auto'`)
        }
        if (cell.align !== undefined && !['left', 'center', 'right'].includes(cell.align)) {
          throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): rows[${ri}].cells[${cellI}].align must be 'left', 'center', or 'right'`)
        }
      }

      })
    }
  })

  if (el.dir !== undefined && !['ltr', 'rtl', 'auto'].includes(el.dir)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'dir' must be 'ltr', 'rtl', or 'auto'`)
  }
  if (el.borderColor !== undefined && !HEX_COLOR_REGEX.test(el.borderColor)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'borderColor' must be a 6-digit hex string`)
  }
  if (el.headerBgColor !== undefined && !HEX_COLOR_REGEX.test(el.headerBgColor)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'headerBgColor' must be a 6-digit hex string`)
  }
  if (el.fontSize !== undefined && (typeof el.fontSize !== 'number' || el.fontSize <= 0 || !isFinite(el.fontSize))) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'fontSize' must be a positive finite number`)
  }
  if (el.borderWidth !== undefined && (typeof el.borderWidth !== 'number' || el.borderWidth < 0 || el.borderWidth > 50)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'borderWidth' must be a non-negative number <= 50`)
  }
  if (el.cellPaddingH !== undefined && (typeof el.cellPaddingH !== 'number' || el.cellPaddingH < 0 || el.cellPaddingH > 200)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'cellPaddingH' must be a non-negative number <= 200`)
  }
  if (el.cellPaddingV !== undefined && (typeof el.cellPaddingV !== 'number' || el.cellPaddingV < 0 || el.cellPaddingV > 200)) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'cellPaddingV' must be a non-negative number <= 200`)
  }
  if (el.spaceAfter !== undefined && (typeof el.spaceAfter !== 'number' || el.spaceAfter < 0 || !isFinite(el.spaceAfter))) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'spaceAfter' must be a non-negative finite number`)
  }
  if (el.spaceBefore !== undefined && (typeof el.spaceBefore !== 'number' || el.spaceBefore < 0 || !isFinite(el.spaceBefore))) {
    throw new PretextPdfError('VALIDATION_ERROR', `${prefix} (table): 'spaceBefore' must be a non-negative finite number`)
  }
}
