import { PDFDocument, PDFName, PDFString, PDFNull, PDFRef, rgb, degrees } from 'pdf-lib'
import type {
  PdfDocument, PaginatedDocument, PagedBlock, MeasuredBlock,
  FontMap, ImageMap, PageGeometry, HeaderFooterSpec
} from '../dist/types.js'

// Create minimal test to check if catalog.set() works at all
const pdfDoc = await PDFDocument.create()
pdfDoc.addPage([595, 842])

// Try to set an Outlines entry like we do in buildOutlineTree
const outlineRef = pdfDoc.context.nextRef()
const rootEntry = {
  Type: PDFName.of('Outlines'),
  Count: 0,
}
pdfDoc.context.assign(outlineRef, pdfDoc.context.obj(rootEntry as any))
pdfDoc.catalog.set(PDFName.of('Outlines'), outlineRef)
pdfDoc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'))

// Save WITHOUT compression to see if /Outlines appears
const pdf = await pdfDoc.save({ useObjectStreams: false })
const pdfString = Buffer.from(pdf).toString('latin1')

if (pdfString.includes('/Outlines')) {
  console.log('✓ /Outlines found when compression disabled!')
} else {
  console.log('✗ /Outlines NOT found even without compression')
  
  // Debug: find where catalog is
  const rootMatch = pdfString.match(/\/Root\s+(\d+) (\d+) R/)
  if (rootMatch) {
    const catalogNum = rootMatch[1]
    console.log('Catalog number:', catalogNum)
    
    // Find catalog object
    const catalogObjPattern = new RegExp(`^${catalogNum} 0 obj$`, 'm')
    const idx = pdfString.search(catalogObjPattern)
    if (idx >= 0) {
      const catalogSection = pdfString.substring(idx, idx + 500)
      console.log('Catalog content:', catalogSection)
    }
  }
}
