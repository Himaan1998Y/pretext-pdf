/** Normalizers and structural helpers for pdfmake → pretext-pdf translation. */

import type {
  TableElement,
  ColumnDef,
  TableRow,
  HeaderFooterSpec,
  Margins,
} from '../types.js'

type Mutable<T> = { -readonly [K in keyof T]: T[K] }
import { type PdfmakeNode, type PdfmakeObjectNode, type PdfmakeStyle, type TranslateCtx } from './pdfmake-types.js'

/** Collect flat text from a pdfmake child-node array, recursing into nested arrays. */
export function extractFlatText(children: PdfmakeNode[], ctx: TranslateCtx): string {
  const buf: string[] = []
  for (const c of children) {
    if (typeof c === 'string') { buf.push(c); continue }
    if (typeof c.text === 'string') { buf.push(c.text); continue }
    if (Array.isArray(c.text)) buf.push(extractFlatText(c.text, ctx))
  }
  return buf.join('')
}

export function translateTable(t: NonNullable<PdfmakeObjectNode['table']>, ctx: TranslateCtx): TableElement {
  const colCount = t.body[0]?.length ?? 0
  const widths = t.widths ?? new Array(colCount).fill('*')
  const columns: ColumnDef[] = widths.map((w): ColumnDef => {
    if (typeof w === 'number') return { width: w }
    if (w === '*') return { width: '1*' }
    if (w === 'auto') return { width: 'auto' as const }
    if (typeof w === 'string' && /^\d*\.?\d+\*$/.test(w)) return { width: w as `${number}*` }
    return { width: '1*' }
  })

  const headerRows = t.headerRows ?? 0
  const rows: TableRow[] = t.body.map((row, idx) => {
    const isHeader = idx < headerRows
    const cells = row.map(cell => {
      if (typeof cell === 'string') return { text: cell, ...(isHeader ? { fontWeight: 700 as const } : {}) }
      if (cell && typeof cell === 'object') {
        const styleNames = normalizeStyleNames(cell.style)
        const merged = mergeStyles(ctx, styleNames, cell)
        const text = typeof cell.text === 'string' ? cell.text : (Array.isArray(cell.text) ? extractFlatText(cell.text, ctx) : '')
        const tcell: { text: string; fontWeight?: 400 | 700; color?: string; align?: 'left' | 'center' | 'right'; fontSize?: number } = { text }
        if (merged.bold || isHeader) tcell.fontWeight = 700
        if (merged.color) tcell.color = merged.color
        if (merged.alignment && merged.alignment !== 'justify') tcell.align = merged.alignment
        if (merged.fontSize !== undefined) tcell.fontSize = merged.fontSize
        return tcell
      }
      return { text: '' }
    })
    return isHeader ? { isHeader: true, cells } : { cells }
  })

  return { type: 'table', columns, rows }
}

export function pdfmakeAlignToPretext(a: PdfmakeStyle['alignment']): 'left' | 'center' | 'right' | 'justify' | undefined {
  if (a === 'left' || a === 'center' || a === 'right' || a === 'justify') return a
  return undefined
}

export function normalizeStyleNames(s: string | string[] | undefined): string[] {
  if (!s) return []
  return Array.isArray(s) ? s : [s]
}

export function mergeStyles(
  ctx: TranslateCtx,
  styleNames: string[],
  node: PdfmakeObjectNode,
  parent?: PdfmakeStyle,
): PdfmakeStyle {
  const merged: PdfmakeStyle = { ...ctx.defaultStyle, ...(parent ?? {}) }
  for (const name of styleNames) {
    const s = ctx.styles[name]
    if (s) copySafeStyleProperties(merged, s)
  }
  if (node.bold !== undefined) merged.bold = node.bold
  if (node.italics !== undefined) merged.italics = node.italics
  if (node.color !== undefined) merged.color = node.color
  if (node.fontSize !== undefined) merged.fontSize = node.fontSize
  if (node.alignment !== undefined) merged.alignment = node.alignment
  if (node.font !== undefined) merged.font = node.font
  return merged
}

/** Copy only known-safe style properties, preventing prototype pollution. */
function copySafeStyleProperties(target: PdfmakeStyle, source: unknown): void {
  if (typeof source !== 'object' || source === null) return
  const src = source as Record<string, unknown>
  const safeKeys: (keyof PdfmakeStyle)[] = ['fontSize', 'bold', 'italics', 'color', 'alignment', 'font']
  for (const key of safeKeys) {
    if (Object.hasOwn(src, key) && src[key] !== undefined) {
      (target as Record<string, unknown>)[key] = src[key]
    }
  }
}

export function normalizePageSize(name: string): import('../page-sizes.js').NamedPageSize | null {
  const n = name.trim()
  const map: Record<string, import('../page-sizes.js').NamedPageSize> = {
    A3: 'A3', A4: 'A4', A5: 'A5',
    LETTER: 'Letter', Letter: 'Letter', letter: 'Letter',
    LEGAL: 'Legal', Legal: 'Legal', legal: 'Legal',
    TABLOID: 'Tabloid', Tabloid: 'Tabloid', tabloid: 'Tabloid',
  }
  return map[n] ?? null
}

export function normalizeMargins(m: number | [number, number] | [number, number, number, number]): Margins | null {
  if (typeof m === 'number') return { top: m, bottom: m, left: m, right: m }
  if (Array.isArray(m)) {
    if (m.length === 2) return { left: m[0], top: m[1], right: m[0], bottom: m[1] }
    if (m.length === 4) return { left: m[0], top: m[1], right: m[2], bottom: m[3] }
  }
  return null
}

export function normalizeHeaderFooter(
  hf: import('./pdfmake-types.js').PdfmakeDocument['header'] | import('./pdfmake-types.js').PdfmakeDocument['footer'],
  onUnsupported: (f: string) => void,
  label: 'header' | 'footer'
): HeaderFooterSpec | null {
  if (hf === undefined) return null
  if (typeof hf === 'function') { onUnsupported(`${label} (function form not supported — pass a string instead)`); return null }
  if (typeof hf === 'string') return { text: hf }
  if (typeof hf === 'object' && typeof hf.text === 'string') {
    const out: Mutable<HeaderFooterSpec> = { text: hf.text }
    if (hf.alignment === 'left' || hf.alignment === 'center' || hf.alignment === 'right') out.align = hf.alignment
    if (typeof hf.fontSize === 'number') out.fontSize = hf.fontSize
    if (hf.color) out.color = hf.color
    return out as HeaderFooterSpec
  }
  return null
}
