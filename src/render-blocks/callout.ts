/**
 * render-blocks/callout.ts — Callout rendering
 */

import { PDFDocument, rgb } from '@cantoo/pdf-lib'
import type {
  PagedBlock, FontMap, PageGeometry
} from '../types-internal.js'
import {
  toPdfY,
  hexToRgb,
  LINE_HEIGHT_COMPACT,
} from '../render-utils.js'

// ─── Callout rendering ────────────────────────────────────────────

export function renderCallout(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  pagedBlock: PagedBlock,
  geo: PageGeometry,
  fontMap: FontMap
): void {
  const { measuredBlock, startLine, endLine, yFromTop } = pagedBlock
  const el = measuredBlock.element as import('../types.js').CalloutElement
  const cd = measuredBlock.calloutData
  if (!cd) return

  const { paddingH, paddingV, borderColor, backgroundColor, titleColor, color, titleText } = cd
  const isFirstChunk = startLine === 0
  const isLastChunk = endLine === measuredBlock.lines.length

  const lines = measuredBlock.lines.slice(startLine, endLine)
  const fs = measuredBlock.fontSize
  const lh = measuredBlock.lineHeight
  const font = fontMap.get(measuredBlock.fontKey) ?? [...fontMap.values()][0]
  if (!font) return

  const titleH = isFirstChunk && titleText ? cd.titleHeight : 0
  const topPad = isFirstChunk ? paddingV : 0
  const bottomPad = isLastChunk ? paddingV : 0
  const chunkHeight = topPad + titleH + lines.length * lh + bottomPad

  const boxAbsY = yFromTop + geo.margins.top + geo.headerHeight
  const boxPdfY = toPdfY(boxAbsY, chunkHeight, geo.pageHeight)

  // Background
  const [bgR, bgG, bgB] = hexToRgb(backgroundColor)
  pdfPage.drawRectangle({
    x: geo.margins.left,
    y: boxPdfY,
    width: geo.contentWidth,
    height: chunkHeight,
    color: rgb(bgR, bgG, bgB),
    borderWidth: 0,
  })

  // Left border stripe (3pt wide)
  const [bdR, bdG, bdB] = hexToRgb(borderColor)
  pdfPage.drawRectangle({
    x: geo.margins.left,
    y: boxPdfY,
    width: 3,
    height: chunkHeight,
    color: rgb(bdR, bdG, bdB),
    borderWidth: 0,
  })

  const fontHeight = font.heightAtSize(fs)
  let currentAbsY = boxAbsY + topPad

  // Draw title if first chunk
  if (isFirstChunk && titleText) {
    // Try to get bold font variant by modifying the fontKey
    const boldFontKey = measuredBlock.fontKey.replace(/-400-/, '-700-')
    const titleFont = fontMap.get(boldFontKey) ?? font
    const [tR, tG, tB] = hexToRgb(titleColor)
    const titlePdfY = toPdfY(currentAbsY + (fs * LINE_HEIGHT_COMPACT - fs) / 2, fontHeight, geo.pageHeight)
    pdfPage.drawText(titleText, {
      x: geo.margins.left + paddingH,
      y: titlePdfY,
      size: fs,
      font: titleFont,
      color: rgb(tR, tG, tB),
    })
    currentAbsY += titleH
  }

  // Draw content lines
  const [tR, tG, tB] = hexToRgb(color)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.text === '') {
      currentAbsY += lh
      continue
    }
    const linePdfY = toPdfY(currentAbsY + (lh - fs) / 2, fontHeight, geo.pageHeight)
    pdfPage.drawText(line.text.trimEnd(), {
      x: geo.margins.left + paddingH,
      y: linePdfY,
      size: fs,
      font,
      color: rgb(tR, tG, tB),
    })
    currentAbsY += lh
  }
}
