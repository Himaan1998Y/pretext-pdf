import { PDFDocument, PDFFont, PDFName, PDFString, PDFNull, PDFRef, rgb, degrees } from '@cantoo/pdf-lib'
import type {
  PdfDocument, PaginatedDocument, PagedBlock, MeasuredBlock,
  FontMap, ImageMap, PageGeometry, HeaderFooterSpec, FootnoteDefElement
} from './types.js'
import { buildFontKey } from './measure.js'
import { PretextPdfError } from './errors.js'

/**
 * Stage 5: Render.
 * Takes the paginated document + pre-initialized pdfDoc (with fonts already embedded)
 * and produces the final PDF bytes.
 *
 * pdfDoc is NOT created here — it comes from index.ts with fonts already embedded.
 * imageMap contains pre-embedded PDFImage instances.
 */
export async function renderDocument(
  paginatedDoc: PaginatedDocument,
  doc: PdfDocument,
  fontMap: FontMap,
  imageMap: ImageMap,
  pdfDoc: PDFDocument,
  geo: PageGeometry
): Promise<Uint8Array> {
  const { pageWidth, pageHeight, margins, contentWidth } = geo

  for (const renderedPage of paginatedDoc.pages) {
    const pdfPage = pdfDoc.addPage([pageWidth, pageHeight])
    const pageNumber = renderedPage.pageIndex + 1
    const totalPages = paginatedDoc.totalPages

    // Render watermark (behind content)
    renderWatermark(pdfPage, doc, fontMap, imageMap, geo)

    // Render content blocks
    for (const pagedBlock of renderedPage.blocks) {
      renderBlock(pdfPage, pagedBlock, geo, fontMap, imageMap, pdfDoc, paginatedDoc.footnoteNumbering)
    }

    // Render footnote zone (above footer, if this page has footnotes)
    if (renderedPage.footnoteItems && renderedPage.footnoteItems.length > 0) {
      try {
        renderFootnoteZone(
          pdfPage,
          renderedPage.footnoteItems,
          renderedPage.footnoteZoneHeight ?? 0,
          fontMap,
          doc,
          geo
        )
      } catch (e) {
        if (e instanceof PretextPdfError) throw e
        throw new PretextPdfError('RENDER_FAILED', 'Failed to render footnote zone')
      }
    }

    // Render header
    if (doc.header) {
      renderHeaderFooter(pdfPage, doc.header, pageNumber, totalPages, geo, fontMap, 'header')
    }

    // Render footer
    if (doc.footer) {
      renderHeaderFooter(pdfPage, doc.footer, pageNumber, totalPages, geo, fontMap, 'footer')
    }
  }

  if (doc.bookmarks !== false) {
    buildOutlineTree(pdfDoc, paginatedDoc.headings, doc.bookmarks)
  }

  // Phase 8E: render signature placeholder if configured
  if (doc.signature) {
    renderSignaturePlaceholder(doc.signature, pdfDoc, fontMap, geo)
  }

  // Phase 8B: finalize form field appearances
  try {
    const form = pdfDoc.getForm()
    if (form.getFields().length > 0) {
      const defaultFont = fontMap.get('Inter-400-normal') ?? [...fontMap.values()][0]
      if (defaultFont) {
        try { form.updateFieldAppearances(defaultFont) } catch { /* non-fatal */ }
      }
      if (doc.flattenForms) {
        try {
          form.flatten()
        } catch (e) {
          throw new PretextPdfError('FORM_FLATTEN_FAILED', 'Failed to flatten form fields')
        }
      }
    }
  } catch (e) {
    if (e instanceof PretextPdfError) throw e
    // getForm() failed — not a critical error if no fields exist
  }

  return pdfDoc.save({ useObjectStreams: false })
}

// ─── Block routing ────────────────────────────────────────────────────────────

function renderBlock(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  pagedBlock: PagedBlock,
  geo: PageGeometry,
  fontMap: FontMap,
  imageMap: ImageMap,
  pdfDoc: PDFDocument,
  footnoteNumbering?: Map<string, number>
): void {
  const { measuredBlock } = pagedBlock
  const { element } = measuredBlock

  switch (element.type) {
    case 'spacer':
      return // No visual output

    case 'paragraph':
    case 'heading':
      renderTextBlock(pdfPage, pagedBlock, geo, fontMap, pdfDoc)
      return

    case 'list':
      // List items are flattened MeasuredBlocks with listItemData
      if (measuredBlock.listItemData) {
        renderListItem(pdfPage, pagedBlock, geo, fontMap)
      }
      return

    case 'table':
      renderTable(pdfPage, pagedBlock, geo, fontMap)
      return

    case 'svg':
    case 'image':
      if (measuredBlock.floatData) {
        renderFloatBlock(pdfPage, pagedBlock, geo, fontMap, imageMap, pdfDoc)
      } else {
        renderImage(pdfPage, pagedBlock, geo, imageMap)
      }
      return

    case 'hr':
      renderHR(pdfPage, pagedBlock, geo)
      return

    case 'page-break':
      return // No visual output — page break is handled by paginator

    case 'code':
      renderCodeBlock(pdfPage, pagedBlock, geo, fontMap)
      return

    case 'rich-paragraph':
      renderRichParagraph(pdfPage, pagedBlock, geo, fontMap, pdfDoc, footnoteNumbering)
      return

    case 'blockquote':
      renderBlockquote(pdfPage, pagedBlock, geo, fontMap)
      return

    case 'callout':
      renderCallout(pdfPage, pagedBlock, geo, fontMap)
      return

    case 'toc-entry':
      renderTocEntry(pdfPage, pagedBlock, geo, fontMap)
      return

    case 'comment': {
      const commentEl = element as import('./types.js').CommentElement
      const absY = pagedBlock.yFromTop + geo.margins.top + geo.headerHeight
      const pdfY = geo.pageHeight - absY
      addStickyNoteAnnotation(pdfDoc, pdfPage, geo.margins.left, pdfY, commentEl.contents, commentEl.author, commentEl.color, commentEl.open)
      return
    }

    case 'form-field': {
      renderFormField(pagedBlock, pdfPage, pdfDoc, fontMap, geo, pagedBlock.yFromTop)
      return
    }

    case 'footnote-def':
      return // footnote defs are rendered via renderFootnoteZone, not inline
  }
}

// ─── Text block rendering (paragraph + heading) ───────────────────────────────

function renderTextBlock(
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

  // Multi-column layout
  const columnData = measuredBlock.columnData
  if (columnData) {
    const { columnCount, columnGap, columnWidth, linesPerColumn } = columnData
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      if (line.text === '') continue

      const colIdx = Math.floor(i / linesPerColumn)
      const lineInCol = i % linesPerColumn
      const lineYFromTop = yFromTop + (lineInCol * measuredBlock.lineHeight)
      const absoluteYFromTop = lineYFromTop + geo.margins.top + geo.headerHeight
      const pdfY = toPdfY(absoluteYFromTop, fontHeight, geo.pageHeight)

      const colX = geo.margins.left + colIdx * (columnWidth + columnGap)
      const trimmedText = line.text.trimEnd()
      const alignWidth = pdfFont.widthOfTextAtSize(trimmedText, measuredBlock.fontSize)
      const x = resolveX(align, colX, columnWidth, alignWidth)

      pdfPage.drawText(trimmedText, {
        x,
        y: pdfY,
        size: measuredBlock.fontSize,
        font: pdfFont,
        color: rgb(r, g, b),
      })

      // Phase 8G: Wire paragraph.url and heading.url for clickable links (multi-column)
      if ((element.type === 'paragraph' || element.type === 'heading') && element.url) {
        const lineWidth = pdfFont.widthOfTextAtSize(trimmedText, measuredBlock.fontSize)
        addLinkAnnotation(pdfDoc, pdfPage, x, pdfY, lineWidth, measuredBlock.fontSize, element.url)
      }
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

    // Phase 8H: smallCaps — uppercase text at 80% font size
    const hasSmallCaps = (element.type === 'paragraph' || element.type === 'heading') && (element as any).smallCaps === true
    const effectiveFontSize = hasSmallCaps ? measuredBlock.fontSize * 0.8 : measuredBlock.fontSize
    if (hasSmallCaps) trimmedText = trimmedText.toUpperCase()

    // Phase 8H: letterSpacing — draw char by char
    const letterSpacing = ((element.type === 'paragraph' || element.type === 'heading') && (element as any).letterSpacing > 0)
      ? (element as any).letterSpacing as number
      : 0

    let drawX: number
    if (alignRaw === 'justify' && letterSpacing === 0) {
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

    // Phase 8G: Wire paragraph.url and heading.url for clickable links
    if ((element.type === 'paragraph' || element.type === 'heading') && element.url) {
      const lineWidth = pdfFont.widthOfTextAtSize(trimmedText, effectiveFontSize) + (letterSpacing > 0 ? letterSpacing * (trimmedText.length - 1) : 0)
      addLinkAnnotation(pdfDoc, pdfPage, drawX, pdfY, lineWidth, effectiveFontSize, element.url)
    }
  }

  // Phase 8A: annotation on paragraph/heading — attach sticky note at top of block
  if ((element.type === 'paragraph' || element.type === 'heading') && (element as any).annotation) {
    const ann = (element as any).annotation
    const absY = yFromTop + geo.margins.top + geo.headerHeight
    const annotPdfY = geo.pageHeight - absY
    addStickyNoteAnnotation(pdfDoc, pdfPage, geo.margins.left, annotPdfY, ann.contents, ann.author, ann.color, ann.open)
  }
}

// ─── List item rendering ──────────────────────────────────────────────────────

function renderListItem(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  pagedBlock: PagedBlock,
  geo: PageGeometry,
  fontMap: FontMap
): void {
  const { measuredBlock, startLine, endLine, yFromTop } = pagedBlock
  const listItemData = measuredBlock.listItemData!

  const lines = measuredBlock.lines.slice(startLine, endLine)
  if (lines.length === 0) return

  const pdfFont = fontMap.get(measuredBlock.fontKey)
  if (!pdfFont) {
    throw new PretextPdfError('FONT_NOT_LOADED', `Font "${measuredBlock.fontKey}" not found in fontMap. This is a bug — font validation should have caught this.`)
  }

  const fontHeight = pdfFont.heightAtSize(measuredBlock.fontSize)
  const [cr, cg, cb] = hexToRgb(listItemData.color)

  // RTL support: mirror list layout if detected
  const isRTL = measuredBlock.isRTL ?? false
  let textStartX: number
  let textAreaWidth: number

  if (isRTL) {
    // RTL: marker on the right, text area on the left
    textAreaWidth = geo.contentWidth - listItemData.indent - listItemData.markerWidth
    textStartX = geo.margins.left + listItemData.indent
  } else {
    // LTR: marker on the left, text area on the right
    textStartX = geo.margins.left + listItemData.indent + listItemData.markerWidth
    textAreaWidth = geo.contentWidth - listItemData.indent - listItemData.markerWidth
  }

  // Draw marker on the first line of this item (only if startLine === 0)
  // If startLine > 0, the item continued from a previous page — no marker
  if (startLine === 0) {
    const markerText = listItemData.marker
    const markerMeasuredWidth = pdfFont.widthOfTextAtSize(markerText, measuredBlock.fontSize)
    let markerX: number

    if (isRTL) {
      // RTL: marker on the right, right-aligned within marker column
      markerX = geo.margins.left + geo.contentWidth - listItemData.indent - markerMeasuredWidth
    } else {
      // LTR: marker on the left, right-aligned within marker column
      markerX = geo.margins.left + listItemData.indent + listItemData.markerWidth - markerMeasuredWidth
    }

    const firstLineAbsY = yFromTop + geo.margins.top + geo.headerHeight
    const markerPdfY = toPdfY(firstLineAbsY, fontHeight, geo.pageHeight)

    pdfPage.drawText(markerText, {
      x: markerX,
      y: markerPdfY,
      size: measuredBlock.fontSize,
      font: pdfFont,
      color: rgb(cr, cg, cb),
    })
  }

  // Draw all text lines, indented to align with body text column
  // RTL lists are right-aligned, LTR lists are left-aligned
  const textAlign = isRTL ? 'right' : 'left'
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.text === '') continue

    const lineYFromTop = yFromTop + (i * measuredBlock.lineHeight)
    const absoluteYFromTop = lineYFromTop + geo.margins.top + geo.headerHeight
    const pdfY = toPdfY(absoluteYFromTop, fontHeight, geo.pageHeight)

    const trimmedText = line.text.trimEnd()
    const lineWidth = pdfFont.widthOfTextAtSize(trimmedText, measuredBlock.fontSize)
    const x = resolveX(textAlign, textStartX, textAreaWidth, lineWidth)

    pdfPage.drawText(trimmedText, {
      x,
      y: pdfY,
      size: measuredBlock.fontSize,
      font: pdfFont,
      color: rgb(cr, cg, cb),
    })
  }
}

// ─── Table rendering ──────────────────────────────────────────────────────────

function renderTable(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  pagedBlock: PagedBlock,
  geo: PageGeometry,
  fontMap: FontMap
): void {
  const { measuredBlock, yFromTop } = pagedBlock
  const tableData = measuredBlock.tableData!
  const startRow = pagedBlock.startRow ?? 0
  const endRow = pagedBlock.endRow ?? tableData.rows.length - tableData.headerRowCount

  const { columnWidths, cellPaddingH, cellPaddingV, borderWidth, borderColor, headerBgColor } = tableData

  // Collect the rows to render for this chunk: headers (always) + body slice
  const headerRows = tableData.rows.slice(0, tableData.headerRowCount)
  const bodyRows = tableData.rows.slice(tableData.headerRowCount)
  const chunkBodyRows = bodyRows.slice(startRow, endRow)
  const chunkRows = [...headerRows, ...chunkBodyRows]

  const chunkStartAbsY = yFromTop + geo.margins.top + geo.headerHeight
  const totalTableWidth = columnWidths.reduce((s, w) => s + w, 0)
  const totalChunkHeight = chunkRows.reduce((s, r) => s + r.height, 0)

  // ── Pass 1: Cell backgrounds ──────────────────────────────────────────────
  let rowAbsY = chunkStartAbsY
  for (const row of chunkRows) {
    const rowPdfY = toPdfY(rowAbsY, row.height, geo.pageHeight)
    let cellX = geo.margins.left
    for (const cell of row.cells) {
      const bgColorHex = cell.bgColor ?? (row.isHeader ? headerBgColor : undefined)
      if (bgColorHex) {
        const [r, g, b] = hexToRgb(bgColorHex)
        // Use mergedWidth for colspan support
        pdfPage.drawRectangle({ x: cellX, y: rowPdfY, width: cell.mergedWidth, height: row.height, color: rgb(r, g, b), borderWidth: 0 })
      }
      cellX += cell.mergedWidth
    }
    rowAbsY += row.height
  }

  // ── Pass 2: Grid (border-collapse model) ─────────────────────────────────
  // Draw outer border + internal lines — single-thickness at every edge.
  if (borderWidth > 0) {
    const [br, bg, bb] = hexToRgb(borderColor)
    const borderRgb = rgb(br, bg, bb)
    const tableTopPdfY = toPdfY(chunkStartAbsY, totalChunkHeight, geo.pageHeight)

    // Outer border rectangle (no fill)
    pdfPage.drawRectangle({
      x: geo.margins.left,
      y: tableTopPdfY,
      width: totalTableWidth,
      height: totalChunkHeight,
      borderColor: borderRgb,
      borderWidth,
    })

    // Internal horizontal lines (row separators, between rows, not at edges)
    let lineAbsY = chunkStartAbsY
    for (let ri = 0; ri < chunkRows.length - 1; ri++) {
      lineAbsY += chunkRows[ri]!.height
      const linePdfY = geo.pageHeight - lineAbsY
      pdfPage.drawLine({
        start: { x: geo.margins.left, y: linePdfY },
        end:   { x: geo.margins.left + totalTableWidth, y: linePdfY },
        thickness: borderWidth,
        color: borderRgb,
      })
    }

    // Internal vertical lines (column separators, between columns, not at edges)
    // With colspan support: only draw lines at boundaries that are NOT spanned by merged cells
    // Each row may have different active boundaries due to different colspan patterns
    let colBoundaryX = geo.margins.left
    for (let ci = 0; ci < columnWidths.length; ci++) {
      colBoundaryX += columnWidths[ci]!
      // Check if this boundary (between column ci and ci+1) is active in ANY row
      const boundaryIndex = ci  // boundary at index ci is between columns ci and ci+1
      let isActive = false
      for (const row of chunkRows) {
        if (row.activeBoundaries.includes(boundaryIndex)) {
          isActive = true
          break
        }
      }
      if (isActive && ci < columnWidths.length - 1) {
        const chunkTopPdfY = geo.pageHeight - chunkStartAbsY
        const chunkBottomPdfY = geo.pageHeight - (chunkStartAbsY + totalChunkHeight)
        pdfPage.drawLine({
          start: { x: colBoundaryX, y: chunkTopPdfY },
          end:   { x: colBoundaryX, y: chunkBottomPdfY },
          thickness: borderWidth,
          color: borderRgb,
        })
      }
    }
  }

  // ── Pass 3: Cell text ─────────────────────────────────────────────────────
  rowAbsY = chunkStartAbsY
  for (const row of chunkRows) {
    let cellX = geo.margins.left
    for (const cell of row.cells) {
      if (cell.lines.length > 0) {
        const pdfFont = fontMap.get(cell.fontKey)
        if (!pdfFont) {
          throw new PretextPdfError('FONT_NOT_LOADED', `Table cell font "${cell.fontKey}" not found in fontMap. This is a bug — font validation should have caught this.`)
        }

        const fontHeight = pdfFont.heightAtSize(cell.fontSize)
        const [r, g, b] = hexToRgb(cell.color)
        const textAreaX = cellX + cellPaddingH
        // Use mergedWidth for colspan support
        const textAreaWidth = cell.mergedWidth - 2 * cellPaddingH

        for (let li = 0; li < cell.lines.length; li++) {
          const line = cell.lines[li]!
          if (line.text === '') continue

          const lineYFromPageTop = rowAbsY + cellPaddingV + li * cell.lineHeight
          const pdfY = toPdfY(lineYFromPageTop, fontHeight, geo.pageHeight)

          const trimmedText = line.text.trimEnd()
          const lineWidth = pdfFont.widthOfTextAtSize(trimmedText, cell.fontSize)
          const x = resolveX(cell.align, textAreaX, textAreaWidth, lineWidth)

          pdfPage.drawText(trimmedText, { x, y: pdfY, size: cell.fontSize, font: pdfFont, color: rgb(r, g, b) })
        }
      }

      cellX += cell.mergedWidth
    }
    rowAbsY += row.height
  }
}

// ─── Image rendering ──────────────────────────────────────────────────────────

function renderImage(
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

function renderFloatBlock(
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

  // Draw text lines
  const pdfFont = fontMap.get(fd.textFontKey)
  if (!pdfFont) throw new PretextPdfError('FONT_NOT_LOADED', `Float text font key "${fd.textFontKey}" not found in fontMap. This is a bug — font loading should have caught this.`)

  const fontHeight = pdfFont.heightAtSize(fd.textFontSize)
  const [r, g, b] = hexToRgb(fd.textColor)
  const textBaseX = geo.margins.left + fd.textColX

  for (let i = 0; i < fd.textLines.length; i++) {
    const line = fd.textLines[i]!
    if (!line.text || line.text === '') continue
    const lineAbsY = baseAbsY + (i * fd.textLineHeight)
    const pdfY = toPdfY(lineAbsY, fontHeight, geo.pageHeight)
    pdfPage.drawText(line.text.trimEnd(), {
      x: textBaseX,
      y: pdfY,
      size: fd.textFontSize,
      font: pdfFont,
      color: rgb(r, g, b),
    })
  }
}

// ─── Horizontal rule rendering ────────────────────────────────────────────────

function renderHR(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  pagedBlock: PagedBlock,
  geo: PageGeometry
): void {
  const { measuredBlock, yFromTop } = pagedBlock
  const element = measuredBlock.element as import('./types.js').HorizontalRuleElement

  const spaceAbove = element.spaceAbove ?? 12
  const thickness = element.thickness ?? 0.5
  const colorHex = element.color ?? '#cccccc'

  // Line sits at the middle of the HR element (after spaceAbove, before spaceBelow)
  const lineYFromTop = yFromTop + spaceAbove + geo.margins.top + geo.headerHeight
  const pdfY = toPdfY(lineYFromTop, thickness / 2, geo.pageHeight)

  const [r, g, b] = hexToRgb(colorHex)

  pdfPage.drawLine({
    start: { x: geo.margins.left, y: pdfY },
    end: { x: geo.margins.left + geo.contentWidth, y: pdfY },
    thickness,
    color: rgb(r, g, b),
  })
}

// ─── Code block rendering ─────────────────────────────────────────────────────

function renderCodeBlock(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  pagedBlock: PagedBlock,
  geo: PageGeometry,
  fontMap: FontMap
): void {
  const { measuredBlock, startLine, endLine, yFromTop } = pagedBlock
  const element = measuredBlock.element as import('./types.js').CodeBlockElement
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

// ─── Blockquote rendering ─────────────────────────────────────────────────────

function renderBlockquote(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  pagedBlock: PagedBlock,
  geo: PageGeometry,
  fontMap: FontMap
): void {
  const { measuredBlock, startLine, endLine, yFromTop } = pagedBlock
  const element = measuredBlock.element as import('./types.js').BlockquoteElement
  const paddingV = measuredBlock.blockquotePaddingV ?? 10
  const paddingH = measuredBlock.blockquotePaddingH ?? 16
  const borderWidth = measuredBlock.blockquoteBorderWidth ?? 3
  const bgColorHex = element.bgColor ?? '#f8f9fa'
  const borderColorHex = element.borderColor ?? '#0070f3'
  const textColorHex = element.color ?? '#333333'
  const alignRaw = element.align ?? (measuredBlock.isRTL ? 'right' : 'left')
  const align = alignRaw === 'justify' ? 'left' : alignRaw as 'left' | 'center' | 'right'

  const lines = measuredBlock.lines.slice(startLine, endLine)
  const lineHeight = measuredBlock.lineHeight
  const fontSize = measuredBlock.fontSize

  // Compute per-chunk padding (only at the edge of the block, like code)
  const isFirstChunk = startLine === 0
  const isLastChunk = endLine === measuredBlock.lines.length
  const paddingTop = isFirstChunk ? paddingV : 0
  const paddingBottom = isLastChunk ? paddingV : 0
  const visibleHeight = lines.length * lineHeight + paddingTop + paddingBottom

  const boxAbsY = yFromTop + geo.margins.top + geo.headerHeight
  const boxPdfY = toPdfY(boxAbsY, visibleHeight, geo.pageHeight)

  // ── Background box ──────────────────────────────────────────────────────────
  const [bgR, bgG, bgB] = hexToRgb(bgColorHex)
  pdfPage.drawRectangle({
    x: geo.margins.left,
    y: boxPdfY,
    width: geo.contentWidth,
    height: visibleHeight,
    color: rgb(bgR, bgG, bgB),
    borderWidth: 0,
  })

  // ── Left border stripe ──────────────────────────────────────────────────────
  const [bdR, bdG, bdB] = hexToRgb(borderColorHex)
  pdfPage.drawRectangle({
    x: geo.margins.left,
    y: boxPdfY,
    width: borderWidth,
    height: visibleHeight,
    color: rgb(bdR, bdG, bdB),
    borderWidth: 0,
  })

  // ── Text lines ──────────────────────────────────────────────────────────────
  const pdfFont = fontMap.get(measuredBlock.fontKey)
  if (!pdfFont || lines.length === 0) return

  const fontHeight = pdfFont.heightAtSize(fontSize)
  const [r, g, b] = hexToRgb(textColorHex)
  const textStartX = geo.margins.left + borderWidth + paddingH
  const textAreaWidth = geo.contentWidth - borderWidth - 2 * paddingH

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.text === '') continue

    const lineYFromPageTop = boxAbsY + paddingTop + i * lineHeight
    const pdfY = toPdfY(lineYFromPageTop, fontHeight, geo.pageHeight)

    const trimmedText = line.text.trimEnd()
    const isLastLine = i === lines.length - 1

    let drawX: number
    if (alignRaw === 'justify') {
      drawJustifiedLine(pdfPage, trimmedText, isLastLine, textStartX, pdfY, textAreaWidth, fontSize, pdfFont, rgb(r, g, b))
      drawX = textStartX
    } else {
      const lineWidth = pdfFont.widthOfTextAtSize(trimmedText, fontSize)
      drawX = resolveX(align, textStartX, textAreaWidth, lineWidth)
      pdfPage.drawText(trimmedText, {
        x: drawX,
        y: pdfY,
        size: fontSize,
        font: pdfFont,
        color: rgb(r, g, b),
      })
    }
    if (element.underline || element.strikethrough) {
      const lineWidth = pdfFont.widthOfTextAtSize(trimmedText, fontSize)
      drawTextDecoration(pdfPage, drawX, lineWidth, pdfY, fontSize, pdfFont, [r, g, b], { underline: element.underline ?? false, strikethrough: element.strikethrough ?? false })
    }
  }
}

// ─── Callout rendering (Phase 8D) ────────────────────────────────────────────

function renderCallout(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  pagedBlock: PagedBlock,
  geo: PageGeometry,
  fontMap: FontMap
): void {
  const { measuredBlock, startLine, endLine, yFromTop } = pagedBlock
  const el = measuredBlock.element as import('./types.js').CalloutElement
  const cd = measuredBlock.calloutData
  if (!cd) return

  const { paddingH, paddingV, borderColor, backgroundColor, titleColor, color, titleText } = cd
  const isFirstChunk = startLine === 0
  const isLastChunk = endLine === measuredBlock.lines.length

  const lines = measuredBlock.lines.slice(startLine, endLine)
  const fs = measuredBlock.fontSize
  const lh = measuredBlock.lineHeight
  const font = fontMap.get(measuredBlock.fontKey) ?? [...fontMap.values()][0]
  if (!font) return

  const titleH = isFirstChunk && titleText ? cd.titleHeight : 0
  const topPad = isFirstChunk ? paddingV : 0
  const bottomPad = isLastChunk ? paddingV : 0
  const chunkHeight = topPad + titleH + lines.length * lh + bottomPad

  const boxAbsY = yFromTop + geo.margins.top + geo.headerHeight
  const boxPdfY = geo.pageHeight - boxAbsY - chunkHeight

  // Background
  const [bgR, bgG, bgB] = hexToRgb(backgroundColor)
  pdfPage.drawRectangle({
    x: geo.margins.left,
    y: boxPdfY,
    width: geo.contentWidth,
    height: chunkHeight,
    color: rgb(bgR, bgG, bgB),
    borderWidth: 0,
  })

  // Left border stripe (3pt wide)
  const [bdR, bdG, bdB] = hexToRgb(borderColor)
  pdfPage.drawRectangle({
    x: geo.margins.left,
    y: boxPdfY,
    width: 3,
    height: chunkHeight,
    color: rgb(bdR, bdG, bdB),
    borderWidth: 0,
  })

  const fontHeight = font.heightAtSize(fs)
  let currentAbsY = boxAbsY + topPad

  // Draw title if first chunk
  if (isFirstChunk && titleText) {
    // Try to get bold font variant by modifying the fontKey
    const boldFontKey = measuredBlock.fontKey.replace(/-400-/, '-700-')
    const titleFont = fontMap.get(boldFontKey) ?? font
    const [tR, tG, tB] = hexToRgb(titleColor)
    const titlePdfY = geo.pageHeight - currentAbsY - fontHeight - (fs * 1.4 - fs) / 2
    pdfPage.drawText(titleText, {
      x: geo.margins.left + paddingH,
      y: titlePdfY,
      size: fs,
      font: titleFont,
      color: rgb(tR, tG, tB),
    })
    currentAbsY += titleH
  }

  // Draw content lines
  const [tR, tG, tB] = hexToRgb(color)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.text === '') {
      currentAbsY += lh
      continue
    }
    const linePdfY = geo.pageHeight - currentAbsY - fontHeight - (lh - fs) / 2
    pdfPage.drawText(line.text.trimEnd(), {
      x: geo.margins.left + paddingH,
      y: linePdfY,
      size: fs,
      font,
      color: rgb(tR, tG, tB),
    })
    currentAbsY += lh
  }
}

// ─── Rich paragraph rendering ─────────────────────────────────────────────────

function renderRichParagraph(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  pagedBlock: PagedBlock,
  geo: PageGeometry,
  fontMap: FontMap,
  pdfDoc: PDFDocument,
  footnoteNumbering?: Map<string, number>
): void {
  const { measuredBlock, startLine, endLine, yFromTop } = pagedBlock
  const { element, richLines, lineHeight, fontSize } = measuredBlock

  if (!richLines || richLines.length === 0) return

  // Only render the lines on this page chunk
  const visibleLines = richLines.slice(startLine, endLine)

  // Draw background color if set
  const columnData = measuredBlock.columnData
  if (element.type === 'rich-paragraph' && element.bgColor) {
    // Phase 5B.4: Use sum of per-line heights (may vary with per-span fontSize)
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
    // Phase 5B.4: Track cumulative Y per column (per-line heights may vary)
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
        pdfPage.drawText(drawText, {
          x: drawX,
          y: fragmentPdfY,
          size: fragment.fontSize,
          font: pdfFont,
          color: rgb(r, g, b),
        })
        const fragWidth = pdfFont.widthOfTextAtSize(drawText, fragment.fontSize)
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
  // Phase 5B.4: Track cumulative Y (per-line heights may vary due to per-span fontSize)
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
      pdfPage.drawText(drawText, {
        x: drawX,
        y: fragmentPdfY,
        size: fragment.fontSize,
        font: pdfFont,
        color: rgb(r, g, b),
      })
      const fragWidth = pdfFont.widthOfTextAtSize(drawText, fragment.fontSize)
      drawTextDecoration(pdfPage, drawX, fragWidth, fragmentPdfY, fragment.fontSize, pdfFont, [r, g, b], { underline: fragment.underline ?? false, strikethrough: fragment.strikethrough ?? false })
      if (fragment.url) {
        addLinkAnnotation(pdfDoc, pdfPage, drawX, fragmentPdfY, fragWidth, fragment.fontSize, fragment.url)
      }
    }

    cumY += richLine.lineHeight
  }
}

// ─── Footnote zone rendering ──────────────────────────────────────────────────

function renderFootnoteZone(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  footnoteItems: Array<{ def: FootnoteDefElement; number: number }>,
  zoneHeight: number,
  fontMap: FontMap,
  doc: PdfDocument,
  geo: PageGeometry
): void {
  const { pageHeight, margins, footerHeight, contentWidth } = geo
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
    const lineHeight = fontSize * 1.5
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

// ─── Header / Footer rendering ────────────────────────────────────────────────

function renderHeaderFooter(
  pdfPage: ReturnType<PDFDocument['addPage']>,
  spec: HeaderFooterSpec,
  pageNumber: number,
  totalPages: number,
  geo: PageGeometry,
  fontMap: FontMap,
  position: 'header' | 'footer'
): void {
  const text = resolveTokens(spec.text, pageNumber, totalPages)
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

// ─── Watermark rendering ──────────────────────────────────────────────────

function renderWatermark(
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

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Draw a single line of text with justified alignment.
 * Spaces between words are stretched so the line fills availableWidth.
 * The last line of a paragraph is left-aligned (standard typographic convention).
 */
function drawJustifiedLine(
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
  const gapSize = (availableWidth - totalWordWidth) / (words.length - 1)

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
function addLinkAnnotation(
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
function addGoToAnnotation(
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
function addStickyNoteAnnotation(
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
function drawTextDecoration(
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

/**
 * THE ONLY place where top-down coords are converted to pdf-lib bottom-up coords.
 * @param yFromTop - distance from top of page in pt
 * @param elementHeight - height of the element (font baseline offset, image height, etc.)
 * @param pageHeight - total page height in pt
 */
function toPdfY(yFromTop: number, elementHeight: number, pageHeight: number): number {
  return pageHeight - yFromTop - elementHeight
}

/** Resolve text horizontal position based on alignment */
function resolveX(
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
function resolveTokens(text: string, pageNumber: number, totalPages: number): string {
  return text
    .replace('{{pageNumber}}', String(pageNumber))
    .replace('{{totalPages}}', String(totalPages))
}

/** Parse a 6-digit hex color string to normalized RGB [0,1] triple */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  return [r, g, b]
}

// ─── Outline / Bookmarks ──────────────────────────────────────────────────────

/**
 * Build PDF outline (bookmarks/TOC) from heading entries.
 * Creates a doubly-linked tree in the PDF catalog.
 * Must be called after all pages are rendered but before pdfDoc.save().
 */
function buildOutlineTree(
  pdfDoc: PDFDocument,
  headings: PaginatedDocument['headings'],
  bookmarkConfig: PdfDocument['bookmarks']
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

  // Returns index of nearest ancestor heading, or -1 (root-level)
  function parentIdxOf(i: number): number {
    for (let j = i - 1; j >= 0; j--) {
      if (filtered[j]!.level < filtered[i]!.level) return j
    }
    return -1
  }

  for (let i = 0; i < filtered.length; i++) {
    const h = filtered[i]!
    const pageRef = pageRefs[h.pageIndex] ?? pageRefs[pageRefs.length - 1]!
    const myParentIdx = parentIdxOf(i)
    const myParentRef = myParentIdx === -1 ? outlineRef : itemRefs[myParentIdx]!

    const dest = pdfDoc.context.obj([pageRef, PDFName.of('XYZ'), PDFNull, PDFNull, PDFNull])

    let prevRef: PDFRef | undefined
    for (let j = i - 1; j >= 0; j--) {
      if (filtered[j]!.level === h.level && parentIdxOf(j) === myParentIdx) {
        prevRef = itemRefs[j]; break
      }
    }

    let nextRef: PDFRef | undefined
    for (let j = i + 1; j < filtered.length; j++) {
      if (filtered[j]!.level === h.level && parentIdxOf(j) === myParentIdx) {
        nextRef = itemRefs[j]; break
      }
    }

    let firstChildRef: PDFRef | undefined
    let lastChildRef: PDFRef | undefined
    let childCount = 0
    for (let j = i + 1; j < filtered.length; j++) {
      if (filtered[j]!.level <= h.level) break
      if (parentIdxOf(j) === i) {
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

    pdfDoc.context.assign(itemRefs[i]!, pdfDoc.context.obj(entry as any))
  }

  const topIdxs = filtered.map((_, i) => i).filter(i => parentIdxOf(i) === -1)
  const rootEntry: Record<string, unknown> = {
    Type: PDFName.of('Outlines'),
    Count: filtered.length,
  }
  if (topIdxs.length > 0) {
    rootEntry['First'] = itemRefs[topIdxs[0]!]!
    rootEntry['Last'] = itemRefs[topIdxs[topIdxs.length - 1]!]!
  }
  pdfDoc.context.assign(outlineRef, pdfDoc.context.obj(rootEntry as any))

  pdfDoc.catalog.set(PDFName.of('Outlines'), outlineRef)
  pdfDoc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'))
}

// ─── TOC Entry Rendering (Phase 7D) ────────────────────────────────────────────

function renderTocEntry(
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

// ─── Phase 8B: Form Fields ────────────────────────────────────────────────────

/** Phase 8B: Render an interactive AcroForm field. */
function renderFormField(
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

  // Draw label if set
  if (el.label && labelHeight > 0) {
    const font = fontMap.get(block.measuredBlock.fontKey)
    if (font) {
      const labelPdfY = geo.pageHeight - absYTop
      pdfPage.drawText(el.label, {
        x,
        y: labelPdfY,
        size: el.fontSize ?? 12,
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

  try {
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
        const optHeight = Math.max(16, Math.floor(fieldHeight / Math.max(1, opts.length)))
        for (let i = 0; i < opts.length; i++) {
          group.addOptionToPage(opts[i]!.value, pdfPage, {
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
  } catch {
    // Non-fatal: if pdf-lib throws for an edge case, skip the field rather than crashing
  }
}

// ─── Phase 8E: Signature Placeholder ──────────────────────────────────────────

/** Phase 8E: Draw a visual signature placeholder box on the specified page. */
function renderSignaturePlaceholder(
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
