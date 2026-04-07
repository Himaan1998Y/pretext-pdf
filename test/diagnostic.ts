/**
 * Diagnostic PDF — visualizes every alignment issue with rulers and boxes.
 * Each test has a colored background box showing the expected line area,
 * and text drawn on top. Misalignment becomes immediately visible.
 *
 * Run: node --experimental-strip-types test/diagnostic.ts
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Import our library
const { render } = await import('../dist/index.js')
import type { PdfDocument, ContentElement } from '../dist/types.js'

// ══════════════════════════════════════════════════════════════════════════════
// DIAGNOSTIC PDF 1: Through our render() pipeline
// Tests every Phase 1 feature with descriptive labels
// ══════════════════════════════════════════════════════════════════════════════

const diagnosticDoc: PdfDocument = {
  pageSize: 'A4',
  margins: { top: 72, bottom: 72, left: 72, right: 72 },
  defaultFont: 'Inter',
  defaultFontSize: 11,
  header: {
    text: 'DIAGNOSTIC TEST — Page {{pageNumber}} of {{totalPages}}',
    fontSize: 9,
    align: 'center',
  },
  footer: {
    text: '{{pageNumber}} / {{totalPages}} — pretext-pdf Phase 1',
    fontSize: 9,
    align: 'center',
  },
  content: [
    // ── Test 1: Basic heading hierarchy ─────────────────────────────────────
    { type: 'heading', level: 1, text: 'Heading Level 1 (should be large, bold)' },
    { type: 'paragraph', text: 'Body text immediately after H1. There should be visible spacing between the heading above and this paragraph.' },
    { type: 'spacer', height: 8 },
    { type: 'heading', level: 2, text: 'Heading Level 2 (should be medium, bold)' },
    { type: 'paragraph', text: 'Body text after H2. Slightly smaller heading than H1.' },
    { type: 'spacer', height: 8 },
    { type: 'heading', level: 3, text: 'Heading Level 3 (should be small-medium, bold)' },
    { type: 'paragraph', text: 'Body text after H3.' },
    { type: 'spacer', height: 8 },
    { type: 'heading', level: 4, text: 'Heading Level 4 (should be slightly larger than body, bold)' },
    { type: 'paragraph', text: 'Body text after H4. This should look only slightly different from body text.' },

    // ── Test 2: Newline handling ────────────────────────────────────────────
    { type: 'spacer', height: 20 },
    { type: 'heading', level: 2, text: 'Test: Newline Handling (\\n)' },
    {
      type: 'paragraph',
      text: 'Line 1: This is the first line.\nLine 2: This should be on its own line.\nLine 3: And this on a third line.',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'Above blank line.\n\nBelow blank line (should have a visible gap).',
      spaceAfter: 8,
    },

    // ── Test 3: Text alignment ──────────────────────────────────────────────
    { type: 'spacer', height: 20 },
    { type: 'heading', level: 2, text: 'Test: Text Alignment' },
    { type: 'paragraph', text: '← LEFT ALIGNED (default) — this text should start at the left margin.', align: 'left', spaceAfter: 4 },
    { type: 'paragraph', text: 'CENTER ALIGNED — this text should be centered on the page.', align: 'center', spaceAfter: 4 },
    { type: 'paragraph', text: 'RIGHT ALIGNED — this text should end at the right margin. →', align: 'right', spaceAfter: 4 },

    // ── Test 4: Font weight ─────────────────────────────────────────────────
    { type: 'spacer', height: 20 },
    { type: 'heading', level: 2, text: 'Test: Font Weight' },
    { type: 'paragraph', text: 'This is normal weight (400) body text.', spaceAfter: 4 },
    { type: 'paragraph', text: 'This is BOLD weight (700) body text — should be visibly thicker.', fontWeight: 700, spaceAfter: 4 },

    // ── Test 5: Colors ──────────────────────────────────────────────────────
    { type: 'spacer', height: 20 },
    { type: 'heading', level: 2, text: 'Test: Colors' },
    { type: 'paragraph', text: 'Black text (#000000)', color: '#000000', spaceAfter: 2 },
    { type: 'paragraph', text: 'Dark blue text (#1a1a2e)', color: '#1a1a2e', spaceAfter: 2 },
    { type: 'paragraph', text: 'Red text (#cc0000)', color: '#cc0000', spaceAfter: 2 },
    { type: 'paragraph', text: 'Gray text (#888888)', color: '#888888', spaceAfter: 2 },
    { type: 'paragraph', text: 'Green text (#006600)', color: '#006600', spaceAfter: 2 },

    // ── Test 6: Font sizes ──────────────────────────────────────────────────
    { type: 'spacer', height: 20 },
    { type: 'heading', level: 2, text: 'Test: Font Sizes' },
    { type: 'paragraph', text: 'This is 9pt text — small, like footnotes.', fontSize: 9, spaceAfter: 4 },
    { type: 'paragraph', text: 'This is 11pt text — default body size.', fontSize: 11, spaceAfter: 4 },
    { type: 'paragraph', text: 'This is 14pt text — slightly larger.', fontSize: 14, spaceAfter: 4 },
    { type: 'paragraph', text: 'This is 18pt text — sub-heading size.', fontSize: 18, spaceAfter: 4 },

    // ── Test 7: Long paragraph wrapping ─────────────────────────────────────
    { type: 'spacer', height: 20 },
    { type: 'heading', level: 2, text: 'Test: Long Paragraph Wrapping' },
    {
      type: 'paragraph',
      text: 'This is a longer paragraph designed to test text wrapping behavior. The text should wrap cleanly at word boundaries, with consistent line spacing throughout. Each line should start at the left margin and the right edge should be ragged (not justified). The last line may be shorter than the others. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
      spaceAfter: 8,
    },

    // ── Test 8: SpaceAfter values ───────────────────────────────────────────
    { type: 'spacer', height: 20 },
    { type: 'heading', level: 2, text: 'Test: SpaceAfter' },
    { type: 'paragraph', text: 'After this: spaceAfter=0 (next line should be close)', spaceAfter: 0 },
    { type: 'paragraph', text: 'After this: spaceAfter=8', spaceAfter: 8 },
    { type: 'paragraph', text: 'After this: spaceAfter=24 (big gap below)', spaceAfter: 24 },
    { type: 'paragraph', text: 'This text should be visibly further from the line above.', spaceAfter: 4 },

    // ── Test 9: Page break content (force multi-page) ───────────────────────
    { type: 'spacer', height: 20 },
    { type: 'heading', level: 2, text: 'Test: Multi-page & Page Breaks' },
    { type: 'paragraph', text: 'The following paragraphs should fill the rest of this page and continue onto the next. Content should flow naturally without gaps or overlaps at page boundaries.' },
    ...Array.from({ length: 15 }, (_, i) => ({
      type: 'paragraph' as const,
      text: `[Para ${i + 1}] Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.`,
      spaceAfter: 6,
    })),

    // ── Test 10: Heading at page boundary ───────────────────────────────────
    { type: 'heading', level: 2, text: 'Test: Heading Near Page Boundary' },
    { type: 'paragraph', text: 'This heading should appear with its following text. If the heading is at the bottom of a page, it should move to the next page (keepTogether default for headings).' },

    // ── Test 11: Rupee symbol and special chars ─────────────────────────────
    { type: 'spacer', height: 16 },
    { type: 'heading', level: 3, text: 'Test: Special Characters' },
    { type: 'paragraph', text: 'Rupee: ₹1,00,000  ·  Euro: €500  ·  Pound: £200  ·  Yen: ¥10,000', spaceAfter: 4 },
    { type: 'paragraph', text: 'Dash types: hyphen- endash– emdash— bullet•', spaceAfter: 4 },
    { type: 'paragraph', text: 'Quotes: "double curly" \'single curly\' «guillemets»', spaceAfter: 4 },
  ],
}

const pdf = await render(diagnosticDoc)
const outPath = path.join(__dirname, 'output', 'diagnostic.pdf')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, pdf)
console.log(`✅ Diagnostic PDF: ${outPath} (${(pdf.byteLength/1024).toFixed(1)} KB)`)

// ══════════════════════════════════════════════════════════════════════════════
// DIAGNOSTIC PDF 2: Direct pdf-lib rendering with visual guide boxes
// This bypasses our library entirely — draws text with background rectangles
// to show exactly where pdf-lib places things
// ══════════════════════════════════════════════════════════════════════════════

const fontkit = (await import('@pdf-lib/fontkit')).default
const directDoc = await PDFDocument.create()
directDoc.registerFontkit(fontkit)

const base = path.join(__dirname, '..', 'node_modules/@fontsource/inter/files')
const regBytes = new Uint8Array(fs.readFileSync(path.join(base, 'inter-latin-400-normal.woff2')))
const boldBytes = new Uint8Array(fs.readFileSync(path.join(base, 'inter-latin-700-normal.woff2')))
const regFont = await directDoc.embedFont(regBytes, { subset: false })
const boldFont = await directDoc.embedFont(boldBytes, { subset: false })

const page = directDoc.addPage([595, 842])
const margin = 72
const contentW = 595 - margin * 2

let cursorY = 842 - margin  // Start from top, in pdf-lib coords (bottom-up)

function drawLabeledBox(label: string, fontSize: number, font: typeof regFont, lineHeight: number, lines: number = 1) {
  const boxHeight = lineHeight * lines

  // Draw line-height box (light blue background)
  page.drawRectangle({
    x: margin,
    y: cursorY - boxHeight,
    width: contentW,
    height: boxHeight,
    color: rgb(0.9, 0.95, 1.0),
    borderColor: rgb(0.7, 0.8, 0.9),
    borderWidth: 0.5,
  })

  // Draw font-size box (light green, shows actual glyph area)
  const fontHeight = font.heightAtSize(fontSize)
  const baselineOffset = fontHeight // distance from top of glyph to baseline
  for (let i = 0; i < lines; i++) {
    const lineTop = cursorY - (i * lineHeight)

    // Green box = glyph bounding area within the line
    page.drawRectangle({
      x: margin,
      y: lineTop - fontHeight,
      width: contentW,
      height: fontHeight,
      color: rgb(0.9, 1.0, 0.9),
      borderColor: rgb(0.6, 0.8, 0.6),
      borderWidth: 0.25,
    })

    // Red baseline line
    const baselineY = lineTop - fontHeight
    page.drawLine({
      start: { x: margin, y: baselineY },
      end: { x: margin + contentW, y: baselineY },
      thickness: 0.25,
      color: rgb(1.0, 0.3, 0.3),
    })
  }

  // Draw text at baseline position
  // pdf-lib y = baseline position
  const textY = cursorY - font.heightAtSize(fontSize)
  page.drawText(label, {
    x: margin,
    y: textY,
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
  })

  // Small annotation showing the geometry
  const annotText = `${fontSize}pt/${lineHeight}pt lh | fontH=${fontHeight.toFixed(1)} | textY=${textY.toFixed(0)}`
  page.drawText(annotText, {
    x: margin + 5,
    y: cursorY - boxHeight + 2,
    size: 6,
    font: regFont,
    color: rgb(0.5, 0.5, 0.5),
  })

  cursorY -= boxHeight
}

// Title
page.drawText('BASELINE ALIGNMENT DIAGNOSTIC', {
  x: margin, y: cursorY - 18, size: 14, font: boldFont, color: rgb(0, 0, 0),
})
cursorY -= 30

page.drawText('Blue box = lineHeight area  |  Green box = font height  |  Red line = baseline', {
  x: margin, y: cursorY - 10, size: 8, font: regFont, color: rgb(0.4, 0.4, 0.4),
})
cursorY -= 24

// Test each size
drawLabeledBox('Body text 11pt (lineHeight 16.5)', 11, regFont, 16.5)
cursorY -= 8
drawLabeledBox('Body text 12pt (lineHeight 18)', 12, regFont, 18)
cursorY -= 8
drawLabeledBox('Bold body 12pt (lineHeight 18)', 12, boldFont, 18)
cursorY -= 8
drawLabeledBox('Heading h4: 13.2pt bold (lineHeight 18.5)', 13.2, boldFont, 18.5)
cursorY -= 8
drawLabeledBox('Heading h3: 15pt bold (lineHeight 21)', 15, boldFont, 21)
cursorY -= 8
drawLabeledBox('Heading h2: 18pt bold (lineHeight 25.2)', 18, boldFont, 25.2)
cursorY -= 8
drawLabeledBox('Heading h1: 24pt bold (lineHeight 33.6)', 24, boldFont, 33.6)
cursorY -= 16

// Multi-line test
drawLabeledBox('Multi-line wrapping test: this is a longer string that should demonstrate how lines of text look when they occupy multiple line boxes at the same size.', 11, regFont, 16.5, 3)
cursorY -= 16

// Show comparison: our toPdfY vs direct
page.drawText('=== toPdfY comparison ===', {
  x: margin, y: cursorY - 12, size: 10, font: boldFont, color: rgb(0, 0, 0),
})
cursorY -= 24

// Method A: toPdfY(yFromTop, fontSize, pageHeight) — what our code does now
const testYFromTop = 400
const testFontSize = 12
const testLineHeight = 18
const pdfYA = 842 - testYFromTop - testFontSize  // our toPdfY
const pdfYB = 842 - testYFromTop - regFont.heightAtSize(testFontSize) // using actual font height

page.drawRectangle({ x: margin, y: pdfYA - 1, width: 200, height: testLineHeight, color: rgb(1, 0.9, 0.9), borderWidth: 0.5, borderColor: rgb(1, 0, 0) })
page.drawText('Method A: toPdfY(y, fontSize, H)', { x: margin + 2, y: pdfYA, size: testFontSize, font: regFont, color: rgb(0.8, 0, 0) })

page.drawRectangle({ x: margin + 230, y: pdfYB - 1, width: 200, height: testLineHeight, color: rgb(0.9, 1, 0.9), borderWidth: 0.5, borderColor: rgb(0, 0.8, 0) })
page.drawText('Method B: toPdfY(y, fontH, H)', { x: margin + 232, y: pdfYB, size: testFontSize, font: regFont, color: rgb(0, 0.6, 0) })

const directBytes = await directDoc.save()
const directPath = path.join(__dirname, 'output', 'diagnostic-baseline.pdf')
fs.writeFileSync(directPath, directBytes)
console.log(`✅ Baseline diagnostic: ${directPath} (${(directBytes.byteLength/1024).toFixed(1)} KB)`)
