import { test } from 'node:test'
import assert from 'node:assert'
import { render } from '../dist/index.js'
import type { PdfDocument } from '../dist/types.js'

const CIRCLE_SVG = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="blue"/></svg>'
const RECT_SVG_ATTRS = '<svg width="200" height="100" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="180" height="80" fill="red"/></svg>'

// Minimal valid 1x1 transparent PNG bytes
const MINIMAL_PNG = new Uint8Array([
  0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,
  0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
  0xDE,0x00,0x00,0x00,0x0C,0x49,0x44,0x41,0x54,0x08,0xD7,0x63,0xF8,0xCF,0xC0,0x00,
  0x00,0x00,0x02,0x00,0x01,0xE2,0x21,0xBC,0x33,0x00,0x00,0x00,0x00,0x49,0x45,0x4E,
  0x44,0xAE,0x42,0x60,0x82
])

test('Phase 7E — SVG Support', async (t) => {
  // ─────────────────────────────────────────────────────────────────────────
  // Test 1: Simple SVG circle renders to PDF without error
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('simple SVG circle renders to PDF without error', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'svg', svg: CIRCLE_SVG },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
    const header = Buffer.from(pdf.slice(0, 4)).toString('ascii')
    assert.strictEqual(header, '%PDF')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: SVG with viewBox auto-computes height
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('SVG with viewBox auto-computes height', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'svg', svg: CIRCLE_SVG, width: 200 },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3: SVG with explicit width and height renders
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('SVG with explicit width and height renders', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'svg', svg: CIRCLE_SVG, width: 150, height: 100 },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 4: SVG alignment center and right both render without error
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('SVG alignment center and right both render without error', async () => {
    const docCenter: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'svg', svg: CIRCLE_SVG, width: 150, height: 100, align: 'center' },
      ],
    }

    const docRight: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'svg', svg: RECT_SVG_ATTRS, align: 'right' },
      ],
    }

    const pdfCenter = await render(docCenter)
    assert(pdfCenter instanceof Uint8Array)
    assert(pdfCenter.length > 0)

    const pdfRight = await render(docRight)
    assert(pdfRight instanceof Uint8Array)
    assert(pdfRight.length > 0)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 5: SVG with garbage string — @napi-rs/canvas silently renders blank,
  //         so the render completes without throwing (no crash on bad input)
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('SVG with garbage string throws SVG_INVALID_MARKUP', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'svg', svg: 'this is not xml' },
      ],
    }

    // SVG content is now validated upfront (Phase 7 audit fix).
    // Garbage strings that don't start with '<' are rejected at validation time.
    try {
      await render(doc)
      assert.fail('Should have thrown SVG_INVALID_MARKUP error')
    } catch (e: any) {
      assert.strictEqual(e.code, 'SVG_INVALID_MARKUP', `Expected SVG_INVALID_MARKUP but got ${e.code}`)
      assert.match(e.message, /must start with/, 'Error message should mention "must start with"')
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 6: Empty SVG string throws VALIDATION_ERROR
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('empty SVG string throws VALIDATION_ERROR', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'svg', svg: '' },
      ],
    }

    await assert.rejects(
      () => render(doc),
      (err: any) => {
        assert.strictEqual(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 7: SVG in multi-page document — fill first page with long text, then add SVG
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('SVG in multi-page document renders correctly', async () => {
    const longText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(80)

    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'paragraph', text: longText },
        { type: 'svg', svg: CIRCLE_SVG, width: 150, height: 150 },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
    const header = Buffer.from(pdf.slice(0, 4)).toString('ascii')
    assert.strictEqual(header, '%PDF')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 8: Regression — document with a regular PNG image element still renders correctly
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('regression — regular PNG image element still renders correctly', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'paragraph', text: 'Before image.' },
        { type: 'image', src: MINIMAL_PNG, format: 'png', width: 50, height: 50 },
        { type: 'paragraph', text: 'After image.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
    const header = Buffer.from(pdf.slice(0, 4)).toString('ascii')
    assert.strictEqual(header, '%PDF')
  })
})
