/**
 * Unit tests for src/fonts/collect-text.ts — collectTextByFont.
 *
 * Run standalone:
 *   cd F:\Antigravity\brain\projects\pretext-pdf
 *   npx tsx --test test/fonts/collect-text.test.ts
 */
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { collectTextByFont } from '../../src/fonts/collect-text.js'
import type { PdfDocument } from '../../src/types.js'

// Font key format is: family-weight-style (e.g. 'Inter-400-normal')
const KEY_INTER_400 = 'Inter-400-normal'
const KEY_INTER_700 = 'Inter-700-normal'

describe('collectTextByFont — paragraph', () => {
  test('paragraph text is keyed by Inter 400 normal by default', () => {
    const doc: PdfDocument = {
      content: [{ type: 'paragraph', text: 'Hello World' }],
    }
    const map = collectTextByFont(doc)
    assert.ok(map.has(KEY_INTER_400), `expected key ${KEY_INTER_400}`)
    assert.ok(map.get(KEY_INTER_400)!.includes('Hello World'))
  })

  test('paragraph with explicit fontFamily uses that family key', () => {
    const doc: PdfDocument = {
      content: [{ type: 'paragraph', text: 'Custom font', fontFamily: 'Roboto', fontWeight: 400 }],
    }
    const map = collectTextByFont(doc)
    assert.ok(map.has('Roboto-400-normal'), 'expected Roboto-400-normal key')
  })

  test('paragraph with fontWeight 700 is keyed as 700', () => {
    const doc: PdfDocument = {
      content: [{ type: 'paragraph', text: 'Bold', fontWeight: 700 }],
    }
    const map = collectTextByFont(doc)
    assert.ok(map.has(KEY_INTER_700))
    assert.ok(map.get(KEY_INTER_700)!.includes('Bold'))
  })
})

describe('collectTextByFont — heading', () => {
  test('heading uses weight 700 by default', () => {
    const doc: PdfDocument = {
      content: [{ type: 'heading', level: 1, text: 'A Title' }],
    }
    const map = collectTextByFont(doc)
    assert.ok(map.has(KEY_INTER_700), `expected ${KEY_INTER_700}`)
    assert.ok(map.get(KEY_INTER_700)!.includes('A Title'))
  })
})

describe('collectTextByFont — rich-paragraph', () => {
  test('spans bucketed by their font weight', () => {
    const doc: PdfDocument = {
      content: [{
        type: 'rich-paragraph',
        spans: [
          { text: 'bold text', fontWeight: 700 },
          { text: 'normal text', fontWeight: 400 },
        ],
      }],
    }
    const map = collectTextByFont(doc)
    assert.ok(map.has(KEY_INTER_700), 'expected bold key')
    assert.ok(map.get(KEY_INTER_700)!.includes('bold text'))
    assert.ok(map.has(KEY_INTER_400), 'expected normal key')
    assert.ok(map.get(KEY_INTER_400)!.includes('normal text'))
  })
})

describe('collectTextByFont — header/footer', () => {
  test('header text is included in the font map', () => {
    const doc: PdfDocument = {
      content: [],
      header: { text: 'Page Header' },
    }
    const map = collectTextByFont(doc)
    assert.ok(map.has(KEY_INTER_400), 'expected header key')
    assert.ok(map.get(KEY_INTER_400)!.includes('Page Header'))
  })

  test('footer text is included in the font map', () => {
    const doc: PdfDocument = {
      content: [],
      footer: { text: 'Footer text' },
    }
    const map = collectTextByFont(doc)
    assert.ok(map.has(KEY_INTER_400))
    assert.ok(map.get(KEY_INTER_400)!.includes('Footer text'))
  })
})

describe('collectTextByFont — doc.defaultFont override', () => {
  test('defaultFont changes the key family for paragraphs', () => {
    const doc: PdfDocument = {
      defaultFont: 'Merriweather',
      content: [{ type: 'paragraph', text: 'Serif text' }],
    }
    const map = collectTextByFont(doc)
    assert.ok(map.has('Merriweather-400-normal'), 'expected Merriweather-400-normal key')
    assert.ok(map.get('Merriweather-400-normal')!.includes('Serif text'))
    assert.ok(!map.has(KEY_INTER_400), 'Inter key should not be present when defaultFont is overridden')
  })
})

describe('collectTextByFont — empty doc', () => {
  test('doc with no content produces an empty or digits-only map', () => {
    const doc: PdfDocument = { content: [] }
    const map = collectTextByFont(doc)
    // May have an entry for digit characters used in page numbers, but no 'Hello' text
    for (const [, val] of map) {
      assert.ok(!val.includes('Hello'), 'empty doc should not have any text')
    }
  })
})
