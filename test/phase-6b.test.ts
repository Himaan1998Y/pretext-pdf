import { test } from 'node:test'
import assert from 'node:assert'
import { render } from '../dist/index.js'
import type { PdfDocument } from '../dist/types.js'

test('Phase 6B — Hyperlinks / Clickable URLs', async (t) => {
  // ──────────────────────────────────────────────────────────────────────────
  // Test 1: InlineSpan with url renders PDF without error
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('span with url renders PDF successfully', async () => {
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
            { text: 'Visit ', fontWeight: 400, color: '#000000' },
            { text: 'our website', fontWeight: 400, url: 'https://example.com' },
            { text: ' for more info.', fontWeight: 400, color: '#000000' },
          ],
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2: Empty url string throws VALIDATION_ERROR
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('empty url string throws VALIDATION_ERROR', async () => {
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
            { text: 'broken link', fontWeight: 400, url: '' },  // ← INVALID
          ],
        },
      ],
    }

    try {
      await render(doc)
      assert.fail('Should have thrown VALIDATION_ERROR')
    } catch (err: any) {
      assert.strictEqual(err.code, 'VALIDATION_ERROR')
      assert.match(err.message, /url must be a non-empty string/)
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3: URL span auto-applies blue color when no color specified
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('url span with no explicit color auto-applies blue', async () => {
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
            // No color set — should auto-apply #0070f3
            { text: 'auto blue link', fontWeight: 400, url: 'https://example.com' },
          ],
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 4: URL span respects explicit color override
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('url span with explicit color uses that color', async () => {
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
            // Explicit red color — should NOT be overridden to blue
            { text: 'red link', fontWeight: 400, color: '#CC0000', url: 'https://example.com' },
          ],
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 5: Multiple links on same page all render
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('multiple link spans on same page render without error', async () => {
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
            { text: 'Visit ', fontWeight: 400, color: '#000000' },
            { text: 'Google', fontWeight: 400, url: 'https://google.com' },
            { text: ' or ', fontWeight: 400, color: '#000000' },
            { text: 'GitHub', fontWeight: 400, url: 'https://github.com' },
            { text: ' or ', fontWeight: 400, color: '#000000' },
            { text: 'npm', fontWeight: 400, url: 'https://npmjs.com' },
            { text: ' for resources.', fontWeight: 400, color: '#000000' },
          ],
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 6: mailto: URL renders correctly (not just https://)
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('mailto: url renders PDF successfully', async () => {
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
            { text: 'Contact us at ', fontWeight: 400, color: '#000000' },
            { text: 'hello@example.com', fontWeight: 400, url: 'mailto:hello@example.com' },
          ],
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 7: Link with url also gets underline auto-applied
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('url span auto-applies underline even when underline not set', async () => {
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
            // underline not set — should auto-apply because url is set
            { text: 'auto underlined link', fontWeight: 400, url: 'https://example.com' },
          ],
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 8: REGRESSION — spans without url are unchanged from before
  // ──────────────────────────────────────────────────────────────────────────
  await t.test('regression: rich-paragraph without url unchanged', async () => {
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
            { text: 'colored ', fontWeight: 400, color: '#FF0000' },
            { text: 'underlined', fontWeight: 400, color: '#000000', underline: true },
          ],
        },
        {
          type: 'paragraph',
          text: 'Plain paragraph with no links.',
        },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })
})
