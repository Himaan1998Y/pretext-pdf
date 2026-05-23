/**
 * render-blocks/image.ts — Image, float block, and float group rendering
 */

import { PDFDocument, rgb } from '@cantoo/pdf-lib'
import type {
  PagedBlock, FontMap, ImageMap, PageGeometry
} from '../types-internal.js'
import { PretextPdfError } from '../errors.js'
import {
  addLinkAnnotation,
  drawTextDecoration,
  toPdfY,
  resolveX,
  hexToRgb,
} from '../render-utils.js'

// ─── Image rendering ──────────────────────────────────────────────────────────

export function renderImage(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  pagedBlock: PagedBlock,
  geo: PageGeometry,
  imageMap: ImageMap
): void {
  const { measuredBlock, yFromTop } = pagedBlock
  const imageData = measuredBlock.imageData!
  const pdfImage = imageMap.get(imageData.imageKey)

  if (!pdfImage) {
    throw new PretextPdfError('IMAGE_LOAD_FAILED', `Image "${imageData.imageKey}" not found in imageMap. This is a bug — image loading should have caught this.`)
  }

  const absoluteYFromTop = yFromTop + geo.margins.top + geo.headerHeight
  // drawImage places the BOTTOM-LEFT corner at (x, y) — use toPdfY with renderHeight
  const pdfY = toPdfY(absoluteYFromTop, imageData.renderHeight, geo.pageHeight)
  const x = resolveX(imageData.align, geo.margins.left, geo.contentWidth, imageData.renderWidth)

  pdfPage.drawImage(pdfImage, {
    x,
    y: pdfY,
    width: imageData.renderWidth,
    height: imageData.renderHeight,
  })
}

// ─── Float image block rendering ─────────────────────────────────────────────

export function renderFloatBlock(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  pagedBlock: PagedBlock,
  geo: PageGeometry,
  fontMap: FontMap,
  imageMap: ImageMap,
  pdfDoc: PDFDocument,
): void {
  const { measuredBlock, yFromTop } = pagedBlock
  const fd = measuredBlock.floatData!
  const baseAbsY = yFromTop + geo.margins.top + geo.headerHeight

  // Draw image
  const pdfImage = imageMap.get(fd.imageKey)
  if (!pdfImage) throw new PretextPdfError('IMAGE_LOAD_FAILED', `Float image key "${fd.imageKey}" not found in imageMap. This is a bug — image loading should have caught this.`)

  const imgX = geo.margins.left + fd.imageColX
  const imgPdfY = toPdfY(baseAbsY, fd.imageRenderHeight, geo.pageHeight)
  pdfPage.drawImage(pdfImage, {
    x: imgX,
    y: imgPdfY,
    width: fd.imageRenderWidth,
    height: fd.imageRenderHeight,
  })

  // Draw text lines (rich or plain)
  const textBaseX = geo.margins.left + fd.textColX

  if (fd.richFloatLines && fd.richFloatLines.length > 0) {
    let cumY = 0
    for (const richLine of fd.richFloatLines) {
      const lineAbsY = baseAbsY + cumY
      for (const fragment of richLine.fragments) {
        if (!fragment.text || fragment.text.trim() === '') continue
        const pdfFont = fontMap.get(fragment.fontKey)
        if (!pdfFont) throw new PretextPdfError('FONT_NOT_LOADED', `Float rich text font "${fragment.fontKey}" not found in fontMap.`)
        const fontHeight = pdfFont.heightAtSize(fragment.fontSize)
        const [r, g, b] = hexToRgb(fragment.color)
        const drawX = textBaseX + fragment.x
        const pdfY = toPdfY(lineAbsY, fontHeight, geo.pageHeight) + (fragment.yOffset ?? 0)
        const drawText = fragment.text.trimEnd()
        if (fragment.letterSpacing && fragment.letterSpacing > 0) {
          let cx = drawX
          for (const ch of drawText) {
            pdfPage.drawText(ch, { x: cx, y: pdfY, size: fragment.fontSize, font: pdfFont, color: rgb(r, g, b) })
            cx += pdfFont.widthOfTextAtSize(ch, fragment.fontSize) + fragment.letterSpacing
          }
        } else {
          pdfPage.drawText(drawText, { x: drawX, y: pdfY, size: fragment.fontSize, font: pdfFont, color: rgb(r, g, b) })
        }
        const fragWidth = pdfFont.widthOfTextAtSize(drawText, fragment.fontSize)
        drawTextDecoration(pdfPage, drawX, fragWidth, pdfY, fragment.fontSize, pdfFont, [r, g, b], { underline: fragment.underline ?? false, strikethrough: fragment.strikethrough ?? false })
        if (fragment.url) addLinkAnnotation(pdfDoc, pdfPage, drawX, pdfY, fragWidth, fragment.fontSize, fragment.url)
      }
      cumY += richLine.lineHeight
    }
  } else {
    const pdfFont = fontMap.get(fd.textFontKey)
    if (!pdfFont) throw new PretextPdfError('FONT_NOT_LOADED', `Float text font key "${fd.textFontKey}" not found in fontMap. This is a bug — font loading should have caught this.`)
    const fontHeight = pdfFont.heightAtSize(fd.textFontSize)
    const [r, g, b] = hexToRgb(fd.textColor)
    for (let i = 0; i < fd.textLines.length; i++) {
      const line = fd.textLines[i]!
      if (line.text === '') continue
      const lineAbsY = baseAbsY + (i * fd.textLineHeight)
      const pdfY = toPdfY(lineAbsY, fontHeight, geo.pageHeight)
      pdfPage.drawText(line.text.trimEnd(), { x: textBaseX, y: pdfY, size: fd.textFontSize, font: pdfFont, color: rgb(r, g, b) })
    }
  }
}

// ─── Float group block rendering ──────────────────────────────────────────────

export function renderFloatGroup(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  pagedBlock: PagedBlock,
  geo: PageGeometry,
  fontMap: FontMap,
  imageMap: ImageMap,
  _pdfDoc: PDFDocument,
): void {
  const { measuredBlock, yFromTop } = pagedBlock
  const fd = measuredBlock.floatGroupData!
  const baseAbsY = yFromTop + geo.margins.top + geo.headerHeight

  // Draw image
  const pdfImage = imageMap.get(fd.imageKey)
  if (!pdfImage) throw new PretextPdfError('IMAGE_LOAD_FAILED', `Float group image key "${fd.imageKey}" not found in imageMap. This is a bug — image loading should have caught this.`)

  const imgX = geo.margins.left + fd.imageColX
  const imgPdfY = toPdfY(baseAbsY, fd.imageRenderHeight, geo.pageHeight)
  pdfPage.drawImage(pdfImage, {
    x: imgX,
    y: imgPdfY,
    width: fd.imageRenderWidth,
    height: fd.imageRenderHeight,
  })

  // Draw text items
  const textBaseX = geo.margins.left + fd.textColX

  for (const textItem of fd.textItems) {
    const pdfFont = fontMap.get(textItem.fontKey)
    if (!pdfFont) throw new PretextPdfError('FONT_NOT_LOADED', `Float group font key "${textItem.fontKey}" not found in fontMap. This is a bug — font loading should have caught this.`)

    const fontHeight = pdfFont.heightAtSize(textItem.fontSize)

    // Draw plain lines (plain-text fallback for rich-paragraphs)
    for (let i = 0; i < textItem.lines.length; i++) {
      const line = textItem.lines[i]!
      if (line.text === '') continue

      const lineAbsY = baseAbsY + textItem.yOffsetFromTop + (i * textItem.lineHeight)
      const pdfY = toPdfY(lineAbsY, fontHeight, geo.pageHeight)

      pdfPage.drawText(line.text.trimEnd(), {
        x: textBaseX,
        y: pdfY,
        size: textItem.fontSize,
        font: pdfFont,
        color: rgb(0, 0, 0),
      })
    }
  }
}
