/**
 * Tests for the pdfmake compatibility shim (src/compat.ts).
 *
 * Covers the public translation contract: page setup, styles, content nodes,
 * header/footer, integration rendering, and unsupported node handling.
 *
 * Run standalone:
 *   cd F:\Antigravity\brain\projects\pretext-pdf
 *   npx tsx --test test/compat.test.ts
 */
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

const { fromPdfmake } = await import('../dist/compat.js')
const { render } = await import('../dist/index.js')

// ─── describe('page setup') ───────────────────────────────────────────────────

describe('page setup', () => {
  test('pageSize string "A4" maps to PdfDocument.pageSize as "A4"', () => {
    const result = fromPdfmake({ pageSize: 'A4', content: [] })
    assert.strictEqual(result.pageSize, 'A4')
  })

  test('pageSize string "LETTER" normalizes to "Letter"', () => {
    const result = fromPdfmake({ pageSize: 'LETTER', content: [] })
    assert.strictEqual(result.pageSize, 'Letter')
  })

  test('pageSize { width, height } object is stored as [width, height] array', () => {
    const result = fromPdfmake({ pageSize: { width: 500, height: 700 }, content: [] })
    // compat.ts converts object form to [w, h] tuple
    assert.deepEqual(result.pageSize, [500, 700])
  })

  test('pageSize { width, height } with landscape orientation swaps axes', () => {
    const result = fromPdfmake({
      pageSize: { width: 500, height: 700 },
      pageOrientation: 'landscape',
      content: [],
    })
    // landscape swaps: height becomes width
    assert.deepEqual(result.pageSize, [700, 500])
  })

  test('pageMargins array [left, top, right, bottom] maps to margins object', () => {
    const result = fromPdfmake({
      pageMargins: [40, 60, 40, 60],
      content: [],
    })
    assert.deepEqual(result.margins, { left: 40, top: 60, right: 40, bottom: 60 })
  })

  test('pageMargins scalar applies uniformly to all sides', () => {
    const result = fromPdfmake({ pageMargins: 50, content: [] })
    assert.deepEqual(result.margins, { left: 50, top: 50, right: 50, bottom: 50 })
  })

  test('pageMargins [horizontal, vertical] tuple maps to symmetric margins', () => {
    const result = fromPdfmake({ pageMargins: [30, 50], content: [] })
    assert.deepEqual(result.margins, { left: 30, top: 50, right: 30, bottom: 50 })
  })
})

// ─── describe('styles') ──────────────────────────────────────────────────────

describe('styles', () => {
  test('defaultStyle.fontSize maps to PdfDocument.defaultFontSize', () => {
    const result = fromPdfmake({
      defaultStyle: { fontSize: 14 },
      content: ['hello'],
    })
    assert.strictEqual(result.defaultFontSize, 14)
  })

  test('defaultStyle.font maps to PdfDocument.defaultFont', () => {
    const result = fromPdfmake({
      defaultStyle: { font: 'Courier' },
      content: [],
    })
    assert.strictEqual(result.defaultFont, 'Courier')
  })

  test('style name "h1" via { text, style: "h1" } produces heading element with level 1', () => {
    const result = fromPdfmake({
      content: [{ text: 'My Heading', style: 'h1' }],
    })
    const el = result.content[0]
    assert.ok(el, 'content[0] must exist')
    assert.strictEqual(el.type, 'heading')
    if (el.type === 'heading') {
      assert.strictEqual(el.level, 1)
      assert.strictEqual(el.text, 'My Heading')
    }
  })

  test('style name "header" maps to heading level 1', () => {
    const result = fromPdfmake({
      content: [{ text: 'Title', style: 'header' }],
    })
    const el = result.content[0]
    assert.ok(el && el.type === 'heading')
    if (el.type === 'heading') assert.strictEqual(el.level, 1)
  })

  test('style name "subheader" maps to heading level 2', () => {
    const result = fromPdfmake({
      content: [{ text: 'Sub', style: 'subheader' }],
    })
    const el = result.content[0]
    assert.ok(el && el.type === 'heading')
    if (el.type === 'heading') assert.strictEqual(el.level, 2)
  })

  test('headingMap option overrides default style mapping', () => {
    const result = fromPdfmake(
      { content: [{ text: 'Custom Section', style: 'sectionTitle' }] },
      { headingMap: { sectionTitle: 2 } },
    )
    const el = result.content[0]
    assert.ok(el, 'content[0] must exist')
    assert.strictEqual(el.type, 'heading')
    if (el.type === 'heading') {
      assert.strictEqual(el.level, 2)
    }
  })

  test('headingMap: {} disables heading detection, all become paragraphs', () => {
    const result = fromPdfmake(
      { content: [{ text: 'Not a heading', style: 'h1' }] },
      { headingMap: {} },
    )
    const el = result.content[0]
    assert.ok(el, 'content[0] must exist')
    assert.strictEqual(el.type, 'paragraph')
  })

  test('named style from styles map is applied to text node', () => {
    const result = fromPdfmake({
      styles: { emphasis: { fontSize: 18, color: '#ff0000' } },
      content: [{ text: 'Styled', style: 'emphasis' }],
    })
    const el = result.content[0]
    assert.ok(el, 'content[0] must exist')
    assert.strictEqual(el.type, 'paragraph')
    if (el.type === 'paragraph') {
      assert.strictEqual(el.fontSize, 18)
      assert.strictEqual(el.color, '#ff0000')
    }
  })
})

// ─── describe('content nodes') ───────────────────────────────────────────────

describe('content nodes', () => {
  test('plain string content becomes a paragraph element', () => {
    const result = fromPdfmake({ content: ['hello'] })
    assert.strictEqual(result.content.length, 1)
    const el = result.content[0]
    assert.ok(el, 'content[0] must exist')
    assert.strictEqual(el.type, 'paragraph')
    if (el.type === 'paragraph') {
      assert.strictEqual(el.text, 'hello')
    }
  })

  test('{ text } with plain string text produces paragraph', () => {
    const result = fromPdfmake({ content: [{ text: 'hello' }] })
    assert.strictEqual(result.content.length, 1)
    const el = result.content[0]
    assert.ok(el, 'content[0] must exist')
    assert.strictEqual(el.type, 'paragraph')
    if (el.type === 'paragraph') {
      assert.strictEqual(el.text, 'hello')
    }
  })

  test('{ ul } produces an unordered list element', () => {
    const result = fromPdfmake({
      content: [{ ul: ['Item 1', 'Item 2'] }],
    })
    const el = result.content[0]
    assert.ok(el, 'content[0] must exist')
    assert.strictEqual(el.type, 'list')
    if (el.type === 'list') {
      assert.strictEqual(el.style, 'unordered')
      assert.strictEqual(el.items.length, 2)
      assert.strictEqual(el.items[0]?.text, 'Item 1')
      assert.strictEqual(el.items[1]?.text, 'Item 2')
    }
  })

  test('{ ol } produces an ordered list element', () => {
    const result = fromPdfmake({
      content: [{ ol: ['First', 'Second'] }],
    })
    const el = result.content[0]
    assert.ok(el, 'content[0] must exist')
    assert.strictEqual(el.type, 'list')
    if (el.type === 'list') {
      assert.strictEqual(el.style, 'ordered')
      assert.strictEqual(el.items.length, 2)
    }
  })

  test('nested ul inside ul preserves item hierarchy', () => {
    const result = fromPdfmake({
      content: [
        {
          ul: [
            'Top item',
            { ul: ['Nested A', 'Nested B'] },
          ],
        },
      ],
    })
    const el = result.content[0]
    assert.ok(el && el.type === 'list', 'should be a list')
    if (el.type === 'list') {
      assert.strictEqual(el.items.length, 2)
      const nestedItem = el.items[1]
      assert.ok(nestedItem, 'nested list item must exist')
      // pdfmake nests via { ul: [...] } as child item → { text: '', items: [...] }
      assert.ok(Array.isArray(nestedItem.items), 'nested item should have items array')
      assert.strictEqual(nestedItem.items?.length, 2)
      assert.strictEqual(nestedItem.items?.[0]?.text, 'Nested A')
    }
  })

  test('{ table } with headerRows: 1 produces table with first row marked isHeader', () => {
    const result = fromPdfmake({
      content: [
        {
          table: {
            widths: [100, '*'],
            headerRows: 1,
            body: [
              ['Name', 'Value'],
              ['Alpha', '1'],
              ['Beta', '2'],
            ],
          },
        },
      ],
    })
    const el = result.content[0]
    assert.ok(el && el.type === 'table', 'should be a table')
    if (el.type === 'table') {
      assert.strictEqual(el.columns.length, 2)
      assert.strictEqual(el.rows.length, 3)
      // Header row
      const headerRow = el.rows[0]
      assert.ok(headerRow, 'rows[0] must exist')
      assert.strictEqual(headerRow.isHeader, true)
      assert.strictEqual(headerRow.cells[0]?.text, 'Name')
      // Data rows have no isHeader
      const dataRow = el.rows[1]
      assert.ok(dataRow, 'rows[1] must exist')
      assert.ok(!dataRow.isHeader, 'data rows should not have isHeader')
    }
  })

  test('{ table } numeric width column passes through as-is', () => {
    const result = fromPdfmake({
      content: [
        {
          table: {
            widths: [120, 200],
            body: [['A', 'B']],
          },
        },
      ],
    })
    const el = result.content[0]
    assert.ok(el && el.type === 'table')
    if (el.type === 'table') {
      assert.strictEqual(el.columns[0]?.width, 120)
      assert.strictEqual(el.columns[1]?.width, 200)
    }
  })

  test('{ image } translates to image element with src', () => {
    const result = fromPdfmake({
      content: [{ image: '/path/to/photo.png', width: 200, height: 150 }],
    })
    const el = result.content[0]
    assert.ok(el, 'content[0] must exist')
    assert.strictEqual(el.type, 'image')
    if (el.type === 'image') {
      assert.strictEqual(el.src, '/path/to/photo.png')
      assert.strictEqual(el.width, 200)
      assert.strictEqual(el.height, 150)
    }
  })

  test('{ qr, fit: 100 } translates to qr-code element with size 100', () => {
    const result = fromPdfmake({
      content: [{ qr: 'https://example.com', fit: 100 }],
    })
    const el = result.content[0]
    assert.ok(el, 'content[0] must exist')
    assert.strictEqual(el.type, 'qr-code')
    if (el.type === 'qr-code') {
      assert.strictEqual(el.data, 'https://example.com')
      assert.strictEqual(el.size, 100)
    }
  })

  test('{ pageBreak: "before" } produces page-break element before inner content', () => {
    const result = fromPdfmake({
      content: [{ text: 'After break', pageBreak: 'before' }],
    })
    // pageBreak:'before' → [page-break, paragraph]
    assert.ok(result.content.length >= 1)
    const first = result.content[0]
    assert.ok(first, 'content[0] must exist')
    assert.strictEqual(first.type, 'page-break')
  })

  test('{ pageBreak: "after" } produces page-break element after inner content', () => {
    const result = fromPdfmake({
      content: [{ text: 'Before break', pageBreak: 'after' }],
    })
    // pageBreak:'after' → [paragraph, page-break]
    assert.ok(result.content.length >= 2)
    const last = result.content[result.content.length - 1]
    assert.ok(last, 'last content element must exist')
    assert.strictEqual(last.type, 'page-break')
  })

  test('{ stack: [...] } recursively flattens children into parent content', () => {
    const result = fromPdfmake({
      content: [
        {
          stack: [
            'First paragraph',
            { text: 'Second paragraph' },
          ],
        },
      ],
    })
    // stack children are inlined — two elements, not a wrapper
    assert.strictEqual(result.content.length, 2)
    assert.strictEqual(result.content[0]?.type, 'paragraph')
    assert.strictEqual(result.content[1]?.type, 'paragraph')
    if (result.content[0]?.type === 'paragraph') {
      assert.strictEqual(result.content[0].text, 'First paragraph')
    }
  })
})

// ─── describe('header/footer') ───────────────────────────────────────────────

describe('header/footer', () => {
  test('header string form translates to HeaderFooterSpec with text', () => {
    const result = fromPdfmake({
      header: 'My header',
      content: [],
    })
    assert.ok(result.header, 'result.header must be defined')
    assert.strictEqual(result.header.text, 'My header')
  })

  test('footer string form translates to HeaderFooterSpec with text', () => {
    const result = fromPdfmake({
      footer: 'Page {page}',
      content: [],
    })
    assert.ok(result.footer, 'result.footer must be defined')
    assert.strictEqual(result.footer.text, 'Page {page}')
  })

  test('header object form with alignment and fontSize translates correctly', () => {
    const result = fromPdfmake({
      header: { text: 'Report Title', alignment: 'center', fontSize: 10 },
      content: [],
    })
    assert.ok(result.header, 'result.header must be defined')
    assert.strictEqual(result.header.text, 'Report Title')
    assert.strictEqual(result.header.align, 'center')
    assert.strictEqual(result.header.fontSize, 10)
  })

  test('function-style header calls onUnsupported and produces no header', () => {
    const warnings: string[] = []
    const result = fromPdfmake(
      {
        header: (() => 'dynamic header') as any,
        content: [],
      },
      { onUnsupported: (f) => warnings.push(f) },
    )
    assert.ok(result.header === undefined, 'function-style header should not produce a header spec')
    assert.strictEqual(warnings.length, 1)
    assert.ok(warnings[0]?.includes('header'), 'warning should mention "header"')
  })
})

// ─── describe('integration') ─────────────────────────────────────────────────

describe('integration', () => {
  test('fromPdfmake output renders to a valid PDF without throwing', async () => {
    const doc = fromPdfmake({
      pageSize: 'A4',
      pageMargins: [72, 72, 72, 72],
      header: 'Integration Test Document',
      footer: 'Page footer',
      content: [
        { text: 'Integration Test', style: 'h1' },
        'This is a plain paragraph.',
        {
          ul: ['Item one', 'Item two', 'Item three'],
        },
        {
          table: {
            widths: ['*', '*'],
            headerRows: 1,
            body: [
              ['Column A', 'Column B'],
              ['Row 1 A', 'Row 1 B'],
            ],
          },
        },
        { text: 'End of document.', style: 'subheader' },
      ],
    })

    const bytes = await render(doc)
    assert.ok(bytes instanceof Uint8Array, 'render() should return Uint8Array')
    assert.ok(bytes.length > 500, `PDF too small: ${bytes.length} bytes`)
    // All PDFs start with %PDF-
    assert.strictEqual(bytes[0], 0x25, 'byte 0 should be 0x25 (%)')
    assert.strictEqual(bytes[1], 0x50, 'byte 1 should be 0x50 (P)')
    assert.strictEqual(bytes[2], 0x44, 'byte 2 should be 0x44 (D)')
    assert.strictEqual(bytes[3], 0x46, 'byte 3 should be 0x46 (F)')
  })
})

// ─── describe('edge cases (M-tier audit)') ──────────────────────────────────

describe('edge cases — text array, nested tables, empty containers', () => {
  test('text field as array of styled objects produces rich-paragraph with spans', () => {
    const result = fromPdfmake({
      content: [
        {
          text: [
            { text: 'Bold part', bold: true },
            ' plain part',
            { text: ' italic part', italics: true },
          ],
        },
      ],
    })
    const el = result.content[0]
    assert.ok(el, 'content[0] must exist')
    assert.strictEqual(el.type, 'rich-paragraph')
    if (el.type === 'rich-paragraph') {
      assert.strictEqual(el.spans.length, 3, 'expected three spans for three children')
      assert.strictEqual(el.spans[0]?.fontWeight, 700, 'first span should be bold')
      assert.strictEqual(el.spans[1]?.text, ' plain part')
      assert.strictEqual(el.spans[2]?.fontStyle, 'italic', 'third span should be italic')
    }
  })

  test('text field as single nested object is wrapped into a rich-paragraph', () => {
    const result = fromPdfmake({
      content: [
        {
          text: { text: 'Just one span', color: '#ff0000' },
        } as any,
      ],
    })
    const el = result.content[0]
    assert.ok(el, 'content[0] must exist')
    // Single styled child collapses to paragraph (downgrade path in collectSpans)
    // OR rich-paragraph if styling forces it. Both are acceptable contracts —
    // assert that the text content is preserved either way.
    if (el.type === 'paragraph') {
      assert.strictEqual(el.text, 'Just one span')
    } else if (el.type === 'rich-paragraph') {
      assert.strictEqual(el.spans[0]?.text, 'Just one span')
    } else {
      assert.fail(`unexpected element type for single-object text: ${el.type}`)
    }
  })

  test('nested table inside a table cell is flattened to plain text', () => {
    // pdfmake supports nesting a table inside a cell; pretext-pdf does not.
    // The compat shim currently extracts text only — assert the outer table
    // structure still renders and the inner table is not silently lost as
    // an unhandled type error.
    const result = fromPdfmake({
      content: [
        {
          table: {
            widths: ['*', '*'],
            body: [
              ['Outer A', 'Outer B'],
              [
                'Outer C',
                {
                  table: {
                    widths: ['*'],
                    body: [['Inner cell']],
                  },
                } as any,
              ],
            ],
          },
        },
      ],
    })
    const el = result.content[0]
    assert.ok(el && el.type === 'table', 'outer element should be a table')
    if (el.type === 'table') {
      assert.strictEqual(el.rows.length, 2, 'outer table should have 2 rows')
      // The cell that contained a nested table renders as an empty string —
      // this is the current contract. If the shim ever supports nested
      // tables, update this expectation.
      const nestedCell = el.rows[1]?.cells[1]
      assert.ok(nestedCell, 'cell containing nested table must exist')
      assert.strictEqual(typeof nestedCell.text, 'string')
    }
  })

  test('style referenced by string name in defaultStyle is applied', () => {
    // defaultStyles lookup: the style name resolves via the styles map.
    const result = fromPdfmake({
      defaultStyle: { fontSize: 14, color: '#222222' },
      styles: { highlight: { color: '#0070f3', bold: true } },
      content: [
        { text: 'Highlighted line', style: 'highlight' },
      ],
    })
    const el = result.content[0]
    assert.ok(el, 'content[0] must exist')
    // Either paragraph or rich-paragraph is acceptable; both must carry the
    // resolved style.
    if (el.type === 'paragraph') {
      assert.strictEqual(el.color, '#0070f3')
      assert.strictEqual(el.fontWeight, 700)
    } else if (el.type === 'rich-paragraph') {
      assert.strictEqual(el.spans[0]?.color, '#0070f3')
      assert.strictEqual(el.spans[0]?.fontWeight, 700)
    } else {
      assert.fail(`unexpected element type for named style: ${el.type}`)
    }
  })

  test('multiple style names in array are merged left-to-right', () => {
    const result = fromPdfmake({
      styles: {
        big: { fontSize: 20 },
        red: { color: '#ff0000' },
      },
      content: [
        { text: 'Big and red', style: ['big', 'red'] },
      ],
    })
    const el = result.content[0]
    assert.ok(el, 'content[0] must exist')
    if (el.type === 'paragraph') {
      assert.strictEqual(el.fontSize, 20)
      assert.strictEqual(el.color, '#ff0000')
    } else if (el.type === 'rich-paragraph') {
      assert.strictEqual(el.spans[0]?.fontSize, 20)
      assert.strictEqual(el.spans[0]?.color, '#ff0000')
    } else {
      assert.fail(`unexpected element type: ${el.type}`)
    }
  })

  test('empty stack array produces no elements in the output content', () => {
    const result = fromPdfmake({
      content: [{ stack: [] }],
    })
    assert.strictEqual(result.content.length, 0, 'empty stack should add zero elements')
  })

  test('empty columns array produces no elements and still warns once', () => {
    const warnings: string[] = []
    const result = fromPdfmake(
      { content: [{ columns: [] }] },
      { onUnsupported: (f) => warnings.push(f) },
    )
    assert.strictEqual(result.content.length, 0, 'empty columns should add zero elements')
    assert.ok(
      warnings.some((w) => w.includes('columns')),
      `empty columns should still emit a one-time warning, got: ${JSON.stringify(warnings)}`,
    )
  })

  test('columns with multiple nested nodes flattens all children into content', () => {
    const warnings: string[] = []
    const result = fromPdfmake(
      {
        content: [
          {
            columns: [
              { text: 'Left column' },
              { text: 'Middle column' },
              { text: 'Right column' },
            ],
          },
        ],
      },
      { onUnsupported: (f) => warnings.push(f) },
    )
    assert.strictEqual(result.content.length, 3, 'three column children should flatten to three elements')
    assert.ok(warnings.some((w) => w.includes('columns')))
  })
})

// ─── describe('unsupported nodes') ───────────────────────────────────────────

describe('unsupported nodes', () => {
  test('{ columns } flattens to stack with onUnsupported warning', () => {
    const warnings: string[] = []
    const result = fromPdfmake(
      {
        content: [
          { columns: ['Column A text', 'Column B text'] },
        ],
      },
      { onUnsupported: (f) => warnings.push(f) },
    )
    // Warning must fire at least once mentioning columns
    assert.ok(warnings.length >= 1, 'at least one unsupported warning should fire')
    assert.ok(
      warnings.some((w) => w.includes('columns')),
      `warning should mention "columns", got: ${JSON.stringify(warnings)}`,
    )
    // Children are flattened into the parent content array
    assert.strictEqual(result.content.length, 2, 'columns children should be flattened to 2 elements')
    assert.strictEqual(result.content[0]?.type, 'paragraph')
    assert.strictEqual(result.content[1]?.type, 'paragraph')
  })

  test('{ canvas } is silently dropped — content array is empty', () => {
    const warnings: string[] = []
    const result = fromPdfmake(
      {
        content: [
          { canvas: [{ type: 'rect', x: 0, y: 0, w: 100, h: 50 }] },
        ],
      },
      { onUnsupported: (f) => warnings.push(f) },
    )
    assert.strictEqual(result.content.length, 0, 'canvas node should be dropped from content')
    // onUnsupported should be called with a message mentioning canvas
    assert.ok(warnings.some((w) => w.includes('canvas')), 'should warn about canvas')
  })
})

// ─── describe('round-trip — pdfmake → pretext → render') ─────────────────────

describe('round-trip — pdfmake to pretext to render (M3)', () => {
  test('paragraph + list + table doc converts and renders without error', async () => {
    const pdfmakeDoc = {
      content: [
        'A plain string paragraph',
        { text: 'A styled paragraph', bold: true, fontSize: 14, color: '#112233' },
        { ul: ['List A', 'List B', 'List C'] },
        {
          table: {
            widths: ['*', '*'],
            headerRows: 1,
            body: [
              ['Header 1', 'Header 2'],
              ['Cell A', 'Cell B'],
              ['Cell C', 'Cell D'],
            ],
          },
        },
      ],
    }
    const pretextDoc = fromPdfmake(pdfmakeDoc)

    // Element count preservation: 1 string + 1 styled paragraph + 1 list + 1 table = 4
    assert.strictEqual(pretextDoc.content.length, 4, 'expected 4 top-level elements')
    assert.strictEqual(pretextDoc.content[0]?.type, 'paragraph')
    // Second element may be paragraph or rich-paragraph depending on inline detection
    assert.ok(['paragraph', 'rich-paragraph'].includes(pretextDoc.content[1]!.type))
    assert.strictEqual(pretextDoc.content[2]?.type, 'list')
    assert.strictEqual(pretextDoc.content[3]?.type, 'table')

    // Table structure preservation: 3 rows × 2 cells
    const table = pretextDoc.content[3]
    if (table?.type === 'table') {
      assert.strictEqual(table.rows.length, 3, 'expected 3 rows in table')
      assert.strictEqual(table.columns.length, 2, 'expected 2 columns in table')
      for (const row of table.rows) {
        assert.strictEqual(row.cells.length, 2, 'expected 2 cells per row')
      }
    }

    // Render the converted doc — no errors expected
    const bytes = await render(pretextDoc)
    assert.ok(bytes instanceof Uint8Array, 'render() should return Uint8Array')
    assert.ok(bytes.byteLength > 500, `PDF too small: ${bytes.byteLength} bytes`)
  })

  test('style properties (font, color, size) propagate from pdfmake style maps', () => {
    const pdfmakeDoc = {
      defaultStyle: { font: 'Inter', fontSize: 11, color: '#222222' },
      styles: {
        emphasis: { fontSize: 16, bold: true, color: '#ff0000' },
      },
      content: [
        { text: 'Emphasised text', style: 'emphasis' },
      ],
    }
    const pretextDoc = fromPdfmake(pdfmakeDoc)
    assert.strictEqual(pretextDoc.defaultFont, 'Inter')
    assert.strictEqual(pretextDoc.defaultFontSize, 11)

    const first = pretextDoc.content[0]!
    // The style produces either a paragraph or rich-paragraph depending on
    // how inline styling is materialised. Assert size + bold via either path.
    if (first.type === 'paragraph') {
      assert.strictEqual(first.fontSize, 16)
      assert.strictEqual(first.fontWeight, 700)
      assert.strictEqual(first.color, '#ff0000')
    } else if (first.type === 'rich-paragraph') {
      const span = first.spans[0]!
      assert.strictEqual(span.fontSize, 16)
      assert.strictEqual(span.fontWeight, 700)
      assert.strictEqual(span.color, '#ff0000')
    } else {
      assert.fail(`unexpected element type: ${first.type}`)
    }
  })

  test('pretext doc renders without errors as a sanity check', async () => {
    const pretextDoc: any = {
      content: [
        { type: 'heading', level: 1, text: 'Sanity Check' },
        { type: 'paragraph', text: 'A simple paragraph.' },
        {
          type: 'table',
          columns: [{ width: 100 }, { width: '*' }],
          rows: [
            { cells: [{ text: 'k' }, { text: 'v' }] },
            { cells: [{ text: 'k2' }, { text: 'v2' }] },
          ],
        },
      ],
    }
    const bytes = await render(pretextDoc)
    assert.ok(bytes instanceof Uint8Array)
    assert.ok(bytes.byteLength > 500)
  })

  test('large table round-trips with all rows and cells preserved', () => {
    // 5 columns × 10 rows, headerRows=1
    const body: string[][] = []
    body.push(['c0', 'c1', 'c2', 'c3', 'c4'])
    for (let r = 0; r < 9; r++) {
      body.push([`r${r}c0`, `r${r}c1`, `r${r}c2`, `r${r}c3`, `r${r}c4`])
    }
    const pdfmakeDoc = {
      content: [{ table: { widths: ['*', '*', '*', '*', '*'], headerRows: 1, body } }],
    }
    const result = fromPdfmake(pdfmakeDoc)
    assert.strictEqual(result.content.length, 1)
    const table = result.content[0]!
    assert.strictEqual(table.type, 'table')
    if (table.type === 'table') {
      assert.strictEqual(table.rows.length, 10, 'expected 10 rows')
      assert.strictEqual(table.columns.length, 5, 'expected 5 columns')
      for (const row of table.rows) {
        assert.strictEqual(row.cells.length, 5)
      }
    }
  })
})
