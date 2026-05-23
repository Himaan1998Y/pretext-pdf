/**
 * render-blocks/rich.ts — Rich paragraph rendering
 */

import { PDFDocument, rgb } from '@cantoo/pdf-lib'
import type { RichParagraphElement } from '../types.js'
import type {
  PagedBlock, FontMap, PageGeometry
} from '../types-internal.js'
import { PretextPdfError } from '../errors.js'
import {
  addLinkAnnotation,
  drawTextDecoration,
  toPdfY,
  hexToRgb,
  drawTabularText,
} from '../render-utils.js'

// ─── Rich paragraph rendering ─────────────────────────────────────────────────

export function renderRichParagraph(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  pagedBlock: PagedBlock,
  geo: PageGeometry,
  fontMap: FontMap,
  pdfDoc: PDFDocument,
  footnoteNumbering?: Map<string, number>
): void {
  const { measuredBlock, startLine, endLine, yFromTop } = pagedBlock
  const { element, richLines } = measuredBlock
  const tabularNumbers = element.type === 'rich-paragraph' && (element as RichParagraphElement).tabularNumbers === true

  if (!richLines || richLines.length === 0) return

  // Only render the lines on this page chunk
  const visibleLines = richLines.slice(startLine, endLine)

  // Draw background color if set
  const columnData = measuredBlock.columnData
  if (element.type === 'rich-paragraph' && element.bgColor) {
    // Use sum of per-line heights (may vary with per-span fontSize)
    const chunkHeight = columnData
      ? visibleLines.slice(0, columnData.linesPerColumn).reduce((sum, rl) => sum + rl.lineHeight, 0)
      : visibleLines.reduce((sum, rl) => sum + rl.lineHeight, 0)
    const boxAbsY = yFromTop + geo.margins.top + geo.headerHeight
    const boxPdfY = toPdfY(boxAbsY, chunkHeight, geo.pageHeight)
    const [bgR, bgG, bgB] = hexToRgb(element.bgColor)
    pdfPage.drawRectangle({
      x: geo.margins.left,
      y: boxPdfY,
      width: geo.contentWidth,
      height: chunkHeight,
      color: rgb(bgR, bgG, bgB),
      borderWidth: 0,
    })
  }

  // Multi-column layout
  if (columnData) {
    const { columnCount, columnGap, columnWidth, linesPerColumn } = columnData
    // Track cumulative Y per column (per-line heights may vary)
    const colCumY = new Array<number>(columnCount).fill(0)
    for (let i = 0; i < visibleLines.length; i++) {
      const richLine = visibleLines[i]!
      const colIdx = Math.floor(i / linesPerColumn)
      const colOffsetX = colIdx * (columnWidth + columnGap)
      const lineYFromTop = yFromTop + colCumY[colIdx]! + geo.margins.top + geo.headerHeight

      for (const fragment of richLine.fragments) {
        if (!fragment.text || fragment.text.trim() === '') continue

        const pdfFont = fontMap.get(fragment.fontKey)
        if (!pdfFont) {
          throw new PretextPdfError('FONT_NOT_LOADED', `Rich text fragment font "${fragment.fontKey}" not found in fontMap. This is a bug — font validation should have caught this.`)
        }

        const fontHeight = pdfFont.heightAtSize(fragment.fontSize)
        const basePdfY = toPdfY(lineYFromTop, fontHeight, geo.pageHeight)
        const [r, g, b] = hexToRgb(fragment.color)
        const drawX = geo.margins.left + colOffsetX + fragment.x

        // Footnote ref spans render as superscript number, replacing the original text
        if (fragment.footnoteRef) {
          const num = footnoteNumbering?.get(fragment.footnoteRef) ?? '?'
          const superText = String(num)
          const superSize = fragment.fontSize * 0.65
          const superYOffset = fragment.fontSize * 0.4
          const superPdfY = basePdfY + superYOffset
          pdfPage.drawText(superText, {
            x: drawX,
            y: superPdfY,
            size: superSize,
            font: pdfFont,
            color: rgb(r, g, b),
          })
          continue
        }

        const fragmentPdfY = basePdfY + (fragment.yOffset ?? 0)
        const drawText = fragment.text.trimEnd()
        let fragWidth: number
        if (fragment.letterSpacing && fragment.letterSpacing > 0) {
          let cx = drawX
          for (const ch of drawText) {
            pdfPage.drawText(ch, { x: cx, y: fragmentPdfY, size: fragment.fontSize, font: pdfFont, color: rgb(r, g, b) })
            cx += pdfFont.widthOfTextAtSize(ch, fragment.fontSize) + fragment.letterSpacing
          }
          fragWidth = pdfFont.widthOfTextAtSize(drawText, fragment.fontSize) + fragment.letterSpacing * (drawText.length - 1)
        } else if (tabularNumbers) {
          drawTabularText(pdfPage, drawText, drawX, fragmentPdfY, fragment.fontSize, pdfFont, rgb(r, g, b))
          fragWidth = pdfFont.widthOfTextAtSize(drawText, fragment.fontSize)
        } else {
          pdfPage.drawText(drawText, { x: drawX, y: fragmentPdfY, size: fragment.fontSize, font: pdfFont, color: rgb(r, g, b) })
          fragWidth = pdfFont.widthOfTextAtSize(drawText, fragment.fontSize)
        }
        drawTextDecoration(pdfPage, drawX, fragWidth, fragmentPdfY, fragment.fontSize, pdfFont, [r, g, b], { underline: fragment.underline ?? false, strikethrough: fragment.strikethrough ?? false })
        if (fragment.url) {
          addLinkAnnotation(pdfDoc, pdfPage, drawX, fragmentPdfY, fragWidth, fragment.fontSize, fragment.url)
        }
      }
      colCumY[colIdx]! += richLine.lineHeight
    }
    return // skip standard single-column path
  }

  // Single-column layout (standard path)
  // Track cumulative Y (per-line heights may vary due to per-span fontSize)
  let cumY = 0
  for (let i = 0; i < visibleLines.length; i++) {
    const richLine = visibleLines[i]!
    const lineYFromTop = yFromTop + cumY + geo.margins.top + geo.headerHeight

    for (const fragment of richLine.fragments) {
      if (!fragment.text || fragment.text.trim() === '') continue

      const pdfFont = fontMap.get(fragment.fontKey)
      if (!pdfFont) {
        throw new PretextPdfError('FONT_NOT_LOADED', `Rich text fragment font "${fragment.fontKey}" not found in fontMap. This is a bug — font validation should have caught this.`)
      }

      const fontHeight = pdfFont.heightAtSize(fragment.fontSize)
      const basePdfY = toPdfY(lineYFromTop, fontHeight, geo.pageHeight)
      const [r, g, b] = hexToRgb(fragment.color)
      const drawX = geo.margins.left + fragment.x

      // Footnote ref spans render as superscript number, replacing the original text
      if (fragment.footnoteRef) {
        const num = footnoteNumbering?.get(fragment.footnoteRef) ?? '?'
        const superText = String(num)
        const superSize = fragment.fontSize * 0.65
        const superYOffset = fragment.fontSize * 0.4
        const superPdfY = basePdfY + superYOffset
        pdfPage.drawText(superText, {
          x: drawX,
          y: superPdfY,
          size: superSize,
          font: pdfFont,
          color: rgb(r, g, b),
        })
        continue
      }

      const fragmentPdfY = basePdfY + (fragment.yOffset ?? 0)
      const drawText = fragment.text.trimEnd()
      let fragWidth: number
      if (fragment.letterSpacing && fragment.letterSpacing > 0) {
        let cx = drawX
        for (const ch of drawText) {
          pdfPage.drawText(ch, { x: cx, y: fragmentPdfY, size: fragment.fontSize, font: pdfFont, color: rgb(r, g, b) })
          cx += pdfFont.widthOfTextAtSize(ch, fragment.fontSize) + fragment.letterSpacing
        }
        fragWidth = pdfFont.widthOfTextAtSize(drawText, fragment.fontSize) + fragment.letterSpacing * (drawText.length - 1)
      } else if (tabularNumbers) {
        drawTabularText(pdfPage, drawText, drawX, fragmentPdfY, fragment.fontSize, pdfFont, rgb(r, g, b))
        fragWidth = pdfFont.widthOfTextAtSize(drawText, fragment.fontSize)
      } else {
        pdfPage.drawText(drawText, { x: drawX, y: fragmentPdfY, size: fragment.fontSize, font: pdfFont, color: rgb(r, g, b) })
        fragWidth = pdfFont.widthOfTextAtSize(drawText, fragment.fontSize)
      }
      drawTextDecoration(pdfPage, drawX, fragWidth, fragmentPdfY, fragment.fontSize, pdfFont, [r, g, b], { underline: fragment.underline ?? false, strikethrough: fragment.strikethrough ?? false })
      if (fragment.url) {
        addLinkAnnotation(pdfDoc, pdfPage, drawX, fragmentPdfY, fragWidth, fragment.fontSize, fragment.url)
      }
    }

    cumY += richLine.lineHeight
  }
}
