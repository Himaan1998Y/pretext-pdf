/**
 * render-blocks/list-item.ts — List item rendering
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
} from '../render-utils.js'

// ─── List item rendering ──────────────────────────────────────────────────────

export function renderListItem(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  pagedBlock: PagedBlock,
  geo: PageGeometry,
  fontMap: FontMap
): void {
  const { measuredBlock, startLine, endLine, yFromTop } = pagedBlock
  const listItemData = measuredBlock.listItemData!

  const lines = measuredBlock.lines.slice(startLine, endLine)
  if (lines.length === 0) return

  const pdfFont = fontMap.get(measuredBlock.fontKey)
  if (!pdfFont) {
    throw new PretextPdfError('FONT_NOT_LOADED', `Font "${measuredBlock.fontKey}" not found in fontMap. This is a bug — font validation should have caught this.`)
  }

  const fontHeight = pdfFont.heightAtSize(measuredBlock.fontSize)
  const [cr, cg, cb] = hexToRgb(listItemData.color)

  // RTL support: mirror list layout if detected
  const isRTL = measuredBlock.isRTL ?? false
  let textStartX: number
  let textAreaWidth: number

  if (isRTL) {
    // RTL: marker on the right, text area on the left
    textAreaWidth = geo.contentWidth - listItemData.indent - listItemData.markerWidth
    textStartX = geo.margins.left + listItemData.indent
  } else {
    // LTR: marker on the left, text area on the right
    textStartX = geo.margins.left + listItemData.indent + listItemData.markerWidth
    textAreaWidth = geo.contentWidth - listItemData.indent - listItemData.markerWidth
  }

  // Draw marker on the first line of this item (only if startLine === 0)
  // If startLine > 0, the item continued from a previous page — no marker
  if (startLine === 0) {
    const markerText = listItemData.marker
    const markerMeasuredWidth = pdfFont.widthOfTextAtSize(markerText, measuredBlock.fontSize)
    let markerX: number

    if (isRTL) {
      // RTL: marker on the right, right-aligned within marker column
      markerX = geo.margins.left + geo.contentWidth - listItemData.indent - markerMeasuredWidth
    } else {
      // LTR: marker on the left, right-aligned within marker column
      markerX = geo.margins.left + listItemData.indent + listItemData.markerWidth - markerMeasuredWidth
    }

    const firstLineAbsY = yFromTop + geo.margins.top + geo.headerHeight
    const markerPdfY = toPdfY(firstLineAbsY, fontHeight, geo.pageHeight)

    pdfPage.drawText(markerText, {
      x: markerX,
      y: markerPdfY,
      size: measuredBlock.fontSize,
      font: pdfFont,
      color: rgb(cr, cg, cb),
    })
  }

  // Draw all text lines, indented to align with body text column
  // RTL lists are right-aligned, LTR lists are left-aligned
  const textAlign = isRTL ? 'right' : 'left'
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.text === '') continue

    const lineYFromTop = yFromTop + (i * measuredBlock.lineHeight)
    const absoluteYFromTop = lineYFromTop + geo.margins.top + geo.headerHeight
    const pdfY = toPdfY(absoluteYFromTop, fontHeight, geo.pageHeight)

    const trimmedText = line.text.trimEnd()
    const lineWidth = pdfFont.widthOfTextAtSize(trimmedText, measuredBlock.fontSize)
    const x = resolveX(textAlign, textStartX, textAreaWidth, lineWidth)

    pdfPage.drawText(trimmedText, {
      x,
      y: pdfY,
      size: measuredBlock.fontSize,
      font: pdfFont,
      color: rgb(cr, cg, cb),
    })
  }
}
