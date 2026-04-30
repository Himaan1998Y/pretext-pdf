/**
 * Regression tests for v0.8.3 SSRF hardening in src/assets.ts.
 *
 * Two fixes:
 * 1. IPv4-mapped IPv6 addresses ([::ffff:127.0.0.1]) bypassed the dotted-decimal
 *    private-IP regex chain in assertSafeUrl. Patched by normalizing the
 *    `::ffff:` prefix to its underlying IPv4 form before regex matching.
 * 2. fetchWithTimeout used the default `redirect: 'follow'` mode, so a public
 *    URL could 302 to http://127.0.0.1:8080/private and bypass the upfront
 *    assertSafeUrl. Patched by switching to `redirect: 'manual'` and
 *    re-validating each Location with assertSafeUrl, max 3 hops.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { assertSafeUrl } from '../dist/assets.js'

describe('v0.8.3 — SSRF: IPv4-mapped IPv6 bypass', () => {
  const cases: Array<[string, string]> = [
    ['[::ffff:127.0.0.1]', 'mapped IPv4 loopback'],
    ['[::ffff:127.0.0.5]', 'mapped IPv4 loopback (non-1)'],
    ['[::ffff:10.0.0.1]', 'mapped IPv4 RFC 1918 (10/8)'],
    ['[::ffff:192.168.1.1]', 'mapped IPv4 RFC 1918 (192.168/16)'],
    ['[::ffff:172.16.0.1]', 'mapped IPv4 RFC 1918 (172.16/12)'],
    ['[::ffff:169.254.169.254]', 'mapped IPv4 link-local / AWS IMDS'],
    ['[::FFFF:127.0.0.1]', 'mapped IPv4 with uppercase FFFF'],
  ]

  for (const [host, label] of cases) {
    test(`blocks ${label}: ${host}`, () => {
      assert.throws(
        () => assertSafeUrl(`https://${host}/admin`, 'IMAGE_LOAD_FAILED', 'Image'),
        /private or internal addresses/,
        `Expected ${host} to be blocked but it was allowed`
      )
    })
  }

  test('blocks the IPv6 unspecified address ::', () => {
    assert.throws(
      () => assertSafeUrl('https://[::]/admin', 'IMAGE_LOAD_FAILED', 'Image'),
      /private or internal addresses/
    )
  })

  test('blocks the IPv6 loopback ::1 (regression)', () => {
    assert.throws(
      () => assertSafeUrl('https://[::1]/admin', 'IMAGE_LOAD_FAILED', 'Image'),
      /private or internal addresses/
    )
  })

  test('still allows ordinary public hostnames', () => {
    assert.doesNotThrow(() => assertSafeUrl('https://example.com/img.png', 'IMAGE_LOAD_FAILED', 'Image'))
    assert.doesNotThrow(() => assertSafeUrl('https://cdn.cloudflare.com/x.svg', 'SVG_LOAD_FAILED', 'SVG'))
  })

  test('still rejects http:// regardless of host', () => {
    assert.throws(
      () => assertSafeUrl('http://example.com/img.png', 'IMAGE_LOAD_FAILED', 'Image'),
      /HTTPS/
    )
  })
})
