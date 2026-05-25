import { promises as dnsPromises } from 'node:dns'
import { PretextPdfError } from '../../errors.js'
import { normalizeIpv4Hostname } from './ipv4-normalize.js'

/**
 * SSRF defence-in-depth helpers for remote image / SVG fetches.
 *
 * Extracted from `src/assets.ts` in v1.6.0 commit 7/16 as part of the
 * post-v1.5.2 assets.ts file-size sprint. Pure module — no top-level side
 * effects. `src/assets.ts` re-exports `resolveAndValidateUrl`, `assertSafeUrl`,
 * and `ResolvedSafeUrl` for back-compat with consumers that import from
 * `'./assets.js'` / `'../dist/assets.js'` (notably `test/security-ssrf.test.ts`).
 *
 * `isPrivateAddress` is intentionally NOT re-exported — it is a private
 * implementation detail.
 */

/**
 * Validate a remote URL before fetching:
 * - Rejects http:// (plaintext only)
 * - Rejects private/internal IP ranges (SSRF prevention), including IPv4-mapped IPv6
 *   forms like [::ffff:127.0.0.1] which would otherwise bypass dotted-decimal regexes.
 * - Rejects alternative IPv4 notations (decimal `2130706433`, octal `0177.0.0.1`,
 *   hex `0x7f000001`, short form `127.1`) by normalizing through
 *   `normalizeIpv4Hostname` before regex matching.
 * Throws IMAGE_LOAD_FAILED or SVG_LOAD_FAILED on violations.
 */
function isPrivateAddress(h: string, raw: string): boolean {
  // Defense-in-depth: if `h` is an alternative IPv4 notation, fold to its
  // canonical dotted form before regex matching. Callers should normally
  // pre-normalize, but private-address checks are also invoked on freshly
  // resolved DNS results — normalize there too in case a resolver ever
  // returns a non-dotted form.
  const normalized = normalizeIpv4Hostname(h)
  if (normalized && normalized !== h) {
    h = normalized
  }
  return _isPrivateAddressInner(h, raw)
}

function _isPrivateAddressInner(h: string, raw: string): boolean {
  // IPv6 prefix checks must only fire on actual IPv6 hostnames (which contain
  // a colon) — otherwise legitimate hostnames like `ffmpeg.com` or `fcc.gov`
  // would be blocked.
  const isV6 = raw.includes(':')
  return (
    h === 'localhost' ||
    h === '0.0.0.0' ||
    h === '::' || // IPv6 unspecified address (== 0.0.0.0)
    h === '::1' ||
    raw === '::1' ||
    raw === '::' || // also catch un-normalized IPv6 forms
    /^0\./.test(h) || // 0.0.0.0/8 "this network"
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^192\.0\.0\./.test(h) || // 192.0.0/24 IETF protocol assignments
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^169\.254\./.test(h) || // link-local / AWS IMDS
    /^198\.1[89]\./.test(h) || // 198.18/15 benchmark testing
    /^22[4-9]\./.test(h) ||
    /^23\d\./.test(h) || // 224/4 multicast
    /^2[4-5]\d\./.test(h) || // 240/4 reserved (240–255)
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h) || // CGNAT RFC 6598
    (isV6 && (raw.startsWith('fc') || raw.startsWith('fd'))) || // IPv6 ULA fc00::/7
    (isV6 && /^fe[89ab]/i.test(raw)) || // IPv6 link-local fe80::/10
    (isV6 && /^ff/i.test(raw)) // IPv6 multicast ff00::/8
  )
}

/**
 * Result of resolving a URL: the parsed URL plus the pre-validated IP that
 * downstream fetches should pin to (closing the TOCTOU rebinding window).
 * `ip` is null only for IP-literal hostnames (no DNS lookup performed).
 */
export interface ResolvedSafeUrl {
  url: URL
  ip: string | null
  family: 4 | 6 | null
}

/**
 * Validate that a URL is safe to fetch. Returns the parsed URL and the
 * pre-resolved IP so callers can pin the connection. Throws PretextPdfError
 * if the URL targets a private/internal address.
 */
export async function resolveAndValidateUrl(
  url: string,
  errorCode: 'IMAGE_LOAD_FAILED' | 'SVG_LOAD_FAILED',
  label: string,
): Promise<ResolvedSafeUrl> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new PretextPdfError(errorCode, `${label}: invalid URL`)
  }

  if (parsed.protocol === 'http:') {
    throw new PretextPdfError(errorCode, `${label}: HTTP URLs are not allowed — use HTTPS`)
  }

  if (parsed.protocol === 'data:' || parsed.protocol === 'file:' || parsed.protocol === 'javascript:') {
    throw new PretextPdfError(errorCode, `${label}: ${parsed.protocol} URLs are not allowed — use HTTPS only`)
  }

  if (parsed.protocol !== 'https:') {
    throw new PretextPdfError(errorCode, `${label}: refused scheme: ${parsed.protocol}`)
  }

  const raw = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '') // strip IPv6 brackets

  // Normalize IPv4-mapped IPv6 to its dotted-decimal form so the IPv4
  // private-range regexes catch it. WHATWG URL normalizes `[::ffff:127.0.0.1]`
  // to `[::ffff:7f00:1]` (hex form), so we must handle BOTH the dotted
  // (`::ffff:127.0.0.1`) and hex-compressed (`::ffff:7f00:1`) forms.
  // Without this an attacker can bypass the localhost/private-IP check via
  // `https://[::ffff:127.0.0.1]/admin` → resolves to 127.0.0.1.
  let h = raw
  const v4Dotted = raw.match(/^::ffff:(?:0:)?(\d{1,3}(?:\.\d{1,3}){3})$/i)
  const v4Hex = raw.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
  if (v4Dotted) {
    h = v4Dotted[1]!
  } else if (v4Hex) {
    const hi = parseInt(v4Hex[1]!, 16)
    const lo = parseInt(v4Hex[2]!, 16)
    h = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
  }

  // Normalize alternative IPv4 notations (decimal `2130706433`, octal
  // `0177.0.0.1`, hex `0x7f000001`, short form `127.1`) to dotted-decimal
  // BEFORE the private-IP check. Without this an attacker can bypass the
  // localhost / RFC1918 regexes by encoding 127.0.0.1 in any non-dotted form;
  // WHATWG URL does not normalize these and DNS will happily resolve them
  // on Linux via getaddrinfo.
  const normalizedIpv4 = normalizeIpv4Hostname(h)
  if (normalizedIpv4) {
    h = normalizedIpv4
  }

  if (isPrivateAddress(h, raw)) {
    throw new PretextPdfError(errorCode, `${label}: connections to private or internal addresses are not allowed`)
  }

  // DNS pre-resolution: re-verify the resolved IP AND remember it so callers
  // can pin the actual TCP connection to this exact IP (closes the TOCTOU
  // window where an attacker with TTL=0 DNS could rebind between check and
  // connect).
  const isIpv4Literal = /^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname)
  const isIpv6Literal = parsed.hostname.startsWith('[')
  if (isIpv4Literal) {
    return { url: parsed, ip: parsed.hostname, family: 4 }
  }
  // Alternative IPv4 notation that we just normalized to dotted form: treat
  // as a literal (no DNS lookup needed, and we already verified it's public).
  // Pin to the normalized dotted form so undici skips its own getaddrinfo.
  if (normalizedIpv4) {
    return { url: parsed, ip: normalizedIpv4, family: 4 }
  }
  if (isIpv6Literal) {
    return { url: parsed, ip: raw, family: 6 }
  }
  if (!parsed.hostname) {
    return { url: parsed, ip: null, family: null }
  }
  try {
    const { address, family } = await dnsPromises.lookup(parsed.hostname)
    const resolvedH = address.toLowerCase()
    if (isPrivateAddress(resolvedH, resolvedH)) {
      throw new PretextPdfError(errorCode, `${label}: hostname resolves to a private address`)
    }
    return { url: parsed, ip: address, family: family === 6 ? 6 : 4 }
  } catch (err) {
    if (err instanceof PretextPdfError) throw err
    // DNS unavailable: fetch() will also fail, so rebinding is not possible.
    // Without a resolved IP we cannot pin the connection; let undici resolve
    // itself, which will then fail with the same DNS error.
    return { url: parsed, ip: null, family: null }
  }
}

/**
 * Back-compat wrapper that drops the resolution result. Kept so existing
 * tests and call sites that only need the validation side-effect still work.
 */
export async function assertSafeUrl(
  url: string,
  errorCode: 'IMAGE_LOAD_FAILED' | 'SVG_LOAD_FAILED',
  label: string,
): Promise<void> {
  await resolveAndValidateUrl(url, errorCode, label)
}
