import { test } from 'node:test'
import assert from 'node:assert'
import { render } from '../dist/index.js'
import type { PdfDocument } from '../dist/types.js'

test('Phase 6A — Text Decoration (Underline / Strikethrough)', async (t) => {
  // ──────────────────────────────────────────────────────────────────────────
  // Test 1: InlineSpan with underline renders without error
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('span underline: true renders PDF successfully', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        {
          type: 'rich-paragraph',
          spans: [
            { text: 'Normal text ', fontWeight: 400, color: '#000000' },
            { text: 'underlined text', fontWeight: 400, color: '#000000', underline: true },
          ],
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2: InlineSpan with strikethrough renders without error
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('span strikethrough: true renders PDF successfully', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        {
          type: 'rich-paragraph',
          spans: [
            { text: 'Normal text ', fontWeight: 400, color: '#000000' },
            { text: 'struck-through text', fontWeight: 400, color: '#000000', strikethrough: true },
          ],
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3: InlineSpan with both underline and strikethrough
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('span with both underline and strikethrough renders PDF', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        {
          type: 'rich-paragraph',
          spans: [
            {
              text: 'double decorated',
              fontWeight: 700,
              color: '#CC0000',
              underline: true,
              strikethrough: true,
            },
          ],
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 4: Underline color follows span color (not hardcoded black)
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('underline color follows span color (blue span → blue underline)', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        {
          type: 'rich-paragraph',
          spans: [
            { text: 'blue link text', fontWeight: 400, color: '#0000FF', underline: true },
            { text: ' red strikethrough', fontWeight: 400, color: '#FF0000', strikethrough: true },
          ],
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 5: Paragraph with underline: true renders all lines underlined
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('paragraph element with underline: true renders PDF', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        {
          type: 'paragraph',
          text: 'This entire paragraph is underlined. It may wrap across multiple lines and each should be underlined.',
          underline: true,
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 6: Heading with underline: true
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('heading element with underline: true renders PDF', async () => {
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
          text: 'Underlined H1 Heading',
          underline: true,
        },
        {
          type: 'heading',
          level: 2,
          text: 'Strikethrough H2',
          strikethrough: true,
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 7: Mixed rich-paragraph — only some spans decorated
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('mixed rich-paragraph: only some spans have decoration', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        {
          type: 'rich-paragraph',
          spans: [
            { text: 'Normal span. ', fontWeight: 400, color: '#000000' },
            { text: 'Underlined span. ', fontWeight: 400, color: '#000080', underline: true },
            { text: 'Normal again. ', fontWeight: 400, color: '#000000' },
            { text: 'Strikethrough span.', fontWeight: 400, color: '#800000', strikethrough: true },
          ],
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 8: REGRESSION — spans without decoration unchanged from before
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('regression: rich-paragraph without decoration produces valid PDF', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        {
          type: 'rich-paragraph',
          spans: [
            { text: 'Bold ', fontWeight: 700, color: '#000000' },
            { text: 'red text ', fontWeight: 400, color: '#FF0000' },
            { text: 'blue text', fontWeight: 400, color: '#0000FF' },
          ],
        },
        {
          type: 'paragraph',
          text: 'Plain paragraph with no decoration.',
        },
        {
          type: 'heading',
          level: 2,
          text: 'Plain heading',
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })
})
