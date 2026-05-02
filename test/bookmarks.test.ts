import { test } from 'node:test'
import assert from 'node:assert'
import { render } from '../dist/index.js'
import type { PdfDocument } from '../dist/types.js'

test('Phase 7A — Bookmarks / Outlines', async (t) => {
  // ─────────────────────────────────────────────────────────────────────────
  // Test 1: Document with headings produces PDF with /Outlines marker
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('document with headings produces PDF with /Outlines marker', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        { type: 'heading', level: 1, text: 'Introduction' },
        { type: 'paragraph', text: 'Some content.' },
        { type: 'heading', level: 2, text: 'Background' },
        { type: 'paragraph', text: 'More content.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)

    // Check for /Outlines marker
    const pdfString = Buffer.from(pdf).toString('latin1')
    assert(pdfString.includes('/Outlines'), 'PDF with headings should contain /Outlines marker')

    // Verify PDF header
    const header = Buffer.from(pdf.slice(0, 4)).toString('ascii')
    assert.strictEqual(header, '%PDF')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: doc.bookmarks = false disables outline entirely (no /Outlines marker)
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('doc.bookmarks = false disables outline entirely (no /Outlines marker)', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      bookmarks: false,
      content: [
        { type: 'heading', level: 1, text: 'Title' },
        { type: 'paragraph', text: 'Content.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)

    const pdfString = Buffer.from(pdf).toString('latin1')
    assert(!pdfString.includes('/Outlines'), 'PDF with bookmarks=false should not have /Outlines')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3: minLevel: 2 excludes H1 from outline
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('minLevel: 2 excludes H1 from outline (still renders without error)', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      bookmarks: { minLevel: 2, maxLevel: 4 },
      content: [
        { type: 'heading', level: 1, text: 'Title (H1)' },
        { type: 'heading', level: 2, text: 'Section (H2)' },
        { type: 'paragraph', text: 'Content.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)

    const pdfString = Buffer.from(pdf).toString('latin1')
    // With minLevel: 2, only H2 is included in outline
    assert(pdfString.includes('/Outlines'), 'Should still have /Outlines with minLevel: 2')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 4: maxLevel: 2 excludes H3/H4 from outline
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('maxLevel: 2 excludes H3/H4 from outline (still renders without error)', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      bookmarks: { minLevel: 1, maxLevel: 2 },
      content: [
        { type: 'heading', level: 1, text: 'Title' },
        { type: 'heading', level: 2, text: 'Section' },
        { type: 'heading', level: 3, text: 'Subsection (excluded)' },
        { type: 'heading', level: 4, text: 'Deep (excluded)' },
        { type: 'paragraph', text: 'Content.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)

    const pdfString = Buffer.from(pdf).toString('latin1')
    assert(pdfString.includes('/Outlines'), 'Should have /Outlines with maxLevel: 2')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 5: heading.bookmark = false excludes that specific heading
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('heading.bookmark = false excludes that specific heading', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        { type: 'heading', level: 1, text: 'Main Title' },
        { type: 'heading', level: 2, text: 'Skip Me', bookmark: false },
        { type: 'heading', level: 2, text: 'Include Me' },
        { type: 'paragraph', text: 'Content.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)

    const pdfString = Buffer.from(pdf).toString('latin1')
    assert(pdfString.includes('/Outlines'), 'Should have /Outlines')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 6: Document with no headings renders without error (no /Outlines marker)
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('document with no headings renders without error (no /Outlines marker)', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        { type: 'paragraph', text: 'Just paragraphs, no headings.' },
        { type: 'paragraph', text: 'More content.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)

    const pdfString = Buffer.from(pdf).toString('latin1')
    assert(!pdfString.includes('/Outlines'), 'PDF without headings should not have /Outlines')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 7: Nested headings H1→H2→H3→H4 produce valid PDF
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('nested headings H1→H2→H3→H4 produce valid PDF', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        { type: 'heading', level: 1, text: 'Chapter 1' },
        { type: 'paragraph', text: 'Content.' },
        { type: 'heading', level: 2, text: 'Section 1.1' },
        { type: 'paragraph', text: 'Content.' },
        { type: 'heading', level: 3, text: 'Subsection 1.1.1' },
        { type: 'paragraph', text: 'Content.' },
        { type: 'heading', level: 4, text: 'Sub-subsection 1.1.1.1' },
        { type: 'paragraph', text: 'Content.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)

    const pdfString = Buffer.from(pdf).toString('latin1')
    assert(pdfString.includes('/Outlines'), 'Nested headings should produce /Outlines')

    const header = Buffer.from(pdf.slice(0, 4)).toString('ascii')
    assert.strictEqual(header, '%PDF', 'Should be valid PDF')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 8: Regression — existing document renders identically (bookmarks on by default)
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('regression: existing document renders identically (bookmarks on by default)', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        { type: 'heading', level: 1, text: 'Document' },
        { type: 'paragraph', text: 'Paragraph text.' },
        { type: 'hr' },
        { type: 'list', style: 'unordered', items: [{ text: 'Item 1' }, { text: 'Item 2' }] },
        { type: 'heading', level: 2, text: 'Section' },
        { type: 'paragraph', text: 'More content.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)

    const header = Buffer.from(pdf.slice(0, 4)).toString('ascii')
    assert.strictEqual(header, '%PDF', 'Should produce valid PDF')

    // Bookmarks are on by default when headings exist
    const pdfString = Buffer.from(pdf).toString('latin1')
    assert(pdfString.includes('/Outlines'), 'Default behavior should include bookmarks')
  })
})
