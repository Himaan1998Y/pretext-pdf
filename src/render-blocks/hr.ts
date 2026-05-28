/**
 * render-blocks/hr.ts — Horizontal rule rendering
 */

import { PDFDocument, rgb } from '@cantoo/pdf-lib'
import type {
  PagedBlock, PageGeometry
} from '../types-internal.js'
import {
  toPdfY,
  hexToRgb,
} from '../render-utils.js'

// ─── Horizontal rule rendering ────────────────────────────────────────────────

export function renderHR(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  pagedBlock: PagedBlock,
  geo: PageGeometry
): void {
  const { measuredBlock, yFromTop } = pagedBlock
  const element = measuredBlock.element as import('../types.js').HorizontalRuleElement

  const spaceBefore = element.spaceBefore ?? 12
  const thickness = element.thickness ?? 0.5
  const colorHex = element.color ?? '#cccccc'

  const lineYFromTop = yFromTop + spaceBefore + geo.margins.top + geo.headerHeight
  const pdfY = toPdfY(lineYFromTop, thickness / 2, geo.pageHeight)

  const [r, g, b] = hexToRgb(colorHex)

  pdfPage.drawLine({
    start: { x: geo.margins.left, y: pdfY },
    end: { x: geo.margins.left + geo.contentWidth, y: pdfY },
    thickness,
    color: rgb(r, g, b),
  })
}
