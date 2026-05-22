/**
 * render-blocks/blockquote.ts — Blockquote rendering
 */

import { PDFDocument, rgb } from '@cantoo/pdf-lib'
import type {
  PagedBlock, FontMap, PageGeometry
} from '../types-internal.js'
import {
  drawJustifiedLine,
  drawTextDecoration,
  toPdfY,
  resolveX,
  hexToRgb,
} from '../render-utils.js'

// ─── Blockquote rendering ─────────────────────────────────────────────────────

export function renderBlockquote(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  pagedBlock: PagedBlock,
  geo: PageGeometry,
  fontMap: FontMap
): void {
  const { measuredBlock, startLine, endLine, yFromTop } = pagedBlock
  const element = measuredBlock.element as import('../types.js').BlockquoteElement
  const paddingV = measuredBlock.blockquotePaddingV ?? 10
  const paddingH = measuredBlock.blockquotePaddingH ?? 16
  const borderWidth = measuredBlock.blockquoteBorderWidth ?? 3
  const bgColorHex = element.bgColor ?? '#f8f9fa'
  const borderColorHex = element.borderColor ?? '#0070f3'
  const textColorHex = element.color ?? '#333333'
  const alignRaw = element.align ?? (measuredBlock.isRTL ? 'right' : 'left')
  const align = alignRaw === 'justify' ? 'left' : alignRaw as 'left' | 'center' | 'right'

  const lines = measuredBlock.lines.slice(startLine, endLine)
  const lineHeight = measuredBlock.lineHeight
  const fontSize = measuredBlock.fontSize

  // Compute per-chunk padding (only at the edge of the block, like code)
  const isFirstChunk = startLine === 0
  const isLastChunk = endLine === measuredBlock.lines.length
  const paddingTop = isFirstChunk ? paddingV : 0
  const paddingBottom = isLastChunk ? paddingV : 0
  const visibleHeight = lines.length * lineHeight + paddingTop + paddingBottom

  const boxAbsY = yFromTop + geo.margins.top + geo.headerHeight
  const boxPdfY = toPdfY(boxAbsY, visibleHeight, geo.pageHeight)

  // ── Background box ──────────────────────────────────────────────────────────
  const [bgR, bgG, bgB] = hexToRgb(bgColorHex)
  pdfPage.drawRectangle({
    x: geo.margins.left,
    y: boxPdfY,
    width: geo.contentWidth,
    height: visibleHeight,
    color: rgb(bgR, bgG, bgB),
    borderWidth: 0,
  })

  // ── Left border stripe ──────────────────────────────────────────────────────
  const [bdR, bdG, bdB] = hexToRgb(borderColorHex)
  pdfPage.drawRectangle({
    x: geo.margins.left,
    y: boxPdfY,
    width: borderWidth,
    height: visibleHeight,
    color: rgb(bdR, bdG, bdB),
    borderWidth: 0,
  })

  // ── Text lines ──────────────────────────────────────────────────────────────
  const pdfFont = fontMap.get(measuredBlock.fontKey)
  if (!pdfFont || lines.length === 0) return

  const fontHeight = pdfFont.heightAtSize(fontSize)
  const [r, g, b] = hexToRgb(textColorHex)
  const textStartX = geo.margins.left + borderWidth + paddingH
  const textAreaWidth = geo.contentWidth - borderWidth - 2 * paddingH

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.text === '') continue

    const lineYFromPageTop = boxAbsY + paddingTop + i * lineHeight
    const pdfY = toPdfY(lineYFromPageTop, fontHeight, geo.pageHeight)

    const trimmedText = line.text.trimEnd()
    const isLastLine = i === lines.length - 1

    let drawX: number
    if (alignRaw === 'justify') {
      drawJustifiedLine(pdfPage, trimmedText, isLastLine, textStartX, pdfY, textAreaWidth, fontSize, pdfFont, rgb(r, g, b))
      drawX = textStartX
    } else {
      const lineWidth = pdfFont.widthOfTextAtSize(trimmedText, fontSize)
      drawX = resolveX(align, textStartX, textAreaWidth, lineWidth)
      pdfPage.drawText(trimmedText, {
        x: drawX,
        y: pdfY,
        size: fontSize,
        font: pdfFont,
        color: rgb(r, g, b),
      })
    }
    if (element.underline || element.strikethrough) {
      const lineWidth = pdfFont.widthOfTextAtSize(trimmedText, fontSize)
      drawTextDecoration(pdfPage, drawX, lineWidth, pdfY, fontSize, pdfFont, [r, g, b], { underline: element.underline ?? false, strikethrough: element.strikethrough ?? false })
    }
  }
}
