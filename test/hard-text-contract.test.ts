import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { prepareLayoutState, summarizeLayoutState } from '../src/layout-state.js'

function makeHardTextDoc() {
  return {
    content: [
      { type: 'heading', level: 1 as const, text: 'Hard text contract' },
      { type: 'paragraph', text: '' },
      {
        type: 'paragraph',
        text: '中文排版需要稳定的换行和宽度测量。これは日本語の段落であり、文字の流れと改行の安定性を確認します。',
        lineHeight: 16,
      },
      {
        type: 'paragraph',
        text: 'هذا نص عربي لاختبار التدفق من اليمين إلى اليسار والتحقق من أن القياس لا يكسر الترتيب البصري.',
        dir: 'rtl' as const,
        align: 'right' as const,
        lineHeight: 16,
      },
      {
        type: 'paragraph',
        text: 'Quotes, commas, semicolons, parentheses (lots of them), em-dashes — and ellipses... should stay predictable.',
      },
      {
        type: 'paragraph',
        text: 'Repeated punctuation!!! Repeated punctuation!!! Repeated punctuation!!! should not cause unstable wrapping.',
      },
    ],
  }
}

describe('hard text contract', () => {
  test('empty strings, CJK, RTL, and punctuation-heavy text stay deterministic', async () => {
    const doc = makeHardTextDoc()

    const first = summarizeLayoutState(await prepareLayoutState(doc as any))
    const second = summarizeLayoutState(await prepareLayoutState(doc as any))

    assert.deepStrictEqual(second, first, 'hard-text layout should be deterministic for the same input')
    assert.ok(first.pages.length >= 1, 'fixture should produce at least one page')
    assert.ok(first.measuredBlocks.some(block => block.type === 'paragraph'))
    assert.ok(first.measuredBlocks.some(block => block.isRTL))
  })
})
