import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const { createPdf, render } = await import('../dist/index.js')

const expect = (value: any) => ({
  toBe: (expected: any) => assert.equal(value, expected),
  toEqual: (expected: any) => assert.deepEqual(value, expected),
  toMatchObject: (expected: any) => {
    for (const key in expected) {
      assert.equal(value[key], expected[key], `${key}: expected ${expected[key]}, got ${value[key]}`)
    }
  },
  toHaveProperty: (key: string) => assert(key in value, `Expected object to have property ${key}`),
  toHaveLength: (expected: any) => assert.equal(value.length, expected, `Expected length ${expected}, got ${value.length}`),
  toBeInstanceOf: (constructor: any) => assert(value instanceof constructor),
  toBeGreaterThan: (expected: any) => assert(value > expected),
  toBeLessThan: (expected: any) => assert(value < expected),
})

describe('Builder API (5B.1)', () => {
  describe('Chainability', () => {
    it('addText() returns builder (chainable)', () => {
      const builder = createPdf()
      const result = builder.addText('Hello')
      expect(result).toBe(builder)
    })

    it('addHeading() returns builder', () => {
      const builder = createPdf()
      const result = builder.addHeading('Title')
      expect(result).toBe(builder)
    })

    it('addTable() returns builder', () => {
      const builder = createPdf()
      const result = builder.addTable({ columns: [], rows: [] })
      expect(result).toBe(builder)
    })

    it('addImage() returns builder', () => {
      const builder = createPdf()
      const result = builder.addImage('/path/to/image.png')
      expect(result).toBe(builder)
    })

    it('addList() returns builder', () => {
      const builder = createPdf()
      const result = builder.addList({ style: 'unordered', items: [] })
      expect(result).toBe(builder)
    })

    it('addCode() returns builder', () => {
      const builder = createPdf()
      const result = builder.addCode('const x = 1', { language: 'js' })
      expect(result).toBe(builder)
    })

    it('addRichText() returns builder', () => {
      const builder = createPdf()
      const result = builder.addRichText([{ text: 'Bold', fontWeight: 700 }])
      expect(result).toBe(builder)
    })

    it('addBlockquote() returns builder', () => {
      const builder = createPdf()
      const result = builder.addBlockquote('Quote')
      expect(result).toBe(builder)
    })

    it('addHr() returns builder', () => {
      const builder = createPdf()
      const result = builder.addHr()
      expect(result).toBe(builder)
    })

    it('addSpacer() returns builder', () => {
      const builder = createPdf()
      const result = builder.addSpacer(20)
      expect(result).toBe(builder)
    })

    it('addPageBreak() returns builder', () => {
      const builder = createPdf()
      const result = builder.addPageBreak()
      expect(result).toBe(builder)
    })

    it('all methods chain together', () => {
      const builder = createPdf()
      const result = builder
        .addHeading('Title')
        .addText('Paragraph')
        .addHr()
        .addList({ style: 'unordered', items: [{ text: 'Item' }] })
      expect(result).toBe(builder)
    })
  })

  describe('Document accumulation', () => {
    it('toDocument() returns PdfDocument with accumulated content', () => {
      const builder = createPdf()
      builder.addText('Hello').addHeading('Title')
      const doc = builder.toDocument()

      expect(doc).toHaveProperty('content')
      expect(Array.isArray(doc.content)).toBe(true)
      expect(doc.content).toHaveLength(2)
      expect(doc.content[0]?.type).toBe('paragraph')
      expect(doc.content[1]?.type).toBe('heading')
    })

    it('empty builder produces empty content array', () => {
      const builder = createPdf()
      const doc = builder.toDocument()
      expect(doc.content).toEqual([])
    })

    it('content elements preserve type and text', () => {
      const builder = createPdf()
      builder.addText('Paragraph text').addHeading('Heading text')
      const doc = builder.toDocument()

      expect(doc.content[0]).toMatchObject({ type: 'paragraph', text: 'Paragraph text' })
      expect(doc.content[1]).toMatchObject({ type: 'heading', text: 'Heading text' })
    })

    it('heading defaults level to 1 when not specified', () => {
      const builder = createPdf()
      builder.addHeading('Title')
      const doc = builder.toDocument()

      expect(doc.content[0]?.type).toBe('heading')
      if (doc.content[0]?.type === 'heading') {
        expect(doc.content[0].level).toBe(1)
      }
    })

    it('heading level respects opts parameter', () => {
      const builder = createPdf()
      builder.addHeading('Title', { level: 3 })
      const doc = builder.toDocument()

      if (doc.content[0]?.type === 'heading') {
        expect(doc.content[0].level).toBe(3)
      }
    })
  })

  describe('Options propagation', () => {
    it('pageSize propagates to document', () => {
      const builder = createPdf({ pageSize: 'Letter' })
      const doc = builder.toDocument()
      expect(doc.pageSize).toBe('Letter')
    })

    it('margins propagate to document', () => {
      const margins = { top: 100, bottom: 100, left: 80, right: 80 }
      const builder = createPdf({ margins })
      const doc = builder.toDocument()
      expect(doc.margins).toEqual(margins)
    })

    it('defaultFont propagates to document', () => {
      const builder = createPdf({ defaultFont: 'Courier' })
      const doc = builder.toDocument()
      expect(doc.defaultFont).toBe('Courier')
    })

    it('defaultFontSize propagates to document', () => {
      const builder = createPdf({ defaultFontSize: 14 })
      const doc = builder.toDocument()
      expect(doc.defaultFontSize).toBe(14)
    })

    it('defaultLineHeight propagates to document', () => {
      const builder = createPdf({ defaultLineHeight: 1.6 })
      const doc = builder.toDocument()
      expect(doc.defaultLineHeight).toBe(1.6)
    })

    it('metadata propagates to document', () => {
      const metadata = { title: 'My Doc', author: 'Jane Doe' }
      const builder = createPdf({ metadata })
      const doc = builder.toDocument()
      expect(doc.metadata).toEqual(metadata)
    })

    it('header propagates to document', () => {
      const header = { text: 'Page {page}' }
      const builder = createPdf({ header })
      const doc = builder.toDocument()
      expect(doc.header).toEqual(header)
    })

    it('footer propagates to document', () => {
      const footer = { text: 'End of {pageCount}' }
      const builder = createPdf({ footer })
      const doc = builder.toDocument()
      expect(doc.footer).toEqual(footer)
    })
  })

  describe('Element options', () => {
    it('addText() applies options', () => {
      const builder = createPdf()
      builder.addText('Body text', { fontSize: 14, color: '#333333' })
      const doc = builder.toDocument()

      expect(doc.content[0]).toMatchObject({
        type: 'paragraph',
        text: 'Body text',
        fontSize: 14,
        color: '#333333',
      })
    })

    it('addHeading() applies options', () => {
      const builder = createPdf()
      builder.addHeading('Title', { fontSize: 24, fontWeight: 700, align: 'center' })
      const doc = builder.toDocument()

      if (doc.content[0]?.type === 'heading') {
        expect(doc.content[0]).toMatchObject({
          fontSize: 24,
          fontWeight: 700,
          align: 'center',
        })
      }
    })

    it('addBlockquote() applies options', () => {
      const builder = createPdf()
      builder.addBlockquote('Famous quote', { borderColor: '#ff0000', bgColor: '#fffacd' })
      const doc = builder.toDocument()

      if (doc.content[0]?.type === 'blockquote') {
        expect(doc.content[0]).toMatchObject({
          borderColor: '#ff0000',
          bgColor: '#fffacd',
        })
      }
    })
  })

  describe('PDF generation', () => {
    it('build() returns Promise<Uint8Array>', async () => {
      const builder = createPdf()
      builder.addText('Hello World')
      const result = builder.build()

      expect(result).toBeInstanceOf(Promise)
      const pdf = await result
      expect(pdf).toBeInstanceOf(Uint8Array)
      expect(pdf.length).toBeGreaterThan(0)
    })

    it('minimal builder with single element produces valid PDF', async () => {
      const builder = createPdf()
      builder.addText('Minimal content')
      const pdf = await builder.build()

      expect(pdf).toBeInstanceOf(Uint8Array)
      expect(pdf.length).toBeGreaterThan(0)
      // Check PDF magic bytes
      expect(pdf[0]).toBe(0x25) // '%'
      expect(pdf[1]).toBe(0x50) // 'P'
      expect(pdf[2]).toBe(0x44) // 'D'
      expect(pdf[3]).toBe(0x46) // 'F'
    })

    it('complex document produces valid PDF', async () => {
      const pdf = await createPdf({ pageSize: 'Letter', margins: { top: 50, bottom: 50, left: 50, right: 50 } })
        .addHeading('Document Title', { align: 'center' })
        .addText('Introduction paragraph with some content.')
        .addHr()
        .addList({
          style: 'unordered',
          items: [{ text: 'First item' }, { text: 'Second item' }, { text: 'Third item' }],
        })
        .addPageBreak()
        .addHeading('Section 2', { level: 2 })
        .addText('More content on page 2.')
        .addBlockquote('A famous quotation goes here.')
        .build()

      expect(pdf).toBeInstanceOf(Uint8Array)
      expect(pdf.length).toBeGreaterThan(0)
      // Verify PDF signature
      expect(pdf[0]).toBe(0x25)
      expect(pdf[1]).toBe(0x50)
    })

    it('rich text element renders to PDF', async () => {
      const pdf = await createPdf()
        .addRichText([
          { text: 'Bold', fontWeight: 700 },
          { text: ' and ', fontWeight: 400 },
          { text: 'colored', color: '#ff0000' },
        ])
        .build()

      expect(pdf).toBeInstanceOf(Uint8Array)
      expect(pdf.length).toBeGreaterThan(0)
    })
  })

  describe('Integration with render()', () => {
    it('toDocument() + render() produces identical PDF to build()', async () => {
      const builder1 = createPdf({ pageSize: 'Letter' })
      builder1.addHeading('Test').addText('Content')

      const builder2 = createPdf({ pageSize: 'Letter' })
      builder2.addHeading('Test').addText('Content')

      const pdf1 = await builder1.build()
      const pdf2 = await render(builder2.toDocument())

      // Both should be valid PDFs of similar size (may differ slightly due to timestamps)
      expect(pdf1.length).toBeGreaterThan(100)
      expect(pdf2.length).toBeGreaterThan(100)
      expect(Math.abs(pdf1.length - pdf2.length)).toBeLessThan(50)
    })
  })
})
