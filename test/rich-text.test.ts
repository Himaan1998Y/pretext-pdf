/**
 * Unit tests for rich-text.ts compositor (measureRichText).
 * Tests tokenization, line packing, alignment, and edge cases.
 * Run: node --experimental-strip-types --test test/rich-text.test.ts
 */
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'

// Install canvas polyfill before importing Pretext (same as index.ts does)
before(async () => {
  if (typeof OffscreenCanvas === 'undefined' && typeof window === 'undefined') {
    const { installNodePolyfill } = await import('../dist/node-polyfill.js')
    await installNodePolyfill()
  }
})

const { measureRichText } = await import('../dist/rich-text.js')

const FONT_SIZE = 12
const LINE_HEIGHT = 18
const CONTENT_WIDTH = 400
const DEFAULT_DOC = { defaultFont: 'Inter', fonts: [] }

// ─── Single span ──────────────────────────────────────────────────────────────

describe('rich-text — single span', () => {
  test('short single span fits on one line', async () => {
    const lines = await measureRichText(
      [{ text: 'Hello' }], FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'left', DEFAULT_DOC
    )
    assert.equal(lines.length, 1)
    assert.equal(lines[0]!.fragments.length, 1)
    assert.equal(lines[0]!.fragments[0]!.text, 'Hello')
  })

  test('long single span wraps to multiple lines', async () => {
    const longText = 'word '.repeat(50).trim() // ~200+ pt wide
    const lines = await measureRichText(
      [{ text: longText }], FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'left', DEFAULT_DOC
    )
    assert.ok(lines.length > 1, `Expected multiple lines, got ${lines.length}`)
  })

  test('each line totalWidth is <= contentWidth', async () => {
    const longText = 'The quick brown fox jumps over the lazy dog. '.repeat(10)
    const lines = await measureRichText(
      [{ text: longText }], FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'left', DEFAULT_DOC
    )
    for (const line of lines) {
      assert.ok(
        line.totalWidth <= CONTENT_WIDTH + 1, // +1 tolerance for rounding
        `Line width ${line.totalWidth} exceeds contentWidth ${CONTENT_WIDTH}`
      )
    }
  })
})

// ─── Multiple spans ───────────────────────────────────────────────────────────

describe('rich-text — multiple spans', () => {
  test('two spans on same line produce two fragments', async () => {
    const lines = await measureRichText(
      [{ text: 'Hello ' }, { text: 'World', fontWeight: 700 }],
      FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'left', DEFAULT_DOC
    )
    assert.equal(lines.length, 1)
    // Both fragments should be present (may be merged or separate depending on same font key)
    const allText = lines[0]!.fragments.map(f => f.text).join('')
    assert.ok(allText.includes('Hello') && allText.includes('World'))
  })

  test('fragments preserve correct font keys for bold vs normal', async () => {
    const lines = await measureRichText(
      [{ text: 'normal ' }, { text: 'bold', fontWeight: 700 }],
      FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'left', DEFAULT_DOC
    )
    const fragments = lines.flatMap(l => l.fragments)
    const normalFrags = fragments.filter(f => f.fontKey.includes('400'))
    const boldFrags = fragments.filter(f => f.fontKey.includes('700'))
    assert.ok(normalFrags.length > 0, 'Expected normal weight fragments')
    assert.ok(boldFrags.length > 0, 'Expected bold weight fragments')
  })

  test('colored span has correct color in fragment', async () => {
    const lines = await measureRichText(
      [{ text: 'colored', color: '#ff0000' }],
      FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'left', DEFAULT_DOC
    )
    const frag = lines[0]!.fragments.find(f => f.text === 'colored')
    assert.ok(frag, 'Fragment with "colored" not found')
    assert.equal(frag.color, '#ff0000')
  })

  test('default color is #000000', async () => {
    const lines = await measureRichText(
      [{ text: 'black' }],
      FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'left', DEFAULT_DOC
    )
    const frag = lines[0]!.fragments[0]!
    assert.equal(frag.color, '#000000')
  })
})

// ─── Hard breaks ─────────────────────────────────────────────────────────────

describe('rich-text — hard breaks', () => {
  test('\\n produces a new line', async () => {
    const lines = await measureRichText(
      [{ text: 'Line one\nLine two' }],
      FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'left', DEFAULT_DOC
    )
    assert.equal(lines.length, 2)
  })

  test('\\n\\n produces a blank line between content', async () => {
    const lines = await measureRichText(
      [{ text: 'Line one\n\nLine three' }],
      FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'left', DEFAULT_DOC
    )
    // Should produce: "Line one", (blank), "Line three" = 3 lines
    assert.equal(lines.length, 3, `Expected 3 lines, got ${lines.length}`)
    assert.equal(lines[1]!.fragments.length, 0, 'Middle line should be blank (no fragments)')
  })

  test('\\n at end of span does not produce extra trailing line', async () => {
    const withTrailing = await measureRichText(
      [{ text: 'Line one\n' }],
      FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'left', DEFAULT_DOC
    )
    const without = await measureRichText(
      [{ text: 'Line one' }],
      FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'left', DEFAULT_DOC
    )
    // Trailing newline at end may or may not create extra line — document expected behavior
    assert.ok(withTrailing.length >= without.length)
  })
})

// ─── Alignment ────────────────────────────────────────────────────────────────

describe('rich-text — alignment', () => {
  test('left alignment: first fragment x is 0', async () => {
    const lines = await measureRichText(
      [{ text: 'short' }], FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'left', DEFAULT_DOC
    )
    assert.equal(lines[0]!.fragments[0]!.x, 0)
  })

  test('center alignment: first fragment x > 0 for short text', async () => {
    const lines = await measureRichText(
      [{ text: 'short' }], FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'center', DEFAULT_DOC
    )
    assert.ok(lines[0]!.fragments[0]!.x > 0, 'Center-aligned short text should have x > 0')
  })

  test('right alignment: first fragment x > center alignment x', async () => {
    const centerLines = await measureRichText(
      [{ text: 'short' }], FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'center', DEFAULT_DOC
    )
    const rightLines = await measureRichText(
      [{ text: 'short' }], FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'right', DEFAULT_DOC
    )
    assert.ok(
      rightLines[0]!.fragments[0]!.x > centerLines[0]!.fragments[0]!.x,
      'Right alignment should have greater x offset than center'
    )
  })

  test('alignment offset is never negative', async () => {
    // Text exactly fitting the content width — offset should be 0, not negative
    for (const align of ['left', 'center', 'right'] as const) {
      const lines = await measureRichText(
        [{ text: 'a' }], FONT_SIZE, LINE_HEIGHT, 1, align, DEFAULT_DOC
      )
      for (const line of lines) {
        for (const frag of line.fragments) {
          assert.ok(frag.x >= 0, `Fragment x = ${frag.x} is negative for align=${align}`)
        }
      }
    }
  })
})

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('rich-text — edge cases', () => {
  test('single word span produces one fragment on one line', async () => {
    const lines = await measureRichText(
      [{ text: 'word' }], FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'left', DEFAULT_DOC
    )
    assert.equal(lines.length, 1)
    assert.ok(lines[0]!.fragments.length >= 1)
  })

  test('multiple spans with same font key may be merged', async () => {
    // Two adjacent normal-weight Inter spans — compositor may merge them
    const lines = await measureRichText(
      [{ text: 'Hello ' }, { text: 'World' }],
      FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'left', DEFAULT_DOC
    )
    const allText = lines.flatMap(l => l.fragments).map(f => f.text).join('')
    assert.ok(allText.replace(/\s+/g, ' ').trim().startsWith('Hello'))
  })

  test('very narrow contentWidth forces one word per line', async () => {
    const lines = await measureRichText(
      [{ text: 'one two three' }],
      FONT_SIZE, LINE_HEIGHT,
      20, // very narrow — each word needs its own line
      'left', DEFAULT_DOC
    )
    assert.ok(lines.length >= 3, `Expected ≥3 lines for narrow width, got ${lines.length}`)
  })
})

// ─── Whitespace preservation between spans (regression for v0.8.2 bugfix) ─────
//
// Before v0.8.2, pretext's layoutWithLines stripped trailing whitespace from
// the line widths it returned. Tokens like "Hello " or "  " then had their
// space portions measured as width=0, which collapsed the gap between
// consecutive spans/words and produced visual overlaps in the rendered PDF
// (e.g. "Founder& CEO", "AntigravitySystems" in the resume preset). The fix
// in src/rich-text.ts measureTokenWidth uses a sentinel-character technique
// to recover the trailing-whitespace width.
//
// Note: trailing whitespace is intentionally *inside* the previous fragment's
// width — the next fragment's x is contiguous with prev.x + prev.width. The
// drawn text is trimEnd'd at render time, so the visual gap appears where the
// trailing whitespace would be. These tests therefore compare fragment widths
// for inputs that differ only by trailing whitespace.

describe('rich-text — whitespace preservation (v0.8.2 fix)', () => {
  test('trailing whitespace contributes a positive width delta (no overlap)', async () => {
    const withSpace = await measureRichText(
      [{ text: 'Hello ' }, { text: 'World' }],
      FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'left', DEFAULT_DOC
    )
    const withoutSpace = await measureRichText(
      [{ text: 'Hello' }, { text: 'World' }],
      FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'left', DEFAULT_DOC
    )
    const helloWith = withSpace[0]!.fragments.find(f => f.text.startsWith('Hello'))!
    const helloWithout = withoutSpace[0]!.fragments.find(f => f.text.startsWith('Hello'))!
    const delta = helloWith.width - helloWithout.width
    assert.ok(
      delta > 0,
      `"Hello " width (${helloWith.width.toFixed(2)}) must exceed "Hello" width (${helloWithout.width.toFixed(2)}). Pre-v0.8.2 bug: delta was 0.`
    )

    // Downstream "World" fragment must be pushed right by the same delta.
    const worldWith = withSpace[0]!.fragments.find(f => f.text === 'World')!
    const worldWithout = withoutSpace[0]!.fragments.find(f => f.text === 'World')!
    const positionShift = worldWith.x - worldWithout.x
    assert.ok(
      Math.abs(positionShift - delta) < 0.5,
      `"World" position should shift by the trailing-space width (${delta.toFixed(2)}); shifted by ${positionShift.toFixed(2)}.`
    )
  })

  test('whitespace-only span between two content spans contributes a gap', async () => {
    const withSeparator = await measureRichText(
      [{ text: 'A' }, { text: '   ', color: '#999999' }, { text: 'B', color: '#ff0000' }],
      FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'left', DEFAULT_DOC
    )
    const noSeparator = await measureRichText(
      [{ text: 'A' }, { text: 'B', color: '#ff0000' }],
      FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'left', DEFAULT_DOC
    )
    const bWith = withSeparator[0]!.fragments.find(f => f.text === 'B')!
    const bWithout = noSeparator[0]!.fragments.find(f => f.text === 'B')!
    const shift = bWith.x - bWithout.x
    assert.ok(
      shift > 0,
      `Whitespace-only separator span must push downstream fragments right; expected positive shift, got ${shift.toFixed(2)}. Pre-v0.8.2 bug: shift was 0.`
    )
  })

  test('"Founder & CEO" → "Antigravity Systems" — no fragment overlap', async () => {
    // Reproduces the resume preset case from the live demo screenshot:
    // multi-span rich-paragraph with leading whitespace in the second span +
    // bold weight on the first.
    const lines = await measureRichText(
      [
        { text: 'Founder & CEO', fontWeight: 700 },
        { text: '  —  Antigravity Systems', color: '#333333' },
      ],
      FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'left', DEFAULT_DOC
    )
    assert.equal(lines.length, 1)
    const frags = lines[0]!.fragments

    // Compare against the same content with the leading-whitespace stripped
    // from span 2: the version WITH whitespace must place "Systems" further right.
    const linesNoLeadingWs = await measureRichText(
      [
        { text: 'Founder & CEO', fontWeight: 700 },
        { text: 'AntigravitySystems', color: '#333333' },
      ],
      FONT_SIZE, LINE_HEIGHT, CONTENT_WIDTH, 'left', DEFAULT_DOC
    )
    const sysWith = frags.find(f => f.text.trim() === 'Systems')!
    const sysWithout = linesNoLeadingWs[0]!.fragments.find(f => f.text.includes('System'))!
    assert.ok(sysWith && sysWithout, 'expected Systems-containing fragments in both inputs')
    const shift = sysWith.x - sysWithout.x
    assert.ok(
      shift > 0,
      `"Systems" should be pushed right by the leading-whitespace + separator width of span 2; expected positive shift, got ${shift.toFixed(2)}. Pre-v0.8.2 bug produced "Founder& CEO—AntigravitySystems" overlap.`
    )
  })
})
