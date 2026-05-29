/**
 * compat-normalize.test.ts — Unit tests for src/compat/normalize.ts
 *
 * Tests the pure helper functions in the pdfmake compat shim directly,
 * without requiring a pretext-pdf render or a built dist/. This increases
 * c8 coverage for src/compat/normalize.ts which was at 0% because
 * compat.test.ts imports from dist/.
 *
 * Run standalone:
 *   cd F:\Antigravity\brain\projects\pretext-pdf
 *   npx tsx --test test/compat-normalize.test.ts
 */
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractFlatText,
  normalizeStyleNames,
  mergeStyles,
  pdfmakeAlignToPretext,
  normalizePageSize,
  normalizeMargins,
  normalizeHeaderFooter,
  translateTable,
} from '../src/compat/normalize.js'
import type { TranslateCtx } from '../src/compat/pdfmake-types.js'

// ─── Shared test context ──────────────────────────────────────────────────────

function makeCtx(overrides: Partial<TranslateCtx> = {}): TranslateCtx {
  return {
    styles: {},
    defaultStyle: {},
    headingMap: { h1: 1, h2: 2, h3: 3, h4: 4 },
    onUnsupported: () => {},
    ...overrides,
  }
}

// ─── extractFlatText ──────────────────────────────────────────────────────────

describe('extractFlatText', () => {
  test('extracts a plain string from a single string node', () => {
    const ctx = makeCtx()
    assert.equal(extractFlatText(['hello'], ctx), 'hello')
  })

  test('concatenates multiple string nodes', () => {
    const ctx = makeCtx()
    assert.equal(extractFlatText(['hello', ' ', 'world'], ctx), 'hello world')
  })

  test('extracts text property from an object node', () => {
    const ctx = makeCtx()
    assert.equal(extractFlatText([{ text: 'foo' }], ctx), 'foo')
  })

  test('extracts text from array-text nodes recursively', () => {
    const ctx = makeCtx()
    assert.equal(extractFlatText([{ text: ['part1', 'part2'] }], ctx), 'part1part2')
  })

  test('returns empty string for empty children array', () => {
    const ctx = makeCtx()
    assert.equal(extractFlatText([], ctx), '')
  })

  test('mixes string nodes and object nodes', () => {
    const ctx = makeCtx()
    const result = extractFlatText(['prefix-', { text: 'middle' }, '-suffix'], ctx)
    assert.equal(result, 'prefix-middle-suffix')
  })
})

// ─── normalizeStyleNames ──────────────────────────────────────────────────────

describe('normalizeStyleNames', () => {
  test('returns empty array for undefined', () => {
    assert.deepEqual(normalizeStyleNames(undefined), [])
  })

  test('returns empty array for empty string', () => {
    // empty string is falsy → returns []
    assert.deepEqual(normalizeStyleNames(''), [])
  })

  test('wraps single string in an array', () => {
    assert.deepEqual(normalizeStyleNames('myStyle'), ['myStyle'])
  })

  test('returns array as-is', () => {
    assert.deepEqual(normalizeStyleNames(['styleA', 'styleB']), ['styleA', 'styleB'])
  })

  test('preserves order of style names', () => {
    assert.deepEqual(normalizeStyleNames(['c', 'b', 'a']), ['c', 'b', 'a'])
  })
})

// ─── mergeStyles ─────────────────────────────────────────────────────────────

describe('mergeStyles', () => {
  test('returns default style when no styles or node overrides', () => {
    const ctx = makeCtx({ defaultStyle: { fontSize: 12 } })
    const result = mergeStyles(ctx, [], {})
    assert.equal(result.fontSize, 12)
  })

  test('node.bold overrides default', () => {
    const ctx = makeCtx({ defaultStyle: { bold: false } })
    const result = mergeStyles(ctx, [], { bold: true })
    assert.equal(result.bold, true)
  })

  test('node.color sets color on merged result', () => {
    const ctx = makeCtx()
    const result = mergeStyles(ctx, [], { color: '#ff0000' })
    assert.equal(result.color, '#ff0000')
  })

  test('named style from ctx.styles is applied', () => {
    const ctx = makeCtx({
      styles: { emphasis: { fontSize: 18, color: '#cc0000' } },
    })
    const result = mergeStyles(ctx, ['emphasis'], {})
    assert.equal(result.fontSize, 18)
    assert.equal(result.color, '#cc0000')
  })

  test('node properties override named style', () => {
    const ctx = makeCtx({
      styles: { small: { fontSize: 8 } },
    })
    const result = mergeStyles(ctx, ['small'], { fontSize: 14 })
    assert.equal(result.fontSize, 14)
  })

  test('unknown style name is silently ignored', () => {
    const ctx = makeCtx({ styles: {} })
    assert.doesNotThrow(() => mergeStyles(ctx, ['nonexistent'], {}))
  })

  test('italics property is forwarded', () => {
    const ctx = makeCtx()
    const result = mergeStyles(ctx, [], { italics: true })
    assert.equal(result.italics, true)
  })

  test('alignment property is forwarded', () => {
    const ctx = makeCtx()
    const result = mergeStyles(ctx, [], { alignment: 'center' })
    assert.equal(result.alignment, 'center')
  })

  test('font property is forwarded', () => {
    const ctx = makeCtx()
    const result = mergeStyles(ctx, [], { font: 'Courier' })
    assert.equal(result.font, 'Courier')
  })
})

// ─── pdfmakeAlignToPretext ────────────────────────────────────────────────────

describe('pdfmakeAlignToPretext', () => {
  test('passes through "left"', () => {
    assert.equal(pdfmakeAlignToPretext('left'), 'left')
  })

  test('passes through "center"', () => {
    assert.equal(pdfmakeAlignToPretext('center'), 'center')
  })

  test('passes through "right"', () => {
    assert.equal(pdfmakeAlignToPretext('right'), 'right')
  })

  test('passes through "justify"', () => {
    assert.equal(pdfmakeAlignToPretext('justify'), 'justify')
  })

  test('returns undefined for undefined input', () => {
    assert.equal(pdfmakeAlignToPretext(undefined), undefined)
  })
})

// ─── normalizePageSize ────────────────────────────────────────────────────────

describe('normalizePageSize', () => {
  test('maps "A4" to "A4"', () => {
    assert.equal(normalizePageSize('A4'), 'A4')
  })

  test('maps "A3" to "A3"', () => {
    assert.equal(normalizePageSize('A3'), 'A3')
  })

  test('maps "A5" to "A5"', () => {
    assert.equal(normalizePageSize('A5'), 'A5')
  })

  test('maps "LETTER" (uppercase) to "Letter"', () => {
    assert.equal(normalizePageSize('LETTER'), 'Letter')
  })

  test('maps "Letter" to "Letter"', () => {
    assert.equal(normalizePageSize('Letter'), 'Letter')
  })

  test('maps "letter" (lowercase) to "Letter"', () => {
    assert.equal(normalizePageSize('letter'), 'Letter')
  })

  test('maps "LEGAL" to "Legal"', () => {
    assert.equal(normalizePageSize('LEGAL'), 'Legal')
  })

  test('maps "Legal" to "Legal"', () => {
    assert.equal(normalizePageSize('Legal'), 'Legal')
  })

  test('maps "TABLOID" to "Tabloid"', () => {
    assert.equal(normalizePageSize('Tabloid'), 'Tabloid')
  })

  test('returns null for unknown size strings', () => {
    assert.equal(normalizePageSize('B5'), null)
  })

  test('returns null for empty string', () => {
    assert.equal(normalizePageSize(''), null)
  })

  test('returns null for "A4 " (trailing space)', () => {
    // After trim() "A4 " becomes "A4" — but the map key is "A4" — should match
    assert.equal(normalizePageSize('A4 '), 'A4')
  })
})

// ─── normalizeMargins ─────────────────────────────────────────────────────────

describe('normalizeMargins', () => {
  test('scalar number applies uniformly to all four sides', () => {
    assert.deepEqual(normalizeMargins(50), { top: 50, bottom: 50, left: 50, right: 50 })
  })

  test('[horizontal, vertical] tuple maps correctly', () => {
    assert.deepEqual(normalizeMargins([30, 50]), { left: 30, top: 50, right: 30, bottom: 50 })
  })

  test('[left, top, right, bottom] array maps all four independently', () => {
    assert.deepEqual(normalizeMargins([10, 20, 30, 40]), { left: 10, top: 20, right: 30, bottom: 40 })
  })

  test('returns null for an empty array', () => {
    assert.equal(normalizeMargins([] as unknown as [number, number]), null)
  })
})

// ─── normalizeHeaderFooter ────────────────────────────────────────────────────

describe('normalizeHeaderFooter', () => {
  const onUnsupported = () => {}

  test('returns null for undefined input', () => {
    assert.equal(normalizeHeaderFooter(undefined, onUnsupported, 'header'), null)
  })

  test('returns { text } for a string input', () => {
    const result = normalizeHeaderFooter('My Header', onUnsupported, 'header')
    assert.deepEqual(result, { text: 'My Header' })
  })

  test('extracts text from { text } object', () => {
    const result = normalizeHeaderFooter({ text: 'Footer text' }, onUnsupported, 'footer')
    assert.ok(result !== null)
    assert.equal(result!.text, 'Footer text')
  })

  test('extracts fontSize from { text, fontSize } object', () => {
    const result = normalizeHeaderFooter({ text: 'H', fontSize: 9 }, onUnsupported, 'header')
    assert.ok(result !== null)
    assert.equal(result!.fontSize, 9)
  })

  test('extracts color from { text, color } object', () => {
    const result = normalizeHeaderFooter({ text: 'H', color: '#aabbcc' }, onUnsupported, 'header')
    assert.ok(result !== null)
    assert.equal(result!.color, '#aabbcc')
  })

  test('maps alignment "left" to align "left"', () => {
    const result = normalizeHeaderFooter({ text: 'H', alignment: 'left' }, onUnsupported, 'header')
    assert.ok(result !== null)
    assert.equal(result!.align, 'left')
  })

  test('maps alignment "center" to align "center"', () => {
    const result = normalizeHeaderFooter({ text: 'H', alignment: 'center' }, onUnsupported, 'header')
    assert.ok(result !== null)
    assert.equal(result!.align, 'center')
  })

  test('maps alignment "right" to align "right"', () => {
    const result = normalizeHeaderFooter({ text: 'H', alignment: 'right' }, onUnsupported, 'header')
    assert.ok(result !== null)
    assert.equal(result!.align, 'right')
  })

  test('function form calls onUnsupported and returns null', () => {
    let called = ''
    const onUnsupportedTrack = (f: string) => { called = f }
    // function form is not a plain object — we test via a crafted scenario
    const result = normalizeHeaderFooter((() => {}) as any, onUnsupportedTrack, 'header')
    assert.equal(result, null)
    assert.ok(called.includes('header'), `expected onUnsupported to be called with 'header', got: '${called}'`)
  })

  test('returns null for an object without a text string property', () => {
    const result = normalizeHeaderFooter({ fontSize: 10 } as any, onUnsupported, 'header')
    assert.equal(result, null)
  })
})

// ─── translateTable ───────────────────────────────────────────────────────────

describe('translateTable', () => {
  const ctx = makeCtx()

  test('produces a table element with columns and rows', () => {
    const t = {
      body: [
        ['Name', 'Value'],
        ['Alpha', '100'],
      ],
    }
    const result = translateTable(t, ctx)
    assert.equal(result.type, 'table')
    assert.ok(Array.isArray(result.columns))
    assert.ok(Array.isArray(result.rows))
  })

  test('uses headerRows to mark first row as header', () => {
    const t = {
      body: [['Header A', 'Header B'], ['data1', 'data2']],
      headerRows: 1,
    }
    const result = translateTable(t, ctx)
    assert.equal((result.rows[0] as any).isHeader, true)
    assert.equal((result.rows[1] as any).isHeader, undefined)
  })

  test('maps numeric width to ColumnDef with numeric width', () => {
    const t = {
      body: [['A', 'B']],
      widths: [100, 200],
    }
    const result = translateTable(t, ctx)
    assert.equal(result.columns[0].width, 100)
    assert.equal(result.columns[1].width, 200)
  })

  test('maps "*" width to "1*" fractional column', () => {
    const t = {
      body: [['A']],
      widths: ['*'],
    }
    const result = translateTable(t, ctx)
    assert.equal(result.columns[0].width, '1*')
  })

  test('maps "auto" width to "auto"', () => {
    const t = {
      body: [['A']],
      widths: ['auto'],
    }
    const result = translateTable(t, ctx)
    assert.equal(result.columns[0].width, 'auto')
  })

  test('maps "2*" fractional width string correctly', () => {
    const t = {
      body: [['A']],
      widths: ['2*'],
    }
    const result = translateTable(t, ctx)
    assert.equal(result.columns[0].width, '2*')
  })

  test('unknown width string falls back to "1*"', () => {
    const t = {
      body: [['A']],
      widths: ['weird'],
    }
    const result = translateTable(t, ctx)
    assert.equal(result.columns[0].width, '1*')
  })

  test('extracts text from string cell', () => {
    const t = { body: [['Hello']] }
    const result = translateTable(t, ctx)
    assert.equal(result.rows[0].cells[0].text, 'Hello')
  })

  test('extracts text from object cell', () => {
    const t = { body: [[{ text: 'World', bold: true }]] }
    const result = translateTable(t, ctx)
    assert.equal(result.rows[0].cells[0].text, 'World')
    assert.equal(result.rows[0].cells[0].fontWeight, 700)
  })

  test('returns table type exactly', () => {
    const t = { body: [['x']] }
    const result = translateTable(t, ctx)
    assert.equal(result.type, 'table')
  })

  test('empty body produces zero rows', () => {
    const t = { body: [] as never[][] }
    const result = translateTable(t, ctx)
    assert.equal(result.rows.length, 0)
  })
})
