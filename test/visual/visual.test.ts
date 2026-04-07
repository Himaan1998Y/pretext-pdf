/**
 * Visual regression tests.
 *
 * Each test renders a document and compares every page pixel-for-pixel against
 * a stored baseline PNG.
 *
 * To generate/update baselines:
 *   UPDATE_BASELINES=1 node --experimental-strip-types test/visual/visual.test.ts
 *
 * To run normally:
 *   node --experimental-strip-types --test test/visual/visual.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { pdfToImages, compareToBaseline } from './compare.ts'
/** Max allowed mismatch percentage before a test fails */
const MAX_MISMATCH_PERCENT = 1.0

async function assertVisualMatch(doc: object, prefix: string): Promise<void> {
  const { render } = await import('../../dist/index.js')
  const pdfBytes = await render(doc as any)
  const pages = await pdfToImages(pdfBytes)

  for (let i = 0; i < pages.length; i++) {
    const baselineName = `${prefix}-p${i + 1}.png`
    const result = await compareToBaseline(pages[i]!, baselineName)

    assert.ok(
      result.mismatchPercent <= MAX_MISMATCH_PERCENT,
      `Visual regression: "${baselineName}" differs by ${result.mismatchPercent.toFixed(2)}% ` +
      `(${result.mismatchPixels} / ${result.totalPixels} pixels). ` +
      `Check test/visual/output/${baselineName.replace('.png', '-diff.png')} for the diff.`
    )
  }
}

// ─── Test documents ───────────────────────────────────────────────────────────

function makeBasicDoc(): PdfDocument {
  return {
    content: [
      { type: 'heading', level: 1, text: 'Visual Regression Test' },
      { type: 'paragraph', text: 'This is a paragraph with default settings. It should wrap correctly and maintain consistent rendering across builds.' },
      { type: 'spacer', height: 12 },
      { type: 'paragraph', text: 'Second paragraph with some bold and color:', color: '#333333' },
      { type: 'hr' },
      { type: 'heading', level: 2, text: 'Section Two' },
      { type: 'paragraph', text: 'Content after the horizontal rule.' },
    ]
  }
}

function makeTableDoc(): PdfDocument {
  return {
    content: [
      { type: 'heading', level: 1, text: 'Table Test' },
      {
        type: 'table',
        columns: [
          { width: '*', align: 'left' },
          { width: 80, align: 'right' },
          { width: 80, align: 'right' },
        ],
        rows: [
          { cells: [{ text: 'Description', fontWeight: 700 }, { text: 'Qty', fontWeight: 700 }, { text: 'Amount', fontWeight: 700 }], isHeader: true },
          { cells: [{ text: 'Web design services' }, { text: '1' }, { text: '₹25,000' }] },
          { cells: [{ text: 'Development sprint (40hrs)' }, { text: '1' }, { text: '₹80,000' }] },
          { cells: [{ text: 'Hosting setup' }, { text: '1' }, { text: '₹5,000' }] },
          { cells: [{ text: 'Total', fontWeight: 700 }, { text: '' }, { text: '₹1,10,000', fontWeight: 700 }] },
        ],
        spaceAfter: 12,
      },
    ]
  }
}

function makeListDoc(): PdfDocument {
  return {
    content: [
      { type: 'heading', level: 1, text: 'List Test' },
      {
        type: 'list',
        style: 'unordered',
        items: [
          { text: 'First unordered item' },
          { text: 'Second item with more text that might wrap if the line is long enough' },
          { text: 'Third item', items: [{ text: 'Nested A' }, { text: 'Nested B' }] },
        ],
        spaceAfter: 12,
      },
      {
        type: 'list',
        style: 'ordered',
        items: [
          { text: 'First ordered item' },
          { text: 'Second ordered item' },
          { text: 'Third ordered item' },
        ],
      },
    ]
  }
}

function makeRichTextDoc(): PdfDocument {
  return {
    content: [
      { type: 'heading', level: 1, text: 'Rich Text Test' },
      {
        type: 'rich-paragraph',
        spans: [
          { text: 'This sentence has ' },
          { text: 'bold text', fontWeight: 700 },
          { text: ' mixed with ' },
          { text: 'colored text', color: '#e63946' },
          { text: ' and then normal text at the end.' },
        ],
        spaceAfter: 8,
      },
      {
        type: 'rich-paragraph',
        spans: [
          { text: 'Center-aligned: ' },
          { text: 'IMPORTANT', fontWeight: 700, color: '#2a9d8f' },
          { text: ' notice.' },
        ],
        align: 'center',
        spaceAfter: 8,
      },
    ]
  }
}

function makePageBreakDoc(): PdfDocument {
  return {
    content: [
      { type: 'heading', level: 1, text: 'Page 1' },
      { type: 'paragraph', text: 'Content on the first page.' },
      { type: 'page-break' },
      { type: 'heading', level: 1, text: 'Page 2' },
      { type: 'paragraph', text: 'Content on the second page, after a forced page break.' },
    ]
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('visual regression — Phase 3', async () => {
  it('basic document (heading, paragraph, hr)', async () => {
    await assertVisualMatch(makeBasicDoc(), 'basic')
  })

  it('table with header row and border-collapse', async () => {
    await assertVisualMatch(makeTableDoc(), 'table')
  })

  it('ordered and unordered lists', async () => {
    await assertVisualMatch(makeListDoc(), 'lists')
  })

  it('rich text with mixed spans', async () => {
    await assertVisualMatch(makeRichTextDoc(), 'rich-text')
  })

  it('forced page break creates correct page count', async () => {
    const doc = makePageBreakDoc()
    const { render } = await import('../../dist/index.js')
    const pdfBytes = await render(doc as any)
    const pages = await pdfToImages(pdfBytes)
    assert.equal(pages.length, 2, 'page-break should produce exactly 2 pages')
    await assertVisualMatch(doc, 'page-break')
  })
})
