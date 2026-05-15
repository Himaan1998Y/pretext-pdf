/**
 * Regression tests for SSRF hardening in src/assets.ts.
 *
 * Four fixes:
 * 1. IPv4-mapped IPv6 addresses ([::ffff:127.0.0.1]) bypassed the dotted-decimal
 *    private-IP regex chain in assertSafeUrl. Patched by normalizing the
 *    `::ffff:` prefix to its underlying IPv4 form before regex matching.
 * 2. fetchWithTimeout used the default `redirect: 'follow'` mode, so a public
 *    URL could 302 to http://127.0.0.1:8080/private and bypass the upfront
 *    assertSafeUrl. Patched by switching to `redirect: 'manual'` and
 *    re-validating each Location with assertSafeUrl, max 3 hops.
 * 3. DNS rebinding TOCTOU: assertSafeUrl is now async and pre-resolves hostnames
 *    via dns.lookup() so the resolved IP is checked before fetch() re-resolves.
 * 4. B6 — DNS rebinding TOCTOU closure via socket pinning: fetchWithTimeout
 *    now routes through an undici Agent whose `connect.lookup` returns the
 *    pre-validated IP, so even if a malicious DNS server changes its answer
 *    between validation and connect, the socket targets the public IP we
 *    already approved.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { assertSafeUrl, resolveAndValidateUrl } from '../dist/assets.js'

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
    test(`blocks ${label}: ${host}`, async () => {
      await assert.rejects(
        () => assertSafeUrl(`https://${host}/admin`, 'IMAGE_LOAD_FAILED', 'Image'),
        /private or internal addresses/,
        `Expected ${host} to be blocked but it was allowed`
      )
    })
  }

  test('blocks the IPv6 unspecified address ::', async () => {
    await assert.rejects(
      () => assertSafeUrl('https://[::]/admin', 'IMAGE_LOAD_FAILED', 'Image'),
      /private or internal addresses/
    )
  })

  test('blocks the IPv6 loopback ::1 (regression)', async () => {
    await assert.rejects(
      () => assertSafeUrl('https://[::1]/admin', 'IMAGE_LOAD_FAILED', 'Image'),
      /private or internal addresses/
    )
  })

  test('still allows ordinary public hostnames', async () => {
    await assert.doesNotReject(() => assertSafeUrl('https://example.com/img.png', 'IMAGE_LOAD_FAILED', 'Image'))
    await assert.doesNotReject(() => assertSafeUrl('https://cdn.cloudflare.com/x.svg', 'SVG_LOAD_FAILED', 'SVG'))
  })

  test('still rejects http:// regardless of host', async () => {
    await assert.rejects(
      () => assertSafeUrl('http://example.com/img.png', 'IMAGE_LOAD_FAILED', 'Image'),
      /HTTPS/
    )
  })
})

describe('B6 — resolveAndValidateUrl returns pinning info', () => {
  test('returns IP and family for a public hostname', async () => {
    const result = await resolveAndValidateUrl('https://example.com/img.png', 'IMAGE_LOAD_FAILED', 'Image')
    assert.ok(result.url instanceof URL, 'url must be a URL instance')
    assert.equal(result.url.hostname, 'example.com')
    // example.com resolves to a real public address — both IP and family must be set
    assert.ok(result.ip !== null, 'ip must be set for public hostnames so the connection can be pinned')
    assert.ok(result.family === 4 || result.family === 6, 'family must be 4 or 6')
  })

  test('returns family=4 for an IPv4 literal without consulting DNS', async () => {
    const result = await resolveAndValidateUrl('https://8.8.8.8/img.png', 'IMAGE_LOAD_FAILED', 'Image')
    assert.equal(result.ip, '8.8.8.8')
    assert.equal(result.family, 4)
  })

  test('throws on private resolved IP (rebinding-safe block)', async () => {
    // localhost will resolve to 127.0.0.1 or ::1 — either way private.
    await assert.rejects(
      () => resolveAndValidateUrl('https://localhost/img.png', 'IMAGE_LOAD_FAILED', 'Image'),
      /private or internal addresses/,
    )
  })

  test('rejects non-https schemes explicitly', async () => {
    await assert.rejects(
      () => resolveAndValidateUrl('ftp://example.com/x', 'IMAGE_LOAD_FAILED', 'Image'),
      /refused scheme|HTTPS/,
    )
  })
})

describe('B6 — extended private-range coverage', () => {
  // Pre-resolved IPv4 literals: these must be blocked without DNS lookup.
  const blockedV4Literals: Array<[string, string]> = [
    ['0.0.0.0', 'IPv4 unspecified'],
    ['0.1.2.3', '0.0.0.0/8 "this network"'],
    ['198.18.0.1', '198.18/15 benchmark testing'],
    ['198.19.255.254', '198.18/15 benchmark testing (upper)'],
    ['224.0.0.1', '224/4 multicast (low)'],
    ['239.255.255.255', '224/4 multicast (high)'],
    ['240.0.0.1', '240/4 reserved (low)'],
    ['255.255.255.255', '240/4 reserved (broadcast)'],
    ['192.0.0.1', '192.0.0/24 IETF protocol assignments'],
  ]
  for (const [ip, label] of blockedV4Literals) {
    test(`blocks ${label}: ${ip}`, async () => {
      await assert.rejects(
        () => assertSafeUrl(`https://${ip}/x`, 'IMAGE_LOAD_FAILED', 'Image'),
        /private or internal addresses/,
        `Expected ${ip} (${label}) to be blocked`,
      )
    })
  }

  // IPv6 prefix checks must not blackhole legitimate hostnames that happen
  // to start with the same letters.
  test('does NOT block ffmpeg.com (regression: IPv6 ff prefix must be IPv6-only)', async () => {
    // We don't care if DNS lookup succeeds — just that the hostname-shape
    // check itself does not reject it as "private". If DNS fails or the
    // resolved IP is public, we should not get the "private or internal"
    // error.
    try {
      await assertSafeUrl('https://ffmpeg.com/img.png', 'IMAGE_LOAD_FAILED', 'Image')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      assert.ok(
        !/private or internal addresses/.test(msg),
        `ffmpeg.com must not be flagged as private (got: ${msg})`,
      )
    }
  })
})
