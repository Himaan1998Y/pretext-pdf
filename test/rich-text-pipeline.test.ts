import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  tokenizeRichTextSpans,
  measureRichTextTokenWidths,
} from '../src/rich-text.js'

describe('rich-text pipeline', () => {
  test('tokenization preserves hard breaks and font metadata', () => {
    const tokens = tokenizeRichTextSpans([
      { text: 'Hello\nworld ' },
      { text: 'bold', fontWeight: 700 },
    ], 'Inter', 12)

    assert.equal(tokens.length >= 4, true)
    assert.equal(tokens.some(token => token.isHardBreak), true)
    assert.equal(tokens.some(token => token.text === 'bold' && token.fontWeight === 700), true)
    assert.equal(tokens.some(token => token.text === 'Hello'), true)
    assert.equal(tokens.some(token => token.text === 'world '), true)
  })

  test('duplicate token widths are measured once per font/text signature', async () => {
    const tokens = tokenizeRichTextSpans([
      { text: 'repeat repeat' },
      { text: 'repeat' },
      { text: 'unique', fontWeight: 700 },
    ], 'Inter', 12)

    let calls = 0
    const measured = await measureRichTextTokenWidths(tokens, async (token) => {
      calls++
      return token.text.length * 10
    })

    assert.equal(measured.every(token => typeof token.width === 'number'), true)
    assert.equal(calls, 3, 'expected width measurement to dedupe repeated token signatures')
  })
})
