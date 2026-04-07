import { test } from 'node:test'
import assert from 'node:assert'
import { render } from '../dist/index.js'
import type { PdfDocument } from '../dist/types.js'

const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.'

test('Phase 6C — Justified Text Alignment', async (t) => {
  // ──────────────────────────────────────────────────────────────────────────
  // Test 1: Paragraph with align: 'justify' renders PDF
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('paragraph align justify renders PDF successfully', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        {
          type: 'paragraph',
          text: LOREM,
          align: 'justify',
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2: Invalid align value throws VALIDATION_ERROR
  // ──────────────────────────────────────────────────────────────────────────
  await t.test("invalid align 'full' throws VALIDATION_ERROR", async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        {
          type: 'paragraph',
          text: 'Test',
          align: 'full' as any,  // ← INVALID
        },
      ],
    }

    try {
      await render(doc)
      assert.fail('Should have thrown VALIDATION_ERROR')
    } catch (err: any) {
      assert.strictEqual(err.code, 'VALIDATION_ERROR')
      assert.match(err.message, /align/)
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3: Short single-line justified paragraph (no stretching needed)
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('single-line justified paragraph renders without error', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        {
          type: 'paragraph',
          text: 'Short text.',
          align: 'justify',
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 4: Multi-page justified paragraph renders correctly
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('multi-page justified paragraph renders all pages', async () => {
    const longText = LOREM + ' ' + LOREM + ' ' + LOREM + ' ' + LOREM
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        {
          type: 'paragraph',
          text: longText,
          align: 'justify',
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 5: Heading with align: 'justify' renders
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('heading with align justify renders PDF', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        {
          type: 'heading',
          level: 1,
          text: 'Justified Heading Text That Is Long Enough To Wrap Across Multiple Lines In The Document',
          align: 'justify',
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 6: Blockquote with align: 'justify' renders
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('blockquote with align justify renders PDF', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        {
          type: 'blockquote',
          text: LOREM,
          align: 'justify',
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 7: Justified and non-justified paragraphs on same page
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('mixed alignment paragraphs on same page render correctly', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        { type: 'paragraph', text: LOREM, align: 'left' },
        { type: 'paragraph', text: LOREM, align: 'justify' },
        { type: 'paragraph', text: LOREM, align: 'center' },
        { type: 'paragraph', text: LOREM, align: 'right' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 8: REGRESSION — left/center/right alignment unchanged
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('regression: left/center/right alignment still work', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        { type: 'heading', level: 2, text: 'Left aligned heading', align: 'left' },
        { type: 'heading', level: 2, text: 'Center aligned heading', align: 'center' },
        { type: 'heading', level: 2, text: 'Right aligned heading', align: 'right' },
        { type: 'paragraph', text: 'Normal left-aligned paragraph.', align: 'left' },
        { type: 'paragraph', text: 'Centered paragraph.', align: 'center' },
        { type: 'paragraph', text: 'Right-aligned paragraph.', align: 'right' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })
})
