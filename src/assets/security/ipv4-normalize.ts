/**
 * Normalize alternative IPv4 notations to dotted-decimal form so the
 * private-range regexes catch them. WHATWG URL does NOT normalize these,
 * so an attacker can use any of these forms to bypass `/^127\./`-style
 * checks:
 *   - Pure decimal:  `2130706433`            → 127.0.0.1
 *   - Pure hex:      `0x7f000001`            → 127.0.0.1
 *   - Octal octet:   `0177.0.0.1`            → 127.0.0.1
 *   - Hex octet:     `0x7f.0.0.1`            → 127.0.0.1
 *   - Short form:    `127.1`, `127.0.1`      → 127.0.0.1
 *
 * Returns the dotted-decimal form when `hostname` is any valid IPv4
 * representation, otherwise `null` (leaving the original hostname for
 * DNS resolution / regex matching). Never throws.
 *
 * NOTE: parts with leading zeros (e.g. `008`) are parsed as octal per the
 * traditional inet_aton rules — `008` is INVALID (8 is not an octal digit)
 * so we return null. `010` parses as octal 8. This matches how Linux's
 * getaddrinfo / inet_aton historically resolved these forms, which is what
 * we need to defend against.
 *
 * Extracted from `src/assets.ts` in v1.6.0 commit 6/16 as part of the
 * post-v1.5.2 assets.ts file-size sprint. Pure function — no module-level
 * side effects. Re-exported from `src/assets.ts` so existing direct importers
 * (`test/security-ipv4-bypass.test.ts`) keep working.
 */
export function normalizeIpv4Hostname(hostname: string): string | null {
  if (!hostname || hostname.includes(':') || hostname.includes('[')) return null

  // Parse a single part as decimal / octal / hex per inet_aton semantics.
  // Returns null on any malformed input (non-digit chars, out-of-range, etc.)
  const parsePart = (part: string): number | null => {
    if (part.length === 0) return null
    let radix = 10
    let body = part
    if (part.length > 1 && (part[0] === '0' || part[0] === '-')) {
      // Reject negative parts outright
      if (part[0] === '-') return null
    }
    if (part === '0') return 0
    if (part.length >= 2 && (part[0] === '0') && (part[1] === 'x' || part[1] === 'X')) {
      radix = 16
      body = part.slice(2)
      if (body.length === 0) return null
      if (!/^[0-9a-fA-F]+$/.test(body)) return null
    } else if (part[0] === '0') {
      radix = 8
      body = part.slice(1)
      if (!/^[0-7]+$/.test(body)) return null
    } else {
      if (!/^[0-9]+$/.test(part)) return null
    }
    const n = parseInt(body, radix)
    if (!Number.isFinite(n) || n < 0) return null
    return n
  }

  const parts = hostname.split('.')
  if (parts.length === 0 || parts.length > 4) return null
  const parsed: number[] = []
  for (const p of parts) {
    const n = parsePart(p)
    if (n === null) return null
    parsed.push(n)
  }

  // Apply inet_aton-style packing for short forms:
  //   1 part:  a            → a (32-bit, all octets)
  //   2 parts: a.b          → a.0.0.0 | b (last covers low 24 bits)
  //   3 parts: a.b.c        → a.b.0.0 | c (last covers low 16 bits)
  //   4 parts: a.b.c.d      → each octet 0–255
  let value: number
  if (parsed.length === 1) {
    value = parsed[0]!
    // Single-int forms (decimal/hex) must fit in 32 bits; reject before the
    // `>>> 0` truncation below would silently wrap.
    if (value < 0 || value > 0xffffffff) return null
  } else if (parsed.length === 2) {
    const [a, b] = parsed as [number, number]
    if (a > 0xff || b > 0xffffff) return null
    value = (a << 24) >>> 0 | b
  } else if (parsed.length === 3) {
    const [a, b, c] = parsed as [number, number, number]
    if (a > 0xff || b > 0xff || c > 0xffff) return null
    value = ((a << 24) >>> 0) | (b << 16) | c
  } else {
    const [a, b, c, d] = parsed as [number, number, number, number]
    if (a > 0xff || b > 0xff || c > 0xff || d > 0xff) return null
    value = ((a << 24) >>> 0) | (b << 16) | (c << 8) | d
  }
  // `|` in JS is a signed 32-bit op — coerce to unsigned for the final value
  // so 0xFFFFFFFF reads as 4294967295 rather than -1.
  value = value >>> 0
  // Final 32-bit range guard (covers single-int forms like `2130706433`)
  if (value > 0xffffffff) return null

  return `${(value >>> 24) & 0xff}.${(value >>> 16) & 0xff}.${(value >>> 8) & 0xff}.${value & 0xff}`
}
