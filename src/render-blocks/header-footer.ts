/**
 * render-blocks/header-footer.ts — Header / Footer rendering
 */

import { PDFDocument, rgb } from '@cantoo/pdf-lib'
import type { HeaderFooterSpec } from '../types.js'
import type {
  FontMap, PageGeometry
} from '../types-internal.js'
import { PretextPdfError } from '../errors.js'
import {
  toPdfY,
  resolveX,
  resolveTokens,
  hexToRgb,
} from '../render-utils.js'

// ─── Header / Footer rendering ────────────────────────────────────────────────

export function renderHeaderFooter(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  spec: HeaderFooterSpec,
  pageNumber: number,
  totalPages: number,
  geo: PageGeometry,
  fontMap: FontMap,
  position: 'header' | 'footer',
  extra?: { date?: string; author?: string }
): void {
  const text = resolveTokens(spec.text, pageNumber, totalPages, extra)
  const fontSize = spec.fontSize ?? 10
  const align = spec.align ?? 'center'
  const fontKey = `${spec.fontFamily ?? 'Inter'}-${spec.fontWeight ?? 400}-normal`
  const pdfFont = fontMap.get(fontKey)
  if (!pdfFont) {
    throw new PretextPdfError(
      'FONT_NOT_LOADED',
      `${position} font "${fontKey}" not found in fontMap. This is a bug — font validation should have caught this.`
    )
  }

  const fontHeight = pdfFont.heightAtSize(fontSize)

  let yFromTop: number
  if (position === 'header') {
    yFromTop = (geo.margins.top - fontHeight) / 2
  } else {
    yFromTop = geo.pageHeight - geo.margins.bottom + (geo.margins.bottom - fontHeight) / 2
  }

  const pdfY = toPdfY(yFromTop, fontHeight, geo.pageHeight)
  const textWidth = pdfFont.widthOfTextAtSize(text, fontSize)
  const x = resolveX(align, geo.margins.left, geo.contentWidth, textWidth)

  const [textR, textG, textB] = hexToRgb(spec.color ?? '#666666')
  pdfPage.drawText(text, {
    x,
    y: pdfY,
    size: fontSize,
    font: pdfFont,
    color: rgb(textR, textG, textB),
  })

  // Separator line
  if (position === 'header') {
    const lineY = toPdfY(geo.margins.top - 4, 1, geo.pageHeight)
    pdfPage.drawLine({
      start: { x: geo.margins.left, y: lineY },
      end: { x: geo.margins.left + geo.contentWidth, y: lineY },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    })
  } else {
    const lineY = toPdfY(geo.pageHeight - geo.margins.bottom + 4, 1, geo.pageHeight)
    pdfPage.drawLine({
      start: { x: geo.margins.left, y: lineY },
      end: { x: geo.margins.left + geo.contentWidth, y: lineY },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    })
  }
}
