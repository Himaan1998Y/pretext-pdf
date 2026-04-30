import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { prepareLayoutState, summarizeLayoutState } from '../src/layout-state.js'

function makeTableDoc() {
  return {
    content: [
      { type: 'heading', level: 1 as const, text: 'Table determinism' },
      {
        type: 'table' as const,
        columns: [
          { width: 120, align: 'left' as const },
          { width: '*' as const, align: 'center' as const },
          { width: 140, align: 'right' as const },
        ],
        rows: [
          {
            isHeader: true,
            cells: [
              { text: 'SKU' },
              { text: 'Description' },
              { text: 'Amount' },
            ],
          },
          ...Array.from({ length: 36 }, (_, index) => ({
            cells: [
              { text: `ID-${String(index + 1).padStart(2, '0')}` },
              {
                text: index % 3 === 0
                  ? 'Wide content that should wrap consistently across repeated renders.'
                  : index % 3 === 1
                    ? 'Centered row text with mixed width behavior.'
                    : 'Right aligned summary value',
              },
              { text: `$${(index + 1) * 17}` },
            ],
          })),
        ],
      },
    ],
  }
}

describe('table determinism', () => {
  test('same table input produces identical layout traces across runs', async () => {
    const doc = makeTableDoc()

    const first = summarizeLayoutState(await prepareLayoutState(doc as any))
    const second = summarizeLayoutState(await prepareLayoutState(doc as any))

    assert.deepStrictEqual(second, first, 'table pagination should be deterministic for the same input')
    assert.ok(first.pages.length > 1, 'table fixture should actually paginate to exercise continuation logic')
    assert.ok(first.pages.some(page => page.blocks.some(block => block.type === 'table')))
  })
})
