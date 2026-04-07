import { test } from 'node:test'
import assert from 'node:assert'
import { render } from '../dist/index.js'
import type { PdfDocument } from '../dist/types.js'

const LATIN_TEXT = 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.'

test('Phase 6D — Font Subsetting', async (t) => {
  // ──────────────────────────────────────────────────────────────────────────
  // Test 1: PDF with subsetting enabled produces a valid, smaller PDF
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('subsetted PDF is smaller than a known full-embed size', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        { type: 'heading', level: 1, text: 'Hello World' },
        { type: 'paragraph', text: LATIN_TEXT },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)

    // A fully-embedded Inter font is ~320KB. With subsetting, this simple doc
    // should be significantly smaller. Threshold: < 150KB (conservative).
    assert(pdf.length < 150_000, `Expected subsetted PDF < 150KB, got ${pdf.length} bytes`)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2: PDF starts with %PDF header (valid PDF structure)
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('subsetted PDF has valid %PDF header', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [{ type: 'paragraph', text: 'Hello subsetting!' }],
    }

    const pdf = await render(doc)
    const header = Buffer.from(pdf.slice(0, 4)).toString('ascii')
    assert.strictEqual(header, '%PDF', 'PDF should start with %PDF')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3: Document with all element types renders correctly with subsetting
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('full document with all element types renders with subsetting', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        { type: 'heading', level: 1, text: 'Report Title' },
        { type: 'paragraph', text: LATIN_TEXT },
        { type: 'blockquote', text: 'An important quote from someone notable.' },
        {
          type: 'rich-paragraph',
          spans: [
            { text: 'Bold text ', fontWeight: 700, color: '#000000' },
            { text: 'and colored text.', fontWeight: 400, color: '#CC0000' },
          ],
        },
        {
          type: 'list',
          style: 'unordered',
          items: [{ text: 'First item' }, { text: 'Second item' }],
        },
        {
          type: 'table',
          columns: [{ width: '1*' }, { width: '1*' }],
          rows: [
            { cells: [{ text: 'Header A' }, { text: 'Header B' }], isHeader: true },
            { cells: [{ text: 'Value 1' }, { text: 'Value 2' }] },
          ],
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
    const header = Buffer.from(pdf.slice(0, 4)).toString('ascii')
    assert.strictEqual(header, '%PDF')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 4: Header/footer with page numbers renders correctly
  // (subsetting must include digit glyphs 0-9)
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('document with header/footer page numbers renders after subsetting', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 60, bottom: 60, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      header: { text: 'My Document — Page {{pageNumber}} of {{totalPages}}', align: 'center' },
      footer: { text: 'Confidential — {{pageNumber}}', align: 'right' },
      content: [
        { type: 'paragraph', text: LATIN_TEXT },
        { type: 'paragraph', text: LATIN_TEXT },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 5: Bold variant is subsetted independently from regular
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('bold and regular font variants subsetted independently', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        { type: 'heading', level: 1, text: 'Bold Heading' },
        { type: 'paragraph', text: 'Regular text paragraph.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
    // Both variants should produce a smaller combined PDF than two full embeds
    assert(pdf.length < 300_000, `Expected subsetted PDF with 2 fonts < 300KB, got ${pdf.length}`)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 6: REGRESSION — all Phase 6A/6B/6C features still work after subsetting
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('regression: decoration, links, and justify still work after subsetting', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        {
          type: 'paragraph',
          text: 'This is a justified paragraph with enough text to wrap across multiple lines in the document layout.',
          align: 'justify',
        },
        {
          type: 'rich-paragraph',
          spans: [
            { text: 'Underlined ', fontWeight: 400, color: '#000000', underline: true },
            { text: 'and ', fontWeight: 400, color: '#000000' },
            { text: 'link text', fontWeight: 400, url: 'https://example.com' },
          ],
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
    const header = Buffer.from(pdf.slice(0, 4)).toString('ascii')
    assert.strictEqual(header, '%PDF', 'regression PDF should be valid')
  })
})
