/**
 * render-blocks/watermark.ts — Watermark rendering
 */

import { PDFDocument, rgb, degrees } from '@cantoo/pdf-lib'
import type { PdfDocument } from '../types.js'
import type {
  FontMap, ImageMap, PageGeometry
} from '../types-internal.js'
import { PretextPdfError } from '../errors.js'
import {
  hexToRgb,
} from '../render-utils.js'

// ─── Watermark rendering ──────────────────────────────────────────────────

export function renderWatermark(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  doc: PdfDocument,
  fontMap: FontMap,
  imageMap: ImageMap,
  geo: PageGeometry
): void {
  const wm = doc.watermark
  if (!wm) return

  const opacity = wm.opacity ?? 0.3
  const rotation = wm.rotation ?? -45
  const { pageWidth, pageHeight } = geo

  if (wm.text) {
    const fontKey = `${wm.fontFamily ?? doc.defaultFont ?? 'Inter'}-${wm.fontWeight ?? 400}-normal`
    const pdfFont = fontMap.get(fontKey)
    if (!pdfFont) {
      throw new PretextPdfError('FONT_NOT_LOADED',
        `Watermark font "${fontKey}" not found in fontMap. This is a bug.`)
    }

    // Auto-compute font size to span ~60% of page diagonal
    const fontSize = wm.fontSize ?? (() => {
      const diagonal = Math.sqrt(pageWidth ** 2 + pageHeight ** 2)
      const widthAt100 = pdfFont.widthOfTextAtSize(wm.text, 100)
      return Math.min(120, (diagonal * 0.6 / widthAt100) * 100)
    })()

    const [r, g, b] = hexToRgb(wm.color ?? '#CCCCCC')
    pdfPage.drawText(wm.text, {
      x: pageWidth / 2,
      y: pageHeight / 2,
      size: fontSize,
      font: pdfFont,
      color: rgb(r, g, b),
      rotate: degrees(rotation),
      opacity,
    })
  }

  if (wm.image) {
    const pdfImage = imageMap.get('watermark')
    if (!pdfImage) return
    const margin = 40
    pdfPage.drawImage(pdfImage, {
      x: margin,
      y: margin,
      width: pageWidth - margin * 2,
      height: pageHeight - margin * 2,
      opacity,
    })
  }
}
