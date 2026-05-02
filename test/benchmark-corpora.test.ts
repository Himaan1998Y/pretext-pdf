import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getBenchmarkCorpora } from '../src/benchmarks/corpora.js'

describe('benchmark corpora manifest', () => {
  it('exposes the core corpus set with stable ids and categories', () => {
    const corpora = getBenchmarkCorpora()

    assert.equal(corpora.length >= 6, true)

    const ids = corpora.map(corpus => corpus.id)
    const uniqueIds = new Set(ids)
    assert.equal(uniqueIds.size, ids.length, 'benchmark corpus ids must be unique')

    assert.deepEqual(
      ids,
      [
        'rich-text-mixed-spans',
        'table-stress',
        'cjk-layout',
        'rtl-layout',
        'punctuation-heavy',
        'invoice-showcase',
        'report-showcase',
      ],
      'core benchmark corpus ids should stay stable'
    )

    for (const corpus of corpora) {
      assert.ok(corpus.category.length > 0, `${corpus.id} should have a category`)
      assert.ok(corpus.title.length > 0, `${corpus.id} should have a title`)
      assert.ok(corpus.description.length > 0, `${corpus.id} should have a description`)
      assert.equal(typeof corpus.document, 'function', `${corpus.id} should expose a document builder`)
    }
  })
})
