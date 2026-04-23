import { PDFDocument, PDFName, PDFString, PDFNull } from '@cantoo/pdf-lib'
import type {
  PdfDocument
} from './types.js'
import type {
  PaginatedDocument, PagedBlock,
  FontMap, ImageMap, PageGeometry
} from './types-internal.js'
import { PretextPdfError } from './errors.js'
import {
  renderTextBlock,
  renderListItem,
  renderTable,
  renderImage,
  renderFloatBlock,
  renderFloatGroup,
  renderHR,
  renderCodeBlock,
  renderRichParagraph,
  renderBlockquote,
  renderCallout,
  renderWatermark,
  renderFootnoteZone,
  renderHeaderFooter,
} from './render-blocks.js'
import {
  buildOutlineTree,
  renderTocEntry,
  renderFormField,
  renderSignaturePlaceholder,
} from './render-extras.js'
import { addStickyNoteAnnotation } from './render-utils.js'

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

  // Pre-compute token values that don't change per page
  const rawDate = doc.renderDate ? (doc.renderDate instanceof Date ? doc.renderDate : new Date(doc.renderDate)) : new Date()
  const dateStr = `${rawDate.getFullYear()}-${String(rawDate.getMonth() + 1).padStart(2, '0')}-${String(rawDate.getDate()).padStart(2, '0')}`
  const tokenExtra: { date?: string; author?: string } = { date: dateStr }
  if (doc.metadata?.author) tokenExtra.author = doc.metadata.author

  for (const renderedPage of paginatedDoc.pages) {
    const pdfPage = pdfDoc.addPage([pageWidth, pageHeight])
    const pageNumber = renderedPage.pageIndex + 1
    const totalPages = paginatedDoc.totalPages

    // Render watermark (behind content)
    renderWatermark(pdfPage, doc, fontMap, imageMap, geo)

    // Render content blocks
    for (const pagedBlock of renderedPage.blocks) {
      const blockEl = pagedBlock.measuredBlock.element
      if (blockEl.type === 'form-field') {
        try {
          renderBlock(pdfPage, pagedBlock, geo, fontMap, imageMap, pdfDoc, paginatedDoc.footnoteNumbering)
        } catch (e) {
          const ffEl = blockEl as import('./types.js').FormFieldElement
          const action = doc.onFormFieldError ? doc.onFormFieldError(ffEl.name, e as Error) : 'skip'
          if (action === 'throw') throw e
          console.warn(`[pretext-pdf] Form field "${ffEl.name}" failed to render: ${(e as Error).message}`)
        }
      } else {
        renderBlock(pdfPage, pagedBlock, geo, fontMap, imageMap, pdfDoc, paginatedDoc.footnoteNumbering)
      }
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
      renderHeaderFooter(pdfPage, doc.header, pageNumber, totalPages, geo, fontMap, 'header', tokenExtra)
    }

    // Render footer
    if (doc.footer) {
      renderHeaderFooter(pdfPage, doc.footer, pageNumber, totalPages, geo, fontMap, 'footer', tokenExtra)
    }
  }

  if (doc.bookmarks !== false) {
    buildOutlineTree(pdfDoc, paginatedDoc.headings, doc.bookmarks)
  }

  // Render signature placeholder if configured (skip if invisible)
  if (doc.signature && !doc.signature.invisible) {
    renderSignaturePlaceholder(doc.signature, pdfDoc, fontMap, geo)
  }

  // Finalize form field appearances
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
    case 'qr-code':
    case 'barcode':
    case 'chart':
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
      // Sticky-note annotations are point annotations (no height), so we don't subtract
      // element height — toPdfY(absY, 0, pageHeight) = pageHeight - absY is correct.
      const pdfY = geo.pageHeight - absY
      addStickyNoteAnnotation(pdfDoc, pdfPage, geo.margins.left, pdfY, commentEl.contents, commentEl.author, commentEl.color, commentEl.open)
      return
    }

    case 'form-field': {
      renderFormField(pagedBlock, pdfPage, pdfDoc, fontMap, geo, pagedBlock.yFromTop)
      return
    }

    case 'float-group':
      renderFloatGroup(pdfPage, pagedBlock, geo, fontMap, imageMap, pdfDoc)
      return

    case 'footnote-def':
      return // footnote defs are rendered via renderFootnoteZone, not inline
  }
}
