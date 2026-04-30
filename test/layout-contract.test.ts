import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { prepareLayoutState, summarizeLayoutState } from '../src/layout-state.js'
import { renderDocument } from '../src/render.js'

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested)
    }
  }
  return value
}

describe('layout contract', () => {
  test('summarizes measure and paginate stages as serializable debug output', async () => {
    const state = await prepareLayoutState({
      content: [
        { type: 'heading', level: 1 as const, text: 'Layout contract' },
        {
          type: 'rich-paragraph',
          spans: [
            { text: 'Mixed ' },
            { text: 'layout', fontWeight: 700 as const },
            { text: ' tracing keeps the pipeline inspectable.' },
          ],
        },
        {
          type: 'table',
          columns: [{ width: 160 }, { width: 160 }],
          rows: [
            { cells: [{ text: 'Left' }, { text: 'Right' }], isHeader: true },
            { cells: [{ text: 'Alpha' }, { text: 'Beta' }] },
          ],
        },
      ],
    })

    const trace = summarizeLayoutState(state)

    assert.equal(trace.document.contentCount, 3)
    assert.equal(trace.measuredBlocks.length, 3)
    assert.ok(trace.pages.length >= 1)
    assert.ok(trace.measuredBlocks.every(block => typeof block.height === 'number'))
    assert.ok(trace.pages.every(page => typeof page.blockCount === 'number'))
    assert.doesNotThrow(() => JSON.stringify(trace), 'layout traces should be JSON serializable')
  })

  test('renderDocument does not mutate frozen paginated layout state', async () => {
    const state = await prepareLayoutState({
      content: [
        { type: 'heading', level: 1 as const, text: 'Frozen layout' },
        { type: 'paragraph', text: 'Rendering should consume finalized layout data only.' },
      ],
    })

    deepFreeze(state.paginatedDoc)
    deepFreeze(state.paginatedDoc.pages)
    for (const page of state.paginatedDoc.pages) {
      deepFreeze(page.blocks)
    }

    await renderDocument(
      state.paginatedDoc,
      state.doc,
      state.fontMap,
      state.imageMap,
      state.pdfDoc,
      state.pageGeometry
    )

    const trace = summarizeLayoutState(state)
    assert.equal(trace.pages.length, 1)
  })
})
