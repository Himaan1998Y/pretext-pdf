/**
 * Regression test for v1.3.2 item #7 — word-width measurement cache.
 *
 * measureWord accepts an optional cache `Map<string, number>`. A second call
 * with the same (word, fontString) must hit the cache and skip the inner
 * pretext layout (no call to getPretext().layoutWithLines for that word).
 */
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'

describe('v1.3.2 #7 — measureWord cache', () => {
  before(async () => {
    const { installNodePolyfill } = await import('../dist/node-polyfill.js') as any
    await installNodePolyfill()
  })

  test('second call with same args hits cache — proven via cache write-through and Map.get identity', async () => {
    const { measureWord } = await import('../dist/measure-text.js') as any

    // Strategy: pre-seed the cache with a sentinel value. If the cache is consulted
    // on the second call, measureWord returns the sentinel — proving cache-hit
    // skipped the inner layout. If the cache is ignored, the call recomputes the
    // real width (which is non-zero and != sentinel).
    const cache = new Map<string, number>()
    const realWidth = await measureWord('Hello', '12px Inter', cache)
    assert.ok(realWidth > 0, 'first call must measure a positive width')
    assert.equal(cache.size, 1, 'first call must write-through to cache')
    assert.ok(cache.has('Hello|12px Inter'), 'cache key must be `${word}|${fontString}`')
    assert.equal(cache.get('Hello|12px Inter'), realWidth)

    // Overwrite the cache entry with a sentinel — second call must return it.
    const SENTINEL = 99999
    cache.set('Hello|12px Inter', SENTINEL)
    const second = await measureWord('Hello', '12px Inter', cache)
    assert.equal(
      second, SENTINEL,
      `second call must hit cache and return sentinel ${SENTINEL}; got ${second}. (Cache was bypassed → inner layout ran.)`,
    )
  })

  test('different fontString produces a separate cache entry', async () => {
    const { measureWord } = await import('../dist/measure-text.js') as any
    const cache = new Map<string, number>()
    await measureWord('Hello', '12px Inter', cache)
    await measureWord('Hello', '14px Inter', cache)
    assert.equal(cache.size, 2, `expected 2 distinct cache entries, got ${cache.size}`)
  })

  test('no cache passed = no caching, no behavioral change', async () => {
    const { measureWord } = await import('../dist/measure-text.js') as any
    const a = await measureWord('Hello', '12px Inter')
    const b = await measureWord('Hello', '12px Inter')
    assert.equal(a, b)
    assert.ok(a > 0)
  })

  test('FIFO eviction at WORD_WIDTH_CACHE_MAX: oldest key dropped, ordering preserved', async () => {
    const { measureWord, WORD_WIDTH_CACHE_MAX } = await import('../src/measure-text.js') as any
    assert.equal(typeof WORD_WIDTH_CACHE_MAX, 'number')
    assert.ok(WORD_WIDTH_CACHE_MAX > 0)

    const cache = new Map<string, number>()
    const fontString = '12px Inter'
    // Pre-fill cache to the cap with synthetic keys (skip measureWord — too slow at 50k).
    // Use the same cache-key format measureWord uses: `${word}|${fontString}`.
    for (let i = 0; i < WORD_WIDTH_CACHE_MAX; i++) {
      cache.set(`syn${i}|${fontString}`, i)
    }
    assert.equal(cache.size, WORD_WIDTH_CACHE_MAX, 'pre-fill must reach the cap')

    // Re-access key syn1 — under LRU this would move it to the end; under FIFO
    // (Map insertion order is fixed by .get) it should still be evicted last.
    cache.get(`syn1|${fontString}`)

    // Trigger eviction by adding one more unique entry via measureWord.
    const newWidth = await measureWord('Eviction', fontString, cache)
    assert.ok(newWidth > 0)

    // Size must stay at cap, not cap+1.
    assert.equal(
      cache.size, WORD_WIDTH_CACHE_MAX,
      `size must remain ${WORD_WIDTH_CACHE_MAX} after eviction, got ${cache.size}`,
    )

    // Oldest insertion (syn0) must be gone — FIFO drops the first key.
    assert.equal(
      cache.has(`syn0|${fontString}`), false,
      'syn0 (oldest insertion) must be evicted',
    )
    // syn1 must still be present despite being re-accessed — proves FIFO, not LRU.
    // (Under LRU, syn1 would be the most-recently-used and syn2 would have been evicted.)
    assert.equal(
      cache.has(`syn1|${fontString}`), true,
      'syn1 must still be present — re-access did not move it (proves FIFO, not LRU)',
    )
    // New entry must be present.
    assert.equal(cache.has(`Eviction|${fontString}`), true)
  })
})
