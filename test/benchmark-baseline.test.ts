import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { getBenchmarkCorpora } from '../src/benchmarks/corpora.js'
import { render } from '../src/index.js'

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

  it('per-corpus render times stay within 3x of baseline (regression guard)', async () => {
    const baselinePath = join(process.cwd(), 'benchmarks', 'benchmark-baseline.json')
    const raw = readFileSync(baselinePath, 'utf8')
    const baseline = JSON.parse(raw) as {
      version: number
      corpora: Array<{ id: string; stages: { totalMs: number } }>
    }
    const baselineMap = new Map(baseline.corpora.map(c => [c.id, c.stages.totalMs]))

    // 3x slack absorbs CI runner variance while still catching catastrophic regressions
    // (e.g. an O(n²) bug that would 10x render time). Tighten if/when CI is more deterministic.
    const SLACK = 3.0
    const FLOOR_MS = 500 // never assert below 500ms — per-corpus baselines may be near-zero on dev hardware

    for (const corpus of getBenchmarkCorpora()) {
      const baselineMs = baselineMap.get(corpus.id)
      if (baselineMs === undefined) {
        assert.fail(`${corpus.id} is not in benchmarks/benchmark-baseline.json — regenerate the baseline file before adding new corpora`)
      }
      const budgetMs = Math.max(baselineMs * SLACK, FLOOR_MS)

      const start = performance.now()
      await render(corpus.document())
      const elapsed = performance.now() - start

      assert.ok(
        elapsed < budgetMs,
        `${corpus.id}: ${elapsed.toFixed(0)}ms exceeds budget ${budgetMs.toFixed(0)}ms (baseline ${baselineMs}ms × ${SLACK})`
      )
    }
  })
})
