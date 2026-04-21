/**
 * render-extras.ts — PDF structure rendering (bookmarks, TOC, forms, signatures)
 * These are meta-layer concerns distinct from content block rendering.
 */

import { PDFDocument, PDFFont, PDFName, PDFNull, PDFRef, PDFString, rgb } from '@cantoo/pdf-lib'
import type { PaginatedDocument, FontMap, PageGeometry, PagedBlock } from './types.js'
import { PretextPdfError } from './errors.js'
import { toPdfY, hexToRgb } from './render-utils.js'

// ─── Outline / Bookmarks ──────────────────────────────────────────────────────

/**
 * Build PDF outline (bookmarks/TOC) from heading entries.
 * Creates a doubly-linked tree in the PDF catalog.
 * Must be called after all pages are rendered but before pdfDoc.save().
 */
export function buildOutlineTree(
  pdfDoc: PDFDocument,
  headings: PaginatedDocument['headings'],
  bookmarkConfig: import('./types.js').PdfDocument['bookmarks']
): void {
  if (bookmarkConfig === false || headings.length === 0) return

  const cfg = typeof bookmarkConfig === 'object' ? bookmarkConfig : {}
  const minLevel = cfg.minLevel ?? 1
  const maxLevel = cfg.maxLevel ?? 4

  const filtered = headings.filter(h => h.level >= minLevel && h.level <= maxLevel)
  if (filtered.length === 0) return

  const pageRefs = pdfDoc.getPages().map(p => p.ref)
  const outlineRef = pdfDoc.context.nextRef()
  const itemRefs = filtered.map(() => pdfDoc.context.nextRef())

  // Pre-compute parent index for every heading (O(n)) to avoid repeated O(n) scans inside loops
  const parentOf: number[] = filtered.map((_, i) => {
    for (let j = i - 1; j >= 0; j--) {
      if (filtered[j]!.level < filtered[i]!.level) return j
    }
    return -1
  })

  for (let i = 0; i < filtered.length; i++) {
    const h = filtered[i]!
    const pageRef = pageRefs[h.pageIndex] ?? pageRefs[pageRefs.length - 1]!
    const myParentIdx = parentOf[i]!
    const myParentRef = myParentIdx === -1 ? outlineRef : itemRefs[myParentIdx]!

    const dest = pdfDoc.context.obj([pageRef, PDFName.of('XYZ'), PDFNull, PDFNull, PDFNull])

    let prevRef: PDFRef | undefined
    for (let j = i - 1; j >= 0; j--) {
      if (filtered[j]!.level === h.level && parentOf[j] === myParentIdx) {
        prevRef = itemRefs[j]; break
      }
    }

    let nextRef: PDFRef | undefined
    for (let j = i + 1; j < filtered.length; j++) {
      if (filtered[j]!.level === h.level && parentOf[j] === myParentIdx) {
        nextRef = itemRefs[j]; break
      }
    }

    let firstChildRef: PDFRef | undefined
    let lastChildRef: PDFRef | undefined
    let childCount = 0
    for (let j = i + 1; j < filtered.length; j++) {
      if (filtered[j]!.level <= h.level) break
      if (parentOf[j] === i) {
        if (!firstChildRef) firstChildRef = itemRefs[j]
        lastChildRef = itemRefs[j]
        childCount++
      }
    }

    const entry: Record<string, unknown> = {
      Title: PDFString.of(h.text),
      Parent: myParentRef,
      Dest: dest,
    }
    if (prevRef) entry['Prev'] = prevRef
    if (nextRef) entry['Next'] = nextRef
    if (firstChildRef) entry['First'] = firstChildRef
    if (lastChildRef) entry['Last'] = lastChildRef
    if (childCount > 0) entry['Count'] = childCount

    pdfDoc.context.assign(itemRefs[i]!, pdfDoc.context.obj(entry as any)) // pdf-lib: obj() accepts Record<string,unknown> at runtime but types don't reflect it
  }

  const topIdxs = filtered.map((_, i) => i).filter(i => parentOf[i] === -1)
  const rootEntry: Record<string, unknown> = {
    Type: PDFName.of('Outlines'),
    Count: filtered.length,
  }
  if (topIdxs.length > 0) {
    rootEntry['First'] = itemRefs[topIdxs[0]!]!
    rootEntry['Last'] = itemRefs[topIdxs[topIdxs.length - 1]!]!
  }
  pdfDoc.context.assign(outlineRef, pdfDoc.context.obj(rootEntry as any)) // pdf-lib: same runtime/type mismatch as above

  pdfDoc.catalog.set(PDFName.of('Outlines'), outlineRef)
  pdfDoc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'))
}

// ─── TOC Entry Rendering ────────────────────────────────────────────

export function renderTocEntry(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  pagedBlock: PagedBlock,
  geo: PageGeometry,
  fontMap: FontMap,
): void {
  const { measuredBlock, startLine, endLine, yFromTop } = pagedBlock
  const element = measuredBlock.element as import('./types.js').TocEntryElement
  const tocData = measuredBlock.tocEntryData!
  const lines = measuredBlock.lines.slice(startLine, endLine)
  if (lines.length === 0) return

  const pdfFont = fontMap.get(measuredBlock.fontKey)
  if (!pdfFont) throw new PretextPdfError('FONT_NOT_LOADED', `TOC font "${measuredBlock.fontKey}" not found.`)

  const fontHeight = pdfFont.heightAtSize(measuredBlock.fontSize)
  const entryX = geo.margins.left + tocData.entryX
  const rightEdge = geo.margins.left + geo.contentWidth

  for (let i = 0; i < lines.length; i++) {
    const lineYFromTop = yFromTop + (i * measuredBlock.lineHeight)
    const absY = lineYFromTop + geo.margins.top + geo.headerHeight
    const pdfY = toPdfY(absY, fontHeight, geo.pageHeight)

    const text = lines[i]!.text.trimEnd()
    if (!text) continue

    // Draw entry text
    pdfPage.drawText(text, { x: entryX, y: pdfY, size: measuredBlock.fontSize, font: pdfFont, color: rgb(0, 0, 0) })

    // Title lines (pageStr === ''): no leader, no page number
    if (!tocData.pageStr) continue

    // Only draw leader and page number on the last line of multi-line entries
    if (i < lines.length - 1) continue

    // Draw page number (right-aligned)
    const pageStr = tocData.pageStr
    const pageStrWidth = pdfFont.widthOfTextAtSize(pageStr, measuredBlock.fontSize)
    const pageX = rightEdge - pageStrWidth
    pdfPage.drawText(pageStr, { x: pageX, y: pdfY, size: measuredBlock.fontSize, font: pdfFont, color: rgb(0, 0, 0) })

    // Draw dot leaders between text and page number
    if (tocData.leaderChar) {
      const textWidth = pdfFont.widthOfTextAtSize(text, measuredBlock.fontSize)
      const leaderCharWidth = pdfFont.widthOfTextAtSize(tocData.leaderChar, measuredBlock.fontSize)
      const gapStart = entryX + textWidth + 6  // 6pt gap after text
      const gapEnd = pageX - 6                 // 6pt gap before page number
      let lx = gapStart
      while (lx + leaderCharWidth <= gapEnd) {
        pdfPage.drawText(tocData.leaderChar, { x: lx, y: pdfY, size: measuredBlock.fontSize, font: pdfFont, color: rgb(0.5, 0.5, 0.5) })
        lx += leaderCharWidth + 1
      }
    }
  }
}

// ─── Form Fields ────────────────────────────────────────────────────

/** Render an interactive AcroForm field. */
export function renderFormField(
  block: PagedBlock,
  pdfPage: ReturnType<PDFDocument['addPage']>,
  pdfDoc: PDFDocument,
  fontMap: FontMap,
  geo: PageGeometry,
  yFromTop: number
): void {
  const el = block.measuredBlock.element as import('./types.js').FormFieldElement
  const { labelHeight, fieldHeight } = block.measuredBlock.formFieldData ?? { labelHeight: 0, fieldHeight: 24 }
  const form = pdfDoc.getForm()
  const x = geo.margins.left
  const fieldWidth = el.width ?? geo.contentWidth
  const absYTop = yFromTop + geo.margins.top + geo.headerHeight
  const fieldBottomPdfY = geo.pageHeight - absYTop - labelHeight - fieldHeight

  // Draw label if set — baseline must be inset by font height so glyphs sit within the block
  if (el.label && labelHeight > 0) {
    const font = fontMap.get(block.measuredBlock.fontKey)
    if (font) {
      const labelFontSize = el.fontSize ?? 12
      const fontHeight = font.heightAtSize(labelFontSize)
      const labelPdfY = geo.pageHeight - absYTop - fontHeight
      pdfPage.drawText(el.label, {
        x,
        y: labelPdfY,
        size: labelFontSize,
        font,
        color: rgb(0, 0, 0),
      })
    }
  }

  const borderRgb = hexToRgb(el.borderColor ?? '#999999')
  const bgRgb = hexToRgb(el.backgroundColor ?? '#FFFFFF')
  const fieldOpts = {
    x,
    y: fieldBottomPdfY,
    width: fieldWidth,
    height: fieldHeight,
    borderColor: rgb(borderRgb[0], borderRgb[1], borderRgb[2]),
    backgroundColor: rgb(bgRgb[0], bgRgb[1], bgRgb[2]),
  }

  switch (el.fieldType) {
    case 'text': {
      const field = form.createTextField(el.name)
      if (el.defaultValue) field.setText(el.defaultValue)
      if (el.multiline) field.enableMultiline()
      if (el.maxLength) field.setMaxLength(el.maxLength)
      field.addToPage(pdfPage, fieldOpts)
      break
    }
    case 'checkbox': {
      const field = form.createCheckBox(el.name)
      if (el.checked) field.check()
      field.addToPage(pdfPage, {
        x,
        y: fieldBottomPdfY,
        width: fieldHeight,
        height: fieldHeight,
        borderColor: rgb(borderRgb[0], borderRgb[1], borderRgb[2]),
        backgroundColor: rgb(bgRgb[0], bgRgb[1], bgRgb[2]),
      })
      break
    }
    case 'radio': {
      const group = form.createRadioGroup(el.name)
      const opts = el.options ?? []
      const minButtonSize = 16
      const maxVisible = Math.max(1, Math.floor(fieldHeight / minButtonSize))
      const visibleOpts = opts.slice(0, maxVisible)
      if (opts.length > maxVisible) {
        process.stderr.write(`[pretext-pdf] Warning: radio group "${el.name}" has ${opts.length} options but only ${maxVisible} fit in ${fieldHeight}pt height. Increase element height to show all options.\n`)
      }
      const optHeight = Math.max(minButtonSize, Math.floor(fieldHeight / Math.max(1, visibleOpts.length)))
      for (let i = 0; i < visibleOpts.length; i++) {
        group.addOptionToPage(visibleOpts[i]!.value, pdfPage, {
          x,
          y: fieldBottomPdfY + fieldHeight - optHeight * (i + 1),
          width: optHeight,
          height: optHeight,
          borderColor: rgb(borderRgb[0], borderRgb[1], borderRgb[2]),
        })
      }
      if (el.defaultSelected) {
        try { group.select(el.defaultSelected) } catch { /* option may not exist */ }
      }
      break
    }
    case 'dropdown': {
      const field = form.createDropdown(el.name)
      const opts = (el.options ?? []).map(o => o.value)
      if (opts.length > 0) field.addOptions(opts)
      if (el.defaultSelected) {
        try { field.select(el.defaultSelected) } catch { /* option may not exist */ }
      }
      field.addToPage(pdfPage, fieldOpts)
      break
    }
    case 'button': {
      const field = form.createButton(el.name)
      field.addToPage(el.label ?? el.name, pdfPage, fieldOpts)
      break
    }
  }
}

// ─── Signature Placeholder ──────────────────────────────────────────

/** Draw a visual signature placeholder box on the specified page. */
export function renderSignaturePlaceholder(
  sig: import('./types.js').SignatureSpec,
  pdfDoc: PDFDocument,
  fontMap: import('./types.js').FontMap,
  geo: import('./types.js').PageGeometry
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
