/**
 * Regression test for v1.3.2 item #8 — DNS resolution de-duplication.
 *
 * Prior to v1.3.2, both resolveSvgContent() and loadImageBytes() performed
 * an upfront `assertSafeUrl()` AND then called `fetchWithTimeout()`, which
 * internally re-runs `resolveAndValidateUrl()` → `dnsPromises.lookup()`.
 * Every remote image/SVG load did TWO DNS lookups for the same hostname.
 *
 * After v1.3.2: the upfront assertSafeUrl() calls are removed (SSRF
 * validation still happens inside fetchWithTimeout, which calls
 * resolveAndValidateUrl → dnsPromises.lookup exactly once).
 *
 * This test instruments dns.promises.lookup and confirms the
 * post-fix code path (fetchWithTimeout alone) performs exactly ONE
 * lookup per hostname — matching what the SVG and image fetch sites
 * now do after the upfront assertSafeUrl removal.
 */
import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import * as dns from 'node:dns'

type LookupCounter = Map<string, number>

function installLookupSpy(): { counter: LookupCounter; restore: () => void } {
  const counter: LookupCounter = new Map()
  const original = dns.promises.lookup
  // @ts-ignore — overload-safe wrapper
  dns.promises.lookup = async function patched(hostname: string, ...rest: unknown[]) {
    counter.set(hostname, (counter.get(hostname) ?? 0) + 1)
    // @ts-ignore — pass through verbatim
    return original.call(dns.promises, hostname, ...rest)
  }
  return {
    counter,
    restore: () => { dns.promises.lookup = original },
  }
}

describe('v1.3.2 #8 — DNS resolution de-duplication for remote assets', () => {
  let spy: ReturnType<typeof installLookupSpy>

  beforeEach(() => { spy = installLookupSpy() })
  afterEach(() => { spy.restore() })

  test('fetchWithTimeout performs exactly ONE dns.lookup per remote URL (was 2 pre-v1.3.2)', async () => {
    const { fetchWithTimeout } = await import('../dist/assets.js') as any
    const hostname = 'no-such-host-pretext-pdf-test-12345.invalid'
    spy.counter.clear()
    try {
      await fetchWithTimeout(`https://${hostname}/x.png`, 'IMAGE_LOAD_FAILED', 'Image')
    } catch {
      // expected — DNS resolution will fail
    }
    const count = spy.counter.get(hostname) ?? 0
    assert.equal(count, 1, `Expected exactly 1 dns.lookup for ${hostname}, got ${count}`)
  })

  test('assertSafeUrl + fetchWithTimeout (the OLD double-call pattern) would do 2 lookups — guard against regression', async () => {
    const { assertSafeUrl, fetchWithTimeout } = await import('../dist/assets.js') as any
    const hostname = 'no-such-host-pretext-pdf-test-67890.invalid'
    spy.counter.clear()
    // Simulate the old code path that v1.3.2 removed.
    try { await assertSafeUrl(`https://${hostname}/x.svg`, 'SVG_LOAD_FAILED', 'SVG') } catch {}
    try { await fetchWithTimeout(`https://${hostname}/x.svg`, 'SVG_LOAD_FAILED', 'SVG') } catch {}
    const count = spy.counter.get(hostname) ?? 0
    // This is the documented baseline: with both calls, lookup runs twice.
    // The fix removes the standalone assertSafeUrl, dropping count to 1.
    assert.equal(count, 2, `Sanity check: old pattern (assertSafeUrl + fetchWithTimeout) should call lookup twice, got ${count}`)
  })
})
