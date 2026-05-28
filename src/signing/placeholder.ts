import { PDFDocument, rgb } from '@cantoo/pdf-lib'
import type { FontMap, PageGeometry } from '../types-internal.js'
import { hexToRgb } from '../render-utils.js'

/** Draw a visual signature placeholder box on the specified page. */
export function renderSignaturePlaceholder(
  sig: import('../types.js').SignatureSpec,
  pdfDoc: PDFDocument,
  fontMap: FontMap,
  geo: PageGeometry
): void {
  const pages = pdfDoc.getPages()
  if (pages.length === 0) return

  const pageIndex = sig.page !== undefined
    ? Math.min(sig.page, pages.length - 1)
    : pages.length - 1
  const page = pages[pageIndex]!
  if (!page) return

  const boxWidth = sig.width ?? 200
  const boxHeight = sig.height ?? 60
  const x = sig.x ?? geo.margins.left
  const yFromTop = sig.y ?? (geo.pageHeight - geo.margins.bottom - boxHeight)
  const pdfY = geo.pageHeight - yFromTop - boxHeight
  const fs = sig.fontSize ?? 8

  const borderRgb = hexToRgb(sig.borderColor ?? '#000000')
  const borderColor = rgb(borderRgb[0], borderRgb[1], borderRgb[2])
  const grayColor = rgb(0.5, 0.5, 0.5)
  const font = fontMap.get('Inter-400-normal') ?? [...fontMap.values()][0]

  if (!font) return

  // Draw outer border rectangle (white fill)
  page.drawRectangle({
    x,
    y: pdfY,
    width: boxWidth,
    height: boxHeight,
    borderColor,
    borderWidth: 0.5,
    color: rgb(1, 1, 1),
  })

  let lineY = pdfY + boxHeight - fs - 6

  // Signer name line
  if (sig.signerName) {
    page.drawText(`Signed by: ${sig.signerName}`, {
      x: x + 6, y: lineY, size: fs, font, color: rgb(0, 0, 0),
    })
    lineY -= fs + 4
  }

  // Signature underline
  page.drawLine({
    start: { x: x + 6, y: lineY },
    end: { x: x + boxWidth - 12, y: lineY },
    thickness: 0.3,
    color: grayColor,
  })
  page.drawText('Signature', {
    x: x + 6, y: lineY - fs, size: fs - 1, font, color: grayColor,
  })
  lineY -= fs + 8

  // Date underline (half width)
  page.drawLine({
    start: { x: x + 6, y: lineY },
    end: { x: x + boxWidth / 2, y: lineY },
    thickness: 0.3,
    color: grayColor,
  })
  page.drawText('Date', {
    x: x + 6, y: lineY - fs, size: fs - 1, font, color: grayColor,
  })

  // Reason / location at bottom
  if (sig.reason || sig.location) {
    const bottomText = [sig.reason, sig.location].filter(Boolean).join(' — ')
    page.drawText(bottomText, {
      x: x + 6, y: pdfY + 3, size: fs - 1, font, color: rgb(0.4, 0.4, 0.4),
    })
  }
}
