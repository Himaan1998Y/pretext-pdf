/**
 * render-blocks/code.ts — Code block rendering
 */

import { PDFDocument, rgb } from '@cantoo/pdf-lib'
import type {
  PagedBlock, FontMap, PageGeometry
} from '../types-internal.js'
import {
  toPdfY,
  hexToRgb,
} from '../render-utils.js'

// ─── Code block rendering ─────────────────────────────────────────────────────

export function renderCodeBlock(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  pagedBlock: PagedBlock,
  geo: PageGeometry,
  fontMap: FontMap
): void {
  const { measuredBlock, startLine, endLine, yFromTop } = pagedBlock
  const element = measuredBlock.element as import('../types.js').CodeBlockElement
  const padding = measuredBlock.codePadding ?? 8
  const bgColorHex = element.bgColor ?? '#f6f8fa'
  const textColorHex = element.color ?? '#24292f'

  // Slice the lines being rendered on this page chunk
  const lines = measuredBlock.lines.slice(startLine, endLine)
  const lineHeight = measuredBlock.lineHeight
  const fontSize = measuredBlock.fontSize

  // Compute per-chunk padding (only apply padding at the edge of the code block)
  const isFirstChunk = startLine === 0
  const isLastChunk = endLine === measuredBlock.lines.length
  const paddingTop = isFirstChunk ? padding : 0
  const paddingBottom = isLastChunk ? padding : 0
  const visibleHeight = lines.length * lineHeight + paddingTop + paddingBottom

  // ── Background box ──────────────────────────────────────────────────────────
  const boxAbsY = yFromTop + geo.margins.top + geo.headerHeight
  const boxPdfY = toPdfY(boxAbsY, visibleHeight, geo.pageHeight)
  const [bgR, bgG, bgB] = hexToRgb(bgColorHex)

  pdfPage.drawRectangle({
    x: geo.margins.left,
    y: boxPdfY,
    width: geo.contentWidth,
    height: visibleHeight,
    color: rgb(bgR, bgG, bgB),
    borderWidth: 0,
  })

  // ── Text lines ──────────────────────────────────────────────────────────────
  const pdfFont = fontMap.get(measuredBlock.fontKey)
  if (!pdfFont || lines.length === 0) return

  const fontHeight = pdfFont.heightAtSize(fontSize)
  const [r, g, b] = hexToRgb(textColorHex)
  const textX = geo.margins.left + padding

  // Syntax highlighting: tokenize if language is set and highlight.js is available
  const highlightTokens = measuredBlock.codeHighlightTokens
  if (highlightTokens && highlightTokens.length > 0) {
    // Render with per-token colors
    for (let i = 0; i < lines.length; i++) {
      const lineYFromPageTop = boxAbsY + paddingTop + i * lineHeight
      const pdfY = toPdfY(lineYFromPageTop, fontHeight, geo.pageHeight)
      const lineTokens = highlightTokens[startLine + i]
      if (!lineTokens) continue
      let curX = textX
      for (const token of lineTokens) {
        if (!token.text) continue
        const [tr, tg, tb] = hexToRgb(token.color)
        pdfPage.drawText(token.text, {
          x: curX,
          y: pdfY,
          size: fontSize,
          font: pdfFont,
          color: rgb(tr, tg, tb),
        })
        curX += pdfFont.widthOfTextAtSize(token.text, fontSize)
      }
    }
  } else {
    // Plain text rendering (no highlighting)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      const lineYFromPageTop = boxAbsY + paddingTop + i * lineHeight
      const pdfY = toPdfY(lineYFromPageTop, fontHeight, geo.pageHeight)

      pdfPage.drawText(line.text.trimEnd(), {
        x: textX,
        y: pdfY,
        size: fontSize,
        font: pdfFont,
        color: rgb(r, g, b),
      })
    }
  }
}
