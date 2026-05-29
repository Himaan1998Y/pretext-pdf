/**
 * Unit tests for src/compat/normalize.ts.
 *
 * Run standalone:
 *   cd F:\Antigravity\brain\projects\pretext-pdf
 *   npx tsx --test test/compat/normalize.test.ts
 */
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mergeStyles,
  normalizePageSize,
  normalizeMargins,
  normalizeHeaderFooter,
  normalizeStyleNames,
} from '../../src/compat/normalize.js'
import type { TranslateCtx } from '../../src/compat/pdfmake-types.js'

const BASE_CTX: TranslateCtx = {
  styles: {},
  defaultStyle: {},
  headingMap: {},
  onUnsupported: () => {},
}

// ─── normalizeStyleNames ──────────────────────────────────────────────────────

describe('normalizeStyleNames', () => {
  test('undefined returns []', () => assert.deepStrictEqual(normalizeStyleNames(undefined), []))
  test('string returns single-element array', () => assert.deepStrictEqual(normalizeStyleNames('bold'), ['bold']))
  test('array is returned as-is', () => assert.deepStrictEqual(normalizeStyleNames(['a', 'b']), ['a', 'b']))
  test('empty string returns [] (falsy guard)', () => assert.deepStrictEqual(normalizeStyleNames(''), []))
})

// ─── mergeStyles ─────────────────────────────────────────────────────────────

describe('mergeStyles', () => {
  test('returns defaultStyle when no named styles or node overrides', () => {
    const ctx: TranslateCtx = { ...BASE_CTX, defaultStyle: { fontSize: 11 } }
    const result = mergeStyles(ctx, [], {})
    assert.strictEqual(result.fontSize, 11)
  })

  test('named styles applied left-to-right (later wins)', () => {
    const ctx: TranslateCtx = {
      ...BASE_CTX,
      styles: {
        big: { fontSize: 20 },
        red: { color: '#ff0000', fontSize: 18 },
      },
    }
    const result = mergeStyles(ctx, ['big', 'red'], {})
    assert.strictEqual(result.fontSize, 18, 'red should override big fontSize')
    assert.strictEqual(result.color, '#ff0000')
  })

  test('node-level bold overrides named style bold: false', () => {
    const ctx: TranslateCtx = {
      ...BASE_CTX,
      styles: { plain: { bold: false } },
    }
    const result = mergeStyles(ctx, ['plain'], { bold: true })
    assert.strictEqual(result.bold, true)
  })

  test('unknown style name is silently ignored', () => {
    const ctx: TranslateCtx = { ...BASE_CTX, styles: {} }
    const result = mergeStyles(ctx, ['nonexistent'], { fontSize: 14 })
    assert.strictEqual(result.fontSize, 14)
  })

  test('node color overrides named style color', () => {
    const ctx: TranslateCtx = {
      ...BASE_CTX,
      styles: { themed: { color: '#aaaaaa' } },
    }
    const result = mergeStyles(ctx, ['themed'], { color: '#000000' })
    assert.strictEqual(result.color, '#000000')
  })
})

// ─── normalizePageSize ────────────────────────────────────────────────────────

describe('normalizePageSize', () => {
  test('"A4" returns "A4"', () => assert.strictEqual(normalizePageSize('A4'), 'A4'))
  test('"A3" returns "A3"', () => assert.strictEqual(normalizePageSize('A3'), 'A3'))
  test('"LETTER" returns "Letter"', () => assert.strictEqual(normalizePageSize('LETTER'), 'Letter'))
  test('"Letter" returns "Letter"', () => assert.strictEqual(normalizePageSize('Letter'), 'Letter'))
  test('"letter" returns "Letter"', () => assert.strictEqual(normalizePageSize('letter'), 'Letter'))
  test('"LEGAL" returns "Legal"', () => assert.strictEqual(normalizePageSize('LEGAL'), 'Legal'))
  test('unknown string returns null', () => assert.strictEqual(normalizePageSize('FOLIO'), null))
  test('empty string returns null', () => assert.strictEqual(normalizePageSize(''), null))
})

// ─── normalizeMargins ─────────────────────────────────────────────────────────

describe('normalizeMargins', () => {
  test('scalar applies to all sides', () => {
    assert.deepStrictEqual(normalizeMargins(50), { top: 50, bottom: 50, left: 50, right: 50 })
  })

  test('2-tuple: [horizontal, vertical] — left/right = m[0], top/bottom = m[1]', () => {
    assert.deepStrictEqual(normalizeMargins([30, 40]), { left: 30, top: 40, right: 30, bottom: 40 })
  })

  test('4-tuple maps to left/top/right/bottom', () => {
    assert.deepStrictEqual(normalizeMargins([10, 20, 30, 40]), { left: 10, top: 20, right: 30, bottom: 40 })
  })

  test('empty array returns null', () => {
    assert.strictEqual(normalizeMargins([] as unknown as number), null)
  })
})

// ─── normalizeHeaderFooter ────────────────────────────────────────────────────

describe('normalizeHeaderFooter', () => {
  test('undefined returns null', () => {
    assert.strictEqual(normalizeHeaderFooter(undefined, () => {}, 'header'), null)
  })

  test('string form returns { text: string }', () => {
    const result = normalizeHeaderFooter('My header', () => {}, 'header')
    assert.deepStrictEqual(result, { text: 'My header' })
  })

  test('object form maps alignment to align field', () => {
    const result = normalizeHeaderFooter({ text: 'Title', alignment: 'right' }, () => {}, 'header')
    assert.ok(result !== null)
    assert.strictEqual(result!.align, 'right')
    assert.strictEqual(result!.text, 'Title')
  })

  test('object form with fontSize preserved', () => {
    const result = normalizeHeaderFooter({ text: 'T', fontSize: 9 }, () => {}, 'footer')
    assert.ok(result !== null)
    assert.strictEqual(result!.fontSize, 9)
  })

  test('object form with color preserved', () => {
    const result = normalizeHeaderFooter({ text: 'T', color: '#cccccc' }, () => {}, 'header')
    assert.ok(result !== null)
    assert.strictEqual(result!.color, '#cccccc')
  })

  test('function form calls onUnsupported and returns null', () => {
    const warnings: string[] = []
    const result = normalizeHeaderFooter((() => '') as unknown as string, (f) => warnings.push(f), 'footer')
    assert.strictEqual(result, null)
    assert.ok(warnings.length > 0, 'expected onUnsupported to be called')
    assert.ok(warnings[0]!.includes('footer'), `expected warning to mention 'footer', got: ${warnings[0]}`)
  })

  test('object without text field returns null', () => {
    const result = normalizeHeaderFooter({ alignment: 'left' } as unknown as string, () => {}, 'header')
    assert.strictEqual(result, null)
  })
})
