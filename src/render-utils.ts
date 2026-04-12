/**
 * render-utils.ts — Pure utility functions for PDF rendering
 * No element-type knowledge. Used by all render modules.
 */

import { PDFDocument, PDFFont, PDFName, PDFNull, PDFRef, PDFString, rgb } from '@cantoo/pdf-lib'

/**
 * Draw a single line of text with justified alignment.
 * Spaces between words are stretched so the line fills availableWidth.
 * The last line of a paragraph is left-aligned (standard typographic convention).
 */
export function drawJustifiedLine(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  lineText: string,
  isLastLine: boolean,
  x: number,
  pdfY: number,
  availableWidth: number,
  fontSize: number,
  pdfFont: PDFFont,
  color: ReturnType<typeof rgb>
): void {
  const trimmed = lineText.trimEnd()

  // Last line or single word: left-align (can't stretch)
  if (isLastLine) {
    pdfPage.drawText(trimmed, { x, y: pdfY, size: fontSize, font: pdfFont, color })
    return
  }

  const words = trimmed.split(' ').filter(w => w.length > 0)
  if (words.length <= 1) {
    pdfPage.drawText(trimmed, { x, y: pdfY, size: fontSize, font: pdfFont, color })
    return
  }

  const wordWidths = words.map(w => pdfFont.widthOfTextAtSize(w, fontSize))
  const totalWordWidth = wordWidths.reduce((s, w) => s + w, 0)
  const gapSize = Math.max(0, (availableWidth - totalWordWidth) / (words.length - 1))

  let curX = x
  for (let i = 0; i < words.length; i++) {
    pdfPage.drawText(words[i]!, { x: curX, y: pdfY, size: fontSize, font: pdfFont, color })
    curX += wordWidths[i]! + gapSize
  }
}

/**
 * Adds a clickable URI annotation over a rendered text region.
 * Must be called after drawText() — annotation sits above the text layer.
 */
export function addLinkAnnotation(
  pdfDoc: PDFDocument,
  pdfPage: ReturnType<PDFDocument['addPage']>,
  x: number,
  pdfY: number,
  width: number,
  fontSize: number,
  url: string
): void {
  const rectBottom = pdfY - fontSize * 0.2
  const rectTop    = pdfY + fontSize * 0.8

  const linkAnnot = pdfDoc.context.register(
    pdfDoc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [x, rectBottom, x + width, rectTop],
      Border: [0, 0, 0],
      A: pdfDoc.context.obj({
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of(url),
      }),
    })
  )

  const existingAnnots = pdfPage.node.get(PDFName.of('Annots'))
  if (existingAnnots) {
    const annots = pdfDoc.context.lookup(existingAnnots) as any
    annots.push(linkAnnot)
  } else {
    pdfPage.node.set(PDFName.of('Annots'), pdfDoc.context.obj([linkAnnot]))
  }
}

/**
 * Adds a clickable internal anchor link (GoTo) annotation over a rendered text region.
 * Jumps to a page with a named destination when clicked.
 * Must be called after drawText() — annotation sits above the text layer.
 */
export function addGoToAnnotation(
  pdfDoc: PDFDocument,
  pdfPage: ReturnType<PDFDocument['addPage']>,
  x: number,
  pdfY: number,
  width: number,
  fontSize: number,
  destPageRef: PDFRef,
  destPdfY: number
): void {
  const rectBottom = pdfY - fontSize * 0.2
  const rectTop = pdfY + fontSize * 0.8

  const goToAnnot = pdfDoc.context.register(
    pdfDoc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [x, rectBottom, x + width, rectTop],
      Border: [0, 0, 0],
      Dest: pdfDoc.context.obj([destPageRef, PDFName.of('XYZ'), PDFNull, destPdfY, PDFNull]),
    })
  )

  const existingAnnots = pdfPage.node.get(PDFName.of('Annots'))
  if (existingAnnots) {
    const annots = pdfDoc.context.lookup(existingAnnots) as any
    annots.push(goToAnnot)
  } else {
    pdfPage.node.set(PDFName.of('Annots'), pdfDoc.context.obj([goToAnnot]))
  }
}

/**
 * Adds a sticky-note (Text) annotation at the given position.
 */
export function addStickyNoteAnnotation(
  pdfDoc: PDFDocument,
  pdfPage: ReturnType<PDFDocument['addPage']>,
  x: number,
  pdfY: number,
  contents: string,
  author?: string,
  color?: string,
  open?: boolean
): void {
  const hex = (color ?? '#FFFF00').replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255

  const annotRef = pdfDoc.context.register(
    pdfDoc.context.obj({
      Type: 'Annot',
      Subtype: 'Text',
      Rect: [x, pdfY - 16, x + 16, pdfY],
      Contents: PDFString.of(contents),
      T: author ? PDFString.of(author) : PDFNull,
      Open: open === true,
      Name: 'Comment',
      C: [r, g, b],
    })
  )

  const existingAnnots = pdfPage.node.get(PDFName.of('Annots'))
  if (existingAnnots) {
    const annots = pdfDoc.context.lookup(existingAnnots) as any
    annots.push(annotRef)
  } else {
    pdfPage.node.set(PDFName.of('Annots'), pdfDoc.context.obj([annotRef]))
  }
}

/**
 * Draws underline and/or strikethrough lines for a rendered text segment.
 * Must be called AFTER drawText() so text renders on top of any decoration line.
 */
export function drawTextDecoration(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  x: number,
  width: number,
  pdfY: number,
  fontSize: number,
  pdfFont: PDFFont,
  color: [number, number, number],
  decoration: { underline: boolean; strikethrough: boolean }
): void {
  if (!decoration.underline && !decoration.strikethrough) return

  // Prefer font-designed metrics via fontkit embedder; fall back to height math
  const embedder = (pdfFont as any).embedder
  const fkFont   = embedder?.font    // fontkit Font object (undefined for standard fonts)
  const scale    = embedder?.scale ?? 1
  const ascentPt = pdfFont.heightAtSize(fontSize, { descender: false })

  const thickness = fkFont
    ? Math.max(0.5, (fkFont.underlineThickness * scale / 1000) * fontSize)
    : Math.max(0.5, fontSize / 14)

  const [r, g, b] = color
  const lineColor = rgb(r, g, b)

  if (decoration.underline) {
    const ulY = fkFont
      ? pdfY + (fkFont.underlinePosition * scale / 1000) * fontSize
      : pdfY - ascentPt * 0.12
    pdfPage.drawLine({
      start: { x, y: ulY },
      end:   { x: x + width, y: ulY },
      thickness,
      color: lineColor,
    })
  }

  if (decoration.strikethrough) {
    const strikeY = fkFont
      ? pdfY + (fkFont.xHeight * scale / 1000) * fontSize * 0.5
      : pdfY + ascentPt * 0.38
    pdfPage.drawLine({
      start: { x, y: strikeY },
      end:   { x: x + width, y: strikeY },
      thickness,
      color: lineColor,
    })
  }
}

const DIGIT_CHARS = '0123456789'

/**
 * Draw text with tabular (monospaced) digit spacing.
 * Each digit occupies a fixed slot = widest digit glyph in the font at the given size.
 * Non-digit characters render at their natural width.
 *
 * First-principle rationale: proportional fonts vary digit widths (1 is narrower than 0).
 * Tabular mode normalises all digits to the same advance, so columns of numbers
 * align perfectly with no font-specific OpenType tables required.
 */
export function drawTabularText(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  text: string,
  x: number,
  pdfY: number,
  fontSize: number,
  pdfFont: PDFFont,
  color: ReturnType<typeof rgb>
): void {
  let slotWidth = 0
  for (const d of DIGIT_CHARS) {
    const w = pdfFont.widthOfTextAtSize(d, fontSize)
    if (w > slotWidth) slotWidth = w
  }

  let curX = x
  for (const ch of text) {
    if (DIGIT_CHARS.includes(ch)) {
      const charW = pdfFont.widthOfTextAtSize(ch, fontSize)
      pdfPage.drawText(ch, { x: curX + (slotWidth - charW) / 2, y: pdfY, size: fontSize, font: pdfFont, color })
      curX += slotWidth
    } else {
      pdfPage.drawText(ch, { x: curX, y: pdfY, size: fontSize, font: pdfFont, color })
      curX += pdfFont.widthOfTextAtSize(ch, fontSize)
    }
  }
}

/**
 * THE ONLY place where top-down coords are converted to pdf-lib bottom-up coords.
 * @param yFromTop - distance from top of page in pt
 * @param elementHeight - height of the element (font baseline offset, image height, etc.)
 * @param pageHeight - total page height in pt
 */
export function toPdfY(yFromTop: number, elementHeight: number, pageHeight: number): number {
  return pageHeight - yFromTop - elementHeight
}

/** Resolve text horizontal position based on alignment */
export function resolveX(
  align: 'left' | 'center' | 'right',
  startX: number,
  availableWidth: number,
  lineWidth: number
): number {
  switch (align) {
    case 'left':
      return startX
    case 'center':
      return startX + (availableWidth - lineWidth) / 2
    case 'right':
      return startX + availableWidth - lineWidth
  }
}

/** Replace {{pageNumber}} and {{totalPages}} tokens */
export function resolveTokens(text: string, pageNumber: number, totalPages: number): string {
  return text
    .replace('{{pageNumber}}', String(pageNumber))
    .replace('{{totalPages}}', String(totalPages))
}

/** Parse a 6-digit hex color string to normalized RGB [0,1] triple.
 *  Falls back to black on invalid/missing input to prevent NaN from reaching pdf-lib. */
export function hexToRgb(hex: string | null | undefined): [number, number, number] {
  if (!hex || typeof hex !== 'string') return [0, 0, 0]
  const clean = hex.startsWith('#') ? hex.slice(1) : hex
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return [0, 0, 0]
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  return [r, g, b]
}
