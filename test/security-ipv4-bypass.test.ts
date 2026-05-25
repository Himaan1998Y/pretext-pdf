/**
 * v1.5.2 — IPv4 alternative-notation SSRF bypass (CVE-class).
 *
 * The WHATWG URL parser does NOT normalize non-dotted IPv4 forms, so the
 * private-range regexes in `isPrivateAddress` (e.g. `/^127\./`) miss every
 * inet_aton-compatible encoding of a private address:
 *
 *   - Pure decimal:  `2130706433`     → 127.0.0.1
 *   - Pure hex:      `0x7f000001`     → 127.0.0.1
 *   - Octal octet:   `0177.0.0.1`     → 127.0.0.1
 *   - Hex octet:     `0x7f.0.0.1`     → 127.0.0.1
 *   - Short form:    `127.1`          → 127.0.0.1
 *
 * Without normalization, `parsed.hostname` is `"2130706433"`, the regex
 * doesn't match, the `isIpv4Literal` (4-dot) check doesn't match, and the
 * URL falls through to DNS lookup which on Linux's getaddrinfo happily
 * resolves to 127.0.0.1 — bypassing the SSRF guard.
 *
 * Fixed by `normalizeIpv4Hostname` in src/assets.ts, called from both
 * `isPrivateAddress` (defense in depth on the post-DNS path) and
 * `resolveAndValidateUrl` (pre-DNS so we never hit getaddrinfo for a
 * non-dotted private encoding).
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { assertSafeUrl, resolveAndValidateUrl, normalizeIpv4Hostname } from '../dist/assets.js'

describe('v1.5.2 — SSRF: IPv4 alternative-notation bypass', () => {
  const blockedCases: Array<[string, string]> = [
    ['https://2130706433/x.png', 'pure decimal 127.0.0.1'],
    ['https://0177.0.0.1/x.png', 'octal first octet'],
    ['https://0x7f.0.0.1/x.png', 'hex first octet'],
    ['https://0x7f000001/x.png', 'pure hex 127.0.0.1'],
    ['https://127.1/x.png', 'short form (2 parts)'],
    ['https://127.0.1/x.png', 'short form (3 parts)'],
    ['https://127.0.0.1/x.png', 'canonical dotted (regression guard)'],
    // Additional encodings of private ranges
    ['https://0xa000001/x.png', 'pure hex 10.0.0.1 (RFC 1918)'],
    ['https://3232235521/x.png', 'pure decimal 192.168.0.1 (RFC 1918)'],
    ['https://0xa9fea9fe/x.png', 'pure hex 169.254.169.254 (AWS IMDS)'],
  ]

  for (const [url, label] of blockedCases) {
    test(`blocks ${label}: ${url}`, async () => {
      await assert.rejects(
        () => assertSafeUrl(url, 'IMAGE_LOAD_FAILED', 'Image'),
        /private or internal addresses/,
        `Expected ${url} to be blocked but it was allowed`,
      )
    })
  }

  test('still allows public hostnames after normalization step', async () => {
    await assert.doesNotReject(() => assertSafeUrl('https://example.com/img.png', 'IMAGE_LOAD_FAILED', 'Image'))
  })

  test('still allows ordinary public dotted IPv4 (8.8.8.8)', async () => {
    await assert.doesNotReject(() => assertSafeUrl('https://8.8.8.8/img.png', 'IMAGE_LOAD_FAILED', 'Image'))
  })

  test('still allows decimal form of a public IPv4 (8.8.8.8 → 134744072)', async () => {
    await assert.doesNotReject(() => assertSafeUrl('https://134744072/img.png', 'IMAGE_LOAD_FAILED', 'Image'))
  })

  test('resolveAndValidateUrl pins decimal-encoded private IP without DNS lookup', async () => {
    // Before the fix this would either fall through to DNS (resolving to
    // 127.0.0.1 on Linux) or be allowed outright. After the fix it must
    // reject upfront before any DNS call.
    await assert.rejects(
      () => resolveAndValidateUrl('https://2130706433/x.png', 'IMAGE_LOAD_FAILED', 'Image'),
      /private or internal addresses/,
    )
  })

  test('resolveAndValidateUrl returns family=4 for a normalized public IPv4 notation', async () => {
    const result = await resolveAndValidateUrl('https://134744072/img.png', 'IMAGE_LOAD_FAILED', 'Image')
    assert.equal(result.family, 4)
    assert.equal(result.ip, '8.8.8.8', 'normalized dotted form should be returned for socket pinning')
  })
})

describe('v1.5.2 — normalizeIpv4Hostname helper', () => {
  test('returns null for non-IPv4 inputs', () => {
    assert.equal(normalizeIpv4Hostname('example.com'), null)
    assert.equal(normalizeIpv4Hostname(''), null)
    assert.equal(normalizeIpv4Hostname('::1'), null)
    assert.equal(normalizeIpv4Hostname('[::ffff:127.0.0.1]'), null)
    assert.equal(normalizeIpv4Hostname('not.an.ip.really'), null)
  })

  test('returns null for malformed octal (digit out of 0–7 range)', () => {
    // `008` and `009` are invalid in inet_aton because 8/9 are not octal digits.
    // Whether or not Linux's getaddrinfo accepts them is implementation-defined;
    // we conservatively reject so a public `008.008.008.008` doesn't masquerade
    // as 8.8.8.8 through our normalizer (the original hostname is left for DNS
    // and will fail there).
    assert.equal(normalizeIpv4Hostname('008.008.008.008'), null)
  })

  test('round-trips canonical dotted form', () => {
    assert.equal(normalizeIpv4Hostname('127.0.0.1'), '127.0.0.1')
    assert.equal(normalizeIpv4Hostname('8.8.8.8'), '8.8.8.8')
    assert.equal(normalizeIpv4Hostname('255.255.255.255'), '255.255.255.255')
    assert.equal(normalizeIpv4Hostname('0.0.0.0'), '0.0.0.0')
  })

  test('normalizes decimal forms', () => {
    assert.equal(normalizeIpv4Hostname('2130706433'), '127.0.0.1')
    assert.equal(normalizeIpv4Hostname('134744072'), '8.8.8.8')
    assert.equal(normalizeIpv4Hostname('0'), '0.0.0.0')
  })

  test('normalizes hex forms', () => {
    assert.equal(normalizeIpv4Hostname('0x7f000001'), '127.0.0.1')
    assert.equal(normalizeIpv4Hostname('0X7F000001'), '127.0.0.1')
    assert.equal(normalizeIpv4Hostname('0x7f.0.0.1'), '127.0.0.1')
  })

  test('normalizes octal forms', () => {
    assert.equal(normalizeIpv4Hostname('0177.0.0.1'), '127.0.0.1')
  })

  test('normalizes short forms (inet_aton)', () => {
    assert.equal(normalizeIpv4Hostname('127.1'), '127.0.0.1')
    assert.equal(normalizeIpv4Hostname('127.0.1'), '127.0.0.1')
    assert.equal(normalizeIpv4Hostname('10.65535'), '10.0.255.255')
  })

  test('rejects out-of-range parts', () => {
    assert.equal(normalizeIpv4Hostname('256.0.0.1'), null)
    assert.equal(normalizeIpv4Hostname('1.2.3.4.5'), null)        // too many parts
    assert.equal(normalizeIpv4Hostname('99999999999999'), null)   // > 2^32
  })

  test('rejects negative and non-numeric parts', () => {
    assert.equal(normalizeIpv4Hostname('-1.0.0.0'), null)
    assert.equal(normalizeIpv4Hostname('abc.0.0.0'), null)
  })
})
