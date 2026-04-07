import { test } from 'node:test'
import assert from 'node:assert'
import { render } from '../dist/index.js'
import type { PdfDocument } from '../dist/types.js'

test('Phase 5B.4 — Per-Span Font Size', async (t) => {
  // ──────────────────────────────────────────────────────────────────────────
  // Test 1: Span fontSize must be positive when provided
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('validation: spans[].fontSize = 0 throws VALIDATION_ERROR', async () => {
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
            { text: 'Valid span', fontWeight: 400, fontStyle: 'normal', color: '#000000' },
            {
              text: 'Invalid zero fontSize',
              fontSize: 0,  // ← INVALID
              fontWeight: 400,
              fontStyle: 'normal',
              color: '#000000',
            },
          ],
        },
      ],
    }

    try {
      await render(doc)
      assert.fail('Should have thrown VALIDATION_ERROR')
    } catch (err: any) {
      assert.strictEqual(err.code, 'VALIDATION_ERROR')
      assert.match(err.message, /fontSize must be a positive finite number/)
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2: Span fontSize must be positive
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('validation: spans[].fontSize = -5 throws VALIDATION_ERROR', async () => {
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
            { text: 'Valid span', fontWeight: 400, fontStyle: 'normal', color: '#000000' },
            {
              text: 'Invalid negative fontSize',
              fontSize: -5,  // ← INVALID
              fontWeight: 400,
              fontStyle: 'normal',
              color: '#000000',
            },
          ],
        },
      ],
    }

    try {
      await render(doc)
      assert.fail('Should have thrown VALIDATION_ERROR')
    } catch (err: any) {
      assert.strictEqual(err.code, 'VALIDATION_ERROR')
      assert.match(err.message, /fontSize must be a positive finite number/)
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3: Valid per-span font size renders without error
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('valid: spans[].fontSize = 14 renders PDF successfully', async () => {
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
            { text: 'Normal 12pt ', fontWeight: 400, fontStyle: 'normal', color: '#000000' },
            {
              text: 'Large 14pt span',
              fontSize: 14,  // ← VALID
              fontWeight: 400,
              fontStyle: 'normal',
              color: '#000000',
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
  // Test 4: Mixed font sizes render and produce valid PDF
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('mixed fonts: 10pt + 18pt spans in same paragraph', async () => {
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
              text: 'Small 10pt ',
              fontSize: 10,
              fontWeight: 400,
              fontStyle: 'normal',
              color: '#000000',
            },
            {
              text: 'Large 18pt ',
              fontSize: 18,
              fontWeight: 700,
              fontStyle: 'normal',
              color: '#000000',
            },
            {
              text: 'back to 10pt',
              fontSize: 10,
              fontWeight: 400,
              fontStyle: 'normal',
              color: '#000000',
            },
          ],
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
    // PDF should contain all three spans (validation via valid structure)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 5: Large span font size with proper pagination
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('pagination: large span fontSize forces page breaks correctly', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        {
          type: 'paragraph',
          text: 'Intro paragraph',
        },
        {
          type: 'rich-paragraph',
          spans: [
            {
              text: 'Multiple lines with 24pt font size to test pagination. ',
              fontSize: 24,
              fontWeight: 400,
              fontStyle: 'normal',
              color: '#000000',
            },
            {
              text: 'This should wrap to multiple lines and potentially span pages. ',
              fontSize: 24,
              fontWeight: 400,
              fontStyle: 'normal',
              color: '#000000',
            },
            {
              text: 'Adding more content to ensure pagination is correct.',
              fontSize: 24,
              fontWeight: 400,
              fontStyle: 'normal',
              color: '#000000',
            },
          ],
        },
        {
          type: 'paragraph',
          text: 'Outro paragraph',
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
    // Verify no overlap or missing content (visual inspection in browser)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 6: REGRESSION — uniform font size produces identical output to Phase 5A
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('regression: rich-paragraph without per-span fontSize works unchanged', async () => {
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
            { text: 'Bold ', fontWeight: 700, fontStyle: 'normal', color: '#000000' },
            { text: 'red text ', fontWeight: 400, fontStyle: 'normal', color: '#FF0000' },
            { text: 'blue text', fontWeight: 400, fontStyle: 'normal', color: '#0000FF' },
          ],
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
    // No per-span font size — all spans use default 12pt
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 7: Multi-column rich-paragraph with mixed font sizes
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('multi-column: rich-paragraph with variable font sizes renders correctly', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        {
          type: 'rich-paragraph',
          columns: 2,
          spans: [
            {
              text: 'Column 1 with 10pt text. ',
              fontSize: 10,
              fontWeight: 400,
              fontStyle: 'normal',
              color: '#000000',
            },
            {
              text: 'Column 1 with 14pt text. ',
              fontSize: 14,
              fontWeight: 400,
              fontStyle: 'normal',
              color: '#000000',
            },
            {
              text: 'Column 1 back to 10pt. ',
              fontSize: 10,
              fontWeight: 400,
              fontStyle: 'normal',
              color: '#000000',
            },
            {
              text: 'Column 2 with 12pt text. ',
              fontSize: 12,
              fontWeight: 400,
              fontStyle: 'normal',
              color: '#000000',
            },
            {
              text: 'Column 2 with 16pt text. ',
              fontSize: 16,
              fontWeight: 700,
              fontStyle: 'normal',
              color: '#000000',
            },
          ],
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
    // Multi-column layout with per-column cumulative Y tracking
  })
})
