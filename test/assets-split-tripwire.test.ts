/**
 * assets-split-tripwire.test.ts — Pre-extraction snapshot tripwire for v1.6.0
 * assets.ts split (commits 1/16 → 16/16).
 *
 * 30 security-path fixtures (F1–F24 + MA-1–MA-6) exercise loadImageBytes,
 * resolveSvgContent (via render()), the watermark image path, and the SVG
 * sanitizer. For each fixture we capture { errorCode, messageSubstring } (or
 * sanitizer output excerpt) and write to test/data/assets-split-tripwire.json.
 *
 * On subsequent runs, we assert bit-exact (substring-stable) equality. Any
 * drift during the assets.ts extraction must be intentional — regenerate with
 * UPDATE_SNAPSHOT=1.
 *
 * Run: tsx --test test/assets-split-tripwire.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

// Use dist (matches the rest of the assets/security tests).
const { render } = await import('../dist/index.js')

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const BASELINE = join(__dirname, 'data', 'assets-split-tripwire.json')

interface CapturedError {
  /** PretextPdfError.code if available, else 'Error' / 'NonError' */
  errorCode: string
  /** First 240 chars of the error message (substring stable across releases) */
  message: string
}

interface CapturedSanitize {
  /** Whether the dangerous token survived sanitization. */
  scriptStripped?: boolean
  foreignObjectStripped?: boolean
  javascriptHrefStripped?: boolean
  cssExpressionStripped?: boolean
}

type FixtureResult =
  | { kind: 'error'; result: CapturedError }
  | { kind: 'sanitize'; result: CapturedSanitize }
  | { kind: 'mixed'; result: { firstSucceeded: boolean; secondCaptured: CapturedError | null } }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Render a doc with a single image element whose load failure is captured
 * via onImageLoadError: 'throw'. Returns the captured error envelope.
 */
async function captureImageLoadError(
  src: string | Uint8Array,
  allowedFileDirs?: string[],
): Promise<CapturedError> {
  try {
    await render({
      content: [
        { type: 'image', src, width: 100, height: 100 } as any,
      ],
      ...(allowedFileDirs !== undefined ? { allowedFileDirs } : {}),
      onImageLoadError: (_src: unknown, _err: Error) => 'throw',
    } as any)
    return { errorCode: 'NoError', message: '(load succeeded — unexpected)' }
  } catch (err) {
    return extractError(err)
  }
}

/**
 * Render a doc with a single SVG element (src branch).
 * SVG load errors throw directly (no per-asset callback in current code).
 */
async function captureSvgLoadError(
  srcOrSvg: { src?: string; svg?: string },
  allowedFileDirs?: string[],
): Promise<CapturedError> {
  const svgEl: any = { type: 'svg', width: 100, height: 100, ...srcOrSvg }
  try {
    await render({
      content: [svgEl],
      ...(allowedFileDirs !== undefined ? { allowedFileDirs } : {}),
    } as any)
    return { errorCode: 'NoError', message: '(svg load succeeded — unexpected)' }
  } catch (err) {
    return extractError(err)
  }
}

/**
 * Render a doc with a watermark image. PATH_TRAVERSAL rethrows; other
 * watermark errors are swallowed (warning only).
 */
async function captureWatermarkImageError(
  imageSrc: string,
  allowedFileDirs?: string[],
): Promise<CapturedError> {
  try {
    await render({
      content: [{ type: 'paragraph', text: 'ok' }],
      watermark: { image: imageSrc },
      ...(allowedFileDirs !== undefined ? { allowedFileDirs } : {}),
    } as any)
    return { errorCode: 'NoError', message: '(watermark accepted — swallowed or succeeded)' }
  } catch (err) {
    return extractError(err)
  }
}

function extractError(err: unknown): CapturedError {
  if (err && typeof err === 'object') {
    const e = err as { code?: unknown; message?: unknown }
    const code = typeof e.code === 'string' ? e.code : (err instanceof Error ? 'Error' : 'NonError')
    const msg = typeof e.message === 'string' ? e.message : String(err)
    return { errorCode: code, message: msg.slice(0, 240) }
  }
  return { errorCode: 'NonError', message: String(err).slice(0, 240) }
}

/**
 * Render a doc with an SVG containing dangerous payload and inspect the
 * sanitized SVG that flows into rasterization. Since sanitizeSvg is not
 * exported, we proxy via @napi-rs/canvas's loadImage by intercepting the
 * argument — but that's invasive. Instead we recreate the regex chain in
 * a tiny re-export. To avoid changing the source surface, we re-implement
 * checks by reading the SVG content fed to canvas through a render that
 * uses onSvgRasterized hook... which also doesn't exist.
 *
 * Pragmatic approach: re-export sanitizeSvg by importing from src module
 * directly (TS-side). We use a separate dynamic import to the source so
 * we can call the internal function for sanitizer assertions.
 */
async function getSanitizer(): Promise<(svg: string) => string> {
  // v1.6.0 Phase 0a: sanitizeSvg is now exported from dist/assets.js so the
  // tripwire couples directly to source behavior. Drift in src/assets.ts will
  // surface here as a baseline mismatch.
  const mod = (await import('../dist/assets.js')) as { sanitizeSvg: (s: string) => string }
  return mod.sanitizeSvg
}

// ─── Mock HTTP server (fixtures 19–21) ────────────────────────────────────────

interface MockServer { url: (path: string) => string; close: () => Promise<void> }

async function startRedirectServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
): Promise<MockServer> {
  const server = http.createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  return {
    url: (p: string) => `http://127.0.0.1:${port}${p}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

// ─── Fixture runners ──────────────────────────────────────────────────────────

async function captureAllFixtures(): Promise<Record<string, FixtureResult>> {
  const out: Record<string, FixtureResult> = {}

  // F1: file:///etc/passwd via loadImageBytes, no allowedFileDirs
  out['F1-file-passwd-no-allowedFileDirs'] = {
    kind: 'error',
    result: await captureImageLoadError('file:///etc/passwd'),
  }
  // F2: /tmp/outside.png with allowedFileDirs=['/var/data']
  out['F2-path-outside-allowedFileDirs'] = {
    kind: 'error',
    result: await captureImageLoadError('/tmp/outside.png', ['/var/data']),
  }
  // F3: https://127.0.0.1/x.png
  out['F3-loopback-127'] = {
    kind: 'error',
    result: await captureImageLoadError('https://127.0.0.1/x.png'),
  }
  // F4: AWS IMDS
  out['F4-aws-imds'] = {
    kind: 'error',
    result: await captureImageLoadError('https://169.254.169.254/latest/meta-data/'),
  }
  // F5: [::1]
  out['F5-ipv6-loopback'] = {
    kind: 'error',
    result: await captureImageLoadError('https://[::1]/x.png'),
  }
  // F6: IPv4-mapped IPv6 dotted
  out['F6-ipv4-mapped-dotted'] = {
    kind: 'error',
    result: await captureImageLoadError('https://[::ffff:127.0.0.1]/x.png'),
  }
  // F7: IPv4-mapped IPv6 hex
  out['F7-ipv4-mapped-hex'] = {
    kind: 'error',
    result: await captureImageLoadError('https://[::ffff:7f00:1]/x.png'),
  }
  // F8: RFC1918 10.x
  out['F8-rfc1918-10'] = {
    kind: 'error',
    result: await captureImageLoadError('https://10.0.0.1/x.png'),
  }
  // F9: RFC1918 172.16
  out['F9-rfc1918-172'] = {
    kind: 'error',
    result: await captureImageLoadError('https://172.16.0.1/x.png'),
  }
  // F10: RFC1918 192.168
  out['F10-rfc1918-192'] = {
    kind: 'error',
    result: await captureImageLoadError('https://192.168.1.1/x.png'),
  }
  // F11: CGNAT 100.64
  out['F11-cgnat'] = {
    kind: 'error',
    result: await captureImageLoadError('https://100.64.0.1/x.png'),
  }
  // F12: IPv6 ULA fc00::
  out['F12-ipv6-ula'] = {
    kind: 'error',
    result: await captureImageLoadError('https://[fc00::1]/x.png'),
  }
  // F13: IPv6 link-local fe80::
  out['F13-ipv6-link-local'] = {
    kind: 'error',
    result: await captureImageLoadError('https://[fe80::1]/x.png'),
  }
  // F14: plaintext http://
  out['F14-plaintext-http'] = {
    kind: 'error',
    result: await captureImageLoadError('http://example.com/x.png'),
  }
  // F15: data: URL
  out['F15-data-url'] = {
    kind: 'error',
    result: await captureImageLoadError('data:image/png;base64,iVBORw0KGgo='),
  }
  // F16: javascript:
  out['F16-javascript'] = {
    kind: 'error',
    result: await captureImageLoadError('javascript:alert(1)'),
  }
  // F17: ftp://
  out['F17-ftp'] = {
    kind: 'error',
    result: await captureImageLoadError('ftp://example.com/x.png'),
  }
  // F18: invalid URL
  out['F18-invalid-url'] = {
    kind: 'error',
    result: await captureImageLoadError('https://[bad'),
  }

  // F19: 302 → http://127.0.0.1/y.png caught at redirect
  {
    const server = await startRedirectServer((_req, res) => {
      res.writeHead(302, { Location: 'http://127.0.0.1:1/private' })
      res.end()
    })
    try {
      out['F19-redirect-to-loopback'] = {
        kind: 'error',
        result: await captureImageLoadError(server.url('/start')),
      }
    } finally { await server.close() }
  }
  // F20: 302 chain >3 hops
  {
    let hops = 0
    const server = await startRedirectServer((_req, res) => {
      hops++
      // Always redirect back to self so MAX_REDIRECTS triggers
      const self = (res.req.socket.address() as AddressInfo)
      res.writeHead(302, { Location: `http://127.0.0.1:${self.port}/h${hops}` })
      res.end()
    })
    try {
      out['F20-redirect-chain-too-many'] = {
        kind: 'error',
        result: await captureImageLoadError(server.url('/start')),
      }
    } finally { await server.close() }
  }
  // F21: 302 with no Location header
  {
    const server = await startRedirectServer((_req, res) => {
      res.writeHead(302)
      res.end()
    })
    try {
      out['F21-redirect-no-location'] = {
        kind: 'error',
        result: await captureImageLoadError(server.url('/start')),
      }
    } finally { await server.close() }
  }

  // F22: SVG src=file:///etc/passwd no allowedFileDirs
  out['F22-svg-file-passwd'] = {
    kind: 'error',
    result: await captureSvgLoadError({ src: 'file:///etc/passwd' }),
  }
  // F23: Watermark image /etc/passwd no allowedFileDirs
  out['F23-watermark-passwd'] = {
    kind: 'error',
    result: await captureWatermarkImageError('/etc/passwd'),
  }
  // F24: SVG <script> sanitized
  {
    const sanitize = await getSanitizer()
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect/></svg>'
    const cleaned = sanitize(input)
    out['F24-svg-script-stripped'] = {
      kind: 'sanitize',
      result: { scriptStripped: !/<script/i.test(cleaned) },
    }
  }

  // MA-1: decimal IPv4 for 127.0.0.1
  out['MA1-decimal-ipv4'] = {
    kind: 'error',
    result: await captureImageLoadError('https://2130706433/x.png'),
  }
  // MA-2: octal first octet
  out['MA2-octal-ipv4'] = {
    kind: 'error',
    result: await captureImageLoadError('https://0177.0.0.1/x.png'),
  }
  // MA-3: whitespace-padded URL — string is not http(s)-prefixed → path branch → PATH_TRAVERSAL
  out['MA3-whitespace-padded'] = {
    kind: 'error',
    result: await captureImageLoadError('  https://127.0.0.1/x.png  '),
  }
  // MA-4: SVG <foreignObject>
  {
    const sanitize = await getSanitizer()
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">XSS</div></foreignObject></svg>'
    const cleaned = sanitize(input)
    out['MA4-svg-foreignObject'] = {
      kind: 'sanitize',
      result: { foreignObjectStripped: !/<foreignObject/i.test(cleaned) },
    }
  }
  // MA-5: SVG <a xlink:href="javascript:...">
  {
    const sanitize = await getSanitizer()
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><a xlink:href="javascript:alert(1)"><text>click</text></a></svg>'
    const cleaned = sanitize(input)
    out['MA5-svg-javascript-href'] = {
      kind: 'sanitize',
      result: { javascriptHrefStripped: !/javascript:/i.test(cleaned) },
    }
  }
  // MA-6: Mixed valid Uint8Array + SSRF target multi-asset — should not crash
  {
    // 1x1 transparent PNG
    const validPng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ])
    let firstSucceeded = false
    let secondCaptured: CapturedError | null = null
    try {
      await render({
        content: [
          { type: 'image', src: validPng, format: 'png', width: 10, height: 10 } as any,
          { type: 'image', src: 'https://127.0.0.1/evil.png', width: 10, height: 10 } as any,
        ],
        onImageLoadError: (_src: unknown, err: Error) => {
          secondCaptured = extractError(err)
          return 'skip'
        },
      } as any)
      firstSucceeded = true
    } catch (err) {
      secondCaptured = extractError(err)
    }
    out['MA6-mixed-valid-and-ssrf'] = {
      kind: 'mixed',
      result: { firstSucceeded, secondCaptured },
    }
  }

  // NAT64-1: RFC 6052 well-known prefix synthesizing 127.0.0.1 — must be
  // blocked at IP-literal time (no DNS) because 64:ff9b::7f00:1 is just
  // 127.0.0.1 in IPv6 dress.
  out['NAT64-1-rfc6052-loopback'] = {
    kind: 'error',
    result: await captureImageLoadError('https://[64:ff9b::7f00:1]/x.png'),
  }
  // NAT64-2: RFC 6052 well-known prefix synthesizing 10.0.0.1 (RFC1918) —
  // any embedded IPv4 in 64:ff9b::/96 must be refused.
  out['NAT64-2-rfc6052-rfc1918'] = {
    kind: 'error',
    result: await captureImageLoadError('https://[64:ff9b::a00:1]/x.png'),
  }
  // NAT64-3: RFC 8215 local-use prefix — 64:ff9b:1::/48. Different /48 but
  // identical threat class.
  out['NAT64-3-rfc8215-local-use'] = {
    kind: 'error',
    result: await captureImageLoadError('https://[64:ff9b:1::1]/x.png'),
  }
  // NAT64-4: any-private-is-private semantics for DNS lookup. Stub the DNS
  // module to return BOTH a public AAAA and a private A so we can prove
  // the dual-stack split-horizon attack is closed. Mocking node:dns is
  // intrusive; instead use a hostname literal trick — `*.localhost` resolves
  // to 127.0.0.1 on most platforms (RFC 6761) so the resolver delivers a
  // single private address that the all-addresses iteration then rejects.
  // This is the closest single-process probe we can do without spawning a
  // local resolver.
  out['NAT64-4-multi-address-any-private'] = {
    kind: 'error',
    result: await captureImageLoadError('https://anything.localhost/x.png'),
  }

  return out
}

test('assets.ts split tripwire — 34 fixtures, bit-exact behavior preservation (v1.6.0 commits 1/16 → 16/16 + v1.7.1 NAT64)', async () => {
  const captured = await captureAllFixtures()
  const fixtureCount = Object.keys(captured).length
  assert.equal(fixtureCount, 34, `Expected 34 fixtures, got ${fixtureCount}`)

  if (!existsSync(BASELINE) || process.env['UPDATE_SNAPSHOT'] === '1') {
    writeFileSync(BASELINE, JSON.stringify(captured, null, 2) + '\n', 'utf8')
    console.log(`[tripwire] Wrote baseline: ${BASELINE}`)
    return
  }

  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, FixtureResult>

  const capturedKeys = Object.keys(captured).sort()
  const baselineKeys = Object.keys(baseline).sort()
  assert.deepEqual(
    capturedKeys,
    baselineKeys,
    'Tripwire fixture set drifted from baseline — regenerate with UPDATE_SNAPSHOT=1 if intentional',
  )

  for (const name of capturedKeys) {
    assert.deepEqual(
      captured[name],
      baseline[name],
      `Tripwire drift for fixture "${name}". Run UPDATE_SNAPSHOT=1 to regenerate if change is intentional.`,
    )
  }
})
