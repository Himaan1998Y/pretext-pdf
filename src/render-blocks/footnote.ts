/**
 * render-blocks/footnote.ts — Footnote zone rendering
 */

import { PDFDocument, rgb } from '@cantoo/pdf-lib'
import type {
  FootnoteDefElement, PdfDocument
} from '../types.js'
import type {
  FontMap, PageGeometry
} from '../types-internal.js'
import {
  LINE_HEIGHT_BODY,
} from '../render-utils.js'
import { buildFontKey } from '../measure.js'

// ─── Footnote zone rendering ──────────────────────────────────────────────────

export function renderFootnoteZone(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  footnoteItems: Array<{ def: FootnoteDefElement; number: number }>,
  zoneHeight: number,
  fontMap: FontMap,
  doc: PdfDocument,
  geo: PageGeometry
): void {
  const { margins, footerHeight, contentWidth } = geo
  const SEPARATOR_PADDING = 6 // pt above and below the separator line

  // Zone top in PDF coords (Y=0 at bottom of page)
  const zoneTopPdfY = margins.bottom + footerHeight + zoneHeight
  const separatorY = zoneTopPdfY - SEPARATOR_PADDING

  // Draw separator line: 1/3 content width, max 120pt
  const lineLength = Math.min(contentWidth * 0.33, 120)
  pdfPage.drawLine({
    start: { x: margins.left, y: separatorY },
    end:   { x: margins.left + lineLength, y: separatorY },
    thickness: 0.5,
    color: rgb(0.5, 0.5, 0.5),
  })

  const defaultFontSize = doc.defaultFontSize ?? 12
  let currentPdfY = separatorY - SEPARATOR_PADDING

  for (const { def, number } of footnoteItems) {
    const fontSize = def.fontSize ?? Math.max(8, defaultFontSize - 2)
    const lineHeight = fontSize * LINE_HEIGHT_BODY
    const fontFamily = def.fontFamily ?? doc.defaultFont ?? 'Inter'
    const fontKey = buildFontKey(fontFamily, 400, 'normal')
    const pdfFont = fontMap.get(fontKey)
    if (!pdfFont) continue

    currentPdfY -= lineHeight

    const prefix = `${number}. `
    const fullText = prefix + def.text
    pdfPage.drawText(fullText, {
      x: margins.left,
      y: currentPdfY,
      size: fontSize,
      font: pdfFont,
      color: rgb(0.2, 0.2, 0.2),
    })

    currentPdfY -= (def.spaceAfter ?? 4)
  }
}
