/**
 * render-blocks/text.ts — Text block (paragraph + heading) rendering
 */

import { PDFDocument, rgb } from '@cantoo/pdf-lib'
import type {
  PagedBlock, FontMap, PageGeometry
} from '../types-internal.js'
import { PretextPdfError } from '../errors.js'
import {
  drawJustifiedLine,
  addLinkAnnotation,
  addStickyNoteAnnotation,
  drawTextDecoration,
  toPdfY,
  resolveX,
  hexToRgb,
  drawTabularText,
} from '../render-utils.js'

// ─── Text block rendering (paragraph + heading) ───────────────────────────────

export function renderTextBlock(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  pagedBlock: PagedBlock,
  geo: PageGeometry,
  fontMap: FontMap,
  pdfDoc: PDFDocument
): void {
  const { measuredBlock, startLine, endLine, yFromTop } = pagedBlock
  const { element } = measuredBlock

  const lines = measuredBlock.lines.slice(startLine, endLine)
  if (lines.length === 0) return

  const pdfFont = fontMap.get(measuredBlock.fontKey)
  if (!pdfFont) {
    throw new PretextPdfError('FONT_NOT_LOADED', `Font "${measuredBlock.fontKey}" not found in fontMap. This is a bug — font validation should have caught this.`)
  }

  const colorHex = (element.type === 'paragraph' || element.type === 'heading')
    ? (element.color ?? '#000000')
    : '#000000'
  const [r, g, b] = hexToRgb(colorHex)
  const alignRaw = (element.type === 'paragraph' || element.type === 'heading')
    ? (element.align ?? (measuredBlock.isRTL ? 'right' : 'left'))
    : 'left'
  // For resolveX, treat 'justify' as 'left' (justify is handled by drawJustifiedLine)
  const align = alignRaw === 'justify' ? 'left' : alignRaw as 'left' | 'center' | 'right'
  const fontHeight = pdfFont.heightAtSize(measuredBlock.fontSize)
  // Narrowed reference for paragraph/heading-only fields (smallCaps, tabularNumbers, letterSpacing, annotation)
  const textElement = (element.type === 'paragraph' || element.type === 'heading') ? element : null

  // Draw background color for paragraph and heading (if set)
  if ((element.type === 'paragraph' || element.type === 'heading') && element.bgColor) {
    const columnData = measuredBlock.columnData
    const chunkHeight = columnData
      ? columnData.linesPerColumn * measuredBlock.lineHeight
      : lines.length * measuredBlock.lineHeight
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

  // Multi-column layout — mirrors single-column features (smallCaps, letterSpacing, justify, decoration)
  const columnData = measuredBlock.columnData
  if (columnData) {
    const { columnGap, columnWidth, linesPerColumn } = columnData
    const hasSmallCaps = textElement?.smallCaps === true
    const mcFontSize = hasSmallCaps ? measuredBlock.fontSize * 0.8 : measuredBlock.fontSize
    const hasTabular = textElement?.tabularNumbers === true
    const letterSpacing = (textElement?.letterSpacing ?? 0) > 0 ? textElement!.letterSpacing as number : 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      if (line.text === '') continue

      const colIdx = Math.floor(i / linesPerColumn)
      const lineInCol = i % linesPerColumn
      const lineYFromTop = yFromTop + (lineInCol * measuredBlock.lineHeight)
      const absoluteYFromTop = lineYFromTop + geo.margins.top + geo.headerHeight
      const pdfY = toPdfY(absoluteYFromTop, fontHeight, geo.pageHeight)

      const colX = geo.margins.left + colIdx * (columnWidth + columnGap)
      let trimmedText = line.text.trimEnd()
      if (hasSmallCaps) trimmedText = trimmedText.toUpperCase()
      // Last line of each column should not be force-justified (left-align instead)
      const isLastLineInCol = lineInCol === linesPerColumn - 1 || i === lines.length - 1

      let drawX: number
      if (alignRaw === 'justify' && letterSpacing === 0 && !hasTabular) {
        drawJustifiedLine(pdfPage, trimmedText, isLastLineInCol, colX, pdfY, columnWidth, mcFontSize, pdfFont, rgb(r, g, b))
        drawX = colX
      } else if (letterSpacing > 0) {
        const alignWidth = pdfFont.widthOfTextAtSize(trimmedText, mcFontSize) + letterSpacing * (trimmedText.length - 1)
        drawX = resolveX(align, colX, columnWidth, alignWidth)
        let cx = drawX
        for (const ch of trimmedText) {
          pdfPage.drawText(ch, { x: cx, y: pdfY, size: mcFontSize, font: pdfFont, color: rgb(r, g, b) })
          cx += pdfFont.widthOfTextAtSize(ch, mcFontSize) + letterSpacing
        }
      } else if (hasTabular) {
        const alignWidth = pdfFont.widthOfTextAtSize(trimmedText, mcFontSize)
        drawX = resolveX(align, colX, columnWidth, alignWidth)
        drawTabularText(pdfPage, trimmedText, drawX, pdfY, mcFontSize, pdfFont, rgb(r, g, b))
      } else {
        const alignWidth = pdfFont.widthOfTextAtSize(trimmedText, mcFontSize)
        drawX = resolveX(align, colX, columnWidth, alignWidth)
        pdfPage.drawText(trimmedText, { x: drawX, y: pdfY, size: mcFontSize, font: pdfFont, color: rgb(r, g, b) })
      }

      // Text decoration (underline, strikethrough)
      if ((element.type === 'paragraph' || element.type === 'heading') && (element.underline || element.strikethrough)) {
        const lineWidth = pdfFont.widthOfTextAtSize(trimmedText, mcFontSize) + (letterSpacing > 0 ? letterSpacing * (trimmedText.length - 1) : 0)
        drawTextDecoration(pdfPage, drawX, lineWidth, pdfY, mcFontSize, pdfFont, [r, g, b], { underline: element.underline ?? false, strikethrough: element.strikethrough ?? false })
      }

      // Hyperlink annotation
      if ((element.type === 'paragraph' || element.type === 'heading') && element.url) {
        const lineWidth = pdfFont.widthOfTextAtSize(trimmedText, mcFontSize) + (letterSpacing > 0 ? letterSpacing * (trimmedText.length - 1) : 0)
        addLinkAnnotation(pdfDoc, pdfPage, drawX, pdfY, lineWidth, mcFontSize, element.url)
      }
    }

    // Sticky note annotation (once per block, not per line)
    if (textElement?.annotation) {
      const ann = textElement.annotation
      const absY = yFromTop + geo.margins.top + geo.headerHeight
      const annotPdfY = geo.pageHeight - absY
      addStickyNoteAnnotation(pdfDoc, pdfPage, geo.margins.left, annotPdfY, ann.contents, ann.author, ann.color, ann.open)
    }
    return // skip standard single-column path
  }

  // Single-column layout (standard path)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.text === '') continue // empty lines from \n\n — occupy space, draw nothing

    const lineYFromTop = yFromTop + (i * measuredBlock.lineHeight)
    const absoluteYFromTop = lineYFromTop + geo.margins.top + geo.headerHeight
    const pdfY = toPdfY(absoluteYFromTop, fontHeight, geo.pageHeight)

    let trimmedText = line.text.trimEnd()
    const isLastLine = i === lines.length - 1

    // smallCaps — uppercase text at 80% font size
    const hasSmallCaps = textElement?.smallCaps === true
    const effectiveFontSize = hasSmallCaps ? measuredBlock.fontSize * 0.8 : measuredBlock.fontSize
    if (hasSmallCaps) trimmedText = trimmedText.toUpperCase()

    const hasTabular = textElement?.tabularNumbers === true

    // letterSpacing — draw char by char
    const letterSpacing = (textElement?.letterSpacing ?? 0) > 0
      ? textElement!.letterSpacing as number
      : 0

    let drawX: number
    if (alignRaw === 'justify' && letterSpacing === 0 && !hasTabular) {
      drawJustifiedLine(pdfPage, trimmedText, isLastLine, geo.margins.left, pdfY, geo.contentWidth, effectiveFontSize, pdfFont, rgb(r, g, b))
      drawX = geo.margins.left // used for decoration below
    } else if (letterSpacing > 0) {
      const alignWidth = pdfFont.widthOfTextAtSize(trimmedText, effectiveFontSize) + letterSpacing * (trimmedText.length - 1)
      drawX = resolveX(align, geo.margins.left, geo.contentWidth, alignWidth)
      let cx = drawX
      for (const ch of trimmedText) {
        pdfPage.drawText(ch, { x: cx, y: pdfY, size: effectiveFontSize, font: pdfFont, color: rgb(r, g, b) })
        cx += pdfFont.widthOfTextAtSize(ch, effectiveFontSize) + letterSpacing
      }
    } else if (hasTabular) {
      const alignWidth = pdfFont.widthOfTextAtSize(trimmedText, effectiveFontSize)
      drawX = resolveX(align, geo.margins.left, geo.contentWidth, alignWidth)
      drawTabularText(pdfPage, trimmedText, drawX, pdfY, effectiveFontSize, pdfFont, rgb(r, g, b))
    } else {
      const alignWidth = pdfFont.widthOfTextAtSize(trimmedText, effectiveFontSize)
      drawX = resolveX(align, geo.margins.left, geo.contentWidth, alignWidth)
      pdfPage.drawText(trimmedText, {
        x: drawX,
        y: pdfY,
        size: effectiveFontSize,
        font: pdfFont,
        color: rgb(r, g, b),
      })
    }

    if ((element.type === 'paragraph' || element.type === 'heading') && (element.underline || element.strikethrough)) {
      const lineWidth = pdfFont.widthOfTextAtSize(trimmedText, effectiveFontSize) + (letterSpacing > 0 ? letterSpacing * (trimmedText.length - 1) : 0)
      drawTextDecoration(pdfPage, drawX, lineWidth, pdfY, effectiveFontSize, pdfFont, [r, g, b], { underline: element.underline ?? false, strikethrough: element.strikethrough ?? false })
    }

    // Clickable link annotation on paragraph/heading
    if ((element.type === 'paragraph' || element.type === 'heading') && element.url) {
      const lineWidth = pdfFont.widthOfTextAtSize(trimmedText, effectiveFontSize) + (letterSpacing > 0 ? letterSpacing * (trimmedText.length - 1) : 0)
      addLinkAnnotation(pdfDoc, pdfPage, drawX, pdfY, lineWidth, effectiveFontSize, element.url)
    }
  }

  // Annotation on paragraph/heading — attach sticky note at top of block
  if (textElement?.annotation) {
    const ann = textElement.annotation
    const absY = yFromTop + geo.margins.top + geo.headerHeight
    const annotPdfY = geo.pageHeight - absY
    addStickyNoteAnnotation(pdfDoc, pdfPage, geo.margins.left, annotPdfY, ann.contents, ann.author, ann.color, ann.open)
  }
}
