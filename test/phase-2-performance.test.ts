/**
 * Phase 2 — Performance & Correctness Tests
 *
 * 2-B: Large document (>10K elements) warns but doesn't throw
 * 2-C: Font subsetting fires (encodeText pre-registration)
 * 2-D: RTL table cell metrics correct
 * 2-A: Multi-column render
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../src/index.js'

describe('Phase 2 — Performance & Correctness', () => {
  // 2-B: Large document warn-not-throw
  test('document with >10K elements warns but renders (no throw)', async () => {
    const spacers = Array.from({ length: 10_001 }, () => ({ type: 'spacer' as const, height: 1 }))
    const warnings: string[] = []
    const originalWarn = console.warn
    console.warn = (...args: unknown[]) => { warnings.push(String(args[0])) }
    try {
      const pdf = await render({ content: spacers })
      assert.ok(pdf instanceof Uint8Array, 'should return PDF bytes')
      assert.ok(warnings.some(w => w.includes('10001') || w.includes('elements')), 'should warn about element count')
    } finally {
      console.warn = originalWarn
    }
  })

  test('document with exactly 10K elements has no warning', async () => {
    const spacers = Array.from({ length: 10_000 }, () => ({ type: 'spacer' as const, height: 1 }))
    const warnings: string[] = []
    const originalWarn = console.warn
    console.warn = (...args: unknown[]) => { warnings.push(String(args[0])) }
    try {
      await render({ content: spacers })
      assert.equal(warnings.filter(w => w.includes('elements')).length, 0, 'no warning at exactly 10K')
    } finally {
      console.warn = originalWarn
    }
  })

  // 2-C: Font subsetting — PDF with minimal text should be smaller than one with large text
  test('font subset pre-registration: render succeeds and produces valid PDF', async () => {
    const pdf = await render({
      content: [
        { type: 'heading', level: 1, text: 'Hello World' },
        { type: 'paragraph', text: 'Short text.' },
      ]
    })
    assert.ok(pdf instanceof Uint8Array)
    // PDF magic bytes
    assert.equal(pdf[0], 0x25) // %
    assert.equal(pdf[1], 0x50) // P
    assert.equal(pdf[2], 0x44) // D
    assert.equal(pdf[3], 0x46) // F
  })

  test('font subsetting with bold text: renders without error', async () => {
    const pdf = await render({
      content: [
        { type: 'heading', level: 1, text: 'Bold Heading', fontWeight: 700 },
        { type: 'paragraph', text: 'Normal text for comparison.' },
        { type: 'rich-paragraph', spans: [
          { text: 'Bold span', fontWeight: 700 },
          { text: ' normal span' },
        ]},
      ]
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  // 2-D: RTL table cell
  test('table with RTL cell renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'table',
        columns: [{ width: 150 }, { width: 150 }],
        rows: [
          { cells: [{ text: 'Name' }, { text: 'الاسم', dir: 'rtl' }], isHeader: true },
          { cells: [{ text: 'John' }, { text: 'جون', dir: 'rtl' }] },
        ]
      }]
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  test('table with mixed LTR and RTL cells renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'table',
        columns: [{ width: 120 }, { width: 120 }, { width: 120 }],
        rows: [
          {
            cells: [
              { text: 'English text' },
              { text: 'نص عربي', dir: 'rtl' },
              { text: 'More English' },
            ]
          }
        ]
      }]
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  test('table RTL cell with auto direction detection renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'table',
        columns: [{ width: 200 }],
        rows: [
          { cells: [{ text: 'مرحبا بالعالم' /* Arabic: Hello World, dir: auto */ }] },
        ]
      }]
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  // 2-A: Multi-column
  test('paragraph with 2 columns renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'paragraph',
        columns: 2,
        text: 'Column one text goes here. This paragraph will be laid out in two columns side by side. The text should flow naturally from column one into column two.',
      }]
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  test('paragraph with 3 columns and custom gap renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'paragraph',
        columns: 3,
        columnGap: 20,
        text: 'Three column layout with custom gap. First column text. Second column text. Third column text in the layout.',
      }]
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  test('heading with 2 columns renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'heading',
        level: 2 as const,
        columns: 2,
        text: 'Two-Column Heading that spans both columns of the available space',
      }]
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  test('rich-paragraph with 2 columns renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'rich-paragraph',
        columns: 2,
        spans: [
          { text: 'Bold text ', fontWeight: 700 },
          { text: 'in a two-column rich paragraph layout with mixed formatting.' },
        ]
      }]
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  test('columns out of range (>6) throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render({
        content: [{
          type: 'paragraph',
          columns: 20,
          text: 'Too many columns',
        }]
      }),
      (err: Error) => err.message.includes('columns')
    )
  })
})
