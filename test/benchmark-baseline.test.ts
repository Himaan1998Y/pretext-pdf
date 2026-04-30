import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getBenchmarkCorpora } from '../src/benchmarks/corpora.js'

describe('benchmark baseline snapshot', () => {
  it('tracks the current core corpus set', () => {
    const baselinePath = join(process.cwd(), 'benchmarks', 'benchmark-baseline.json')
    const raw = readFileSync(baselinePath, 'utf8')
    const baseline = JSON.parse(raw) as {
      version: number
      corpora: Array<{ id: string; category: string; title: string; stages: Record<string, number> }>
    }

    assert.equal(baseline.version, 1, 'benchmark baseline format should stay on version 1')

    const currentIds = getBenchmarkCorpora().map(corpus => corpus.id)
    const baselineIds = baseline.corpora.map(corpus => corpus.id)

    assert.deepEqual(baselineIds, currentIds, 'baseline corpus ids should match the live corpus manifest')

    for (const corpus of baseline.corpora) {
      assert.ok(corpus.category.length > 0, `${corpus.id} should have a category`)
      assert.ok(corpus.title.length > 0, `${corpus.id} should have a title`)
      assert.ok(typeof corpus.stages.setupMs === 'number', `${corpus.id} should include stage timings`)
      assert.ok(typeof corpus.stages.totalMs === 'number', `${corpus.id} should include total timing`)
    }
  })
})
