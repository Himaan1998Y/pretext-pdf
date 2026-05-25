/**
 * G5 — ErrorCode enum stability tripwire (v1.6.0 commit 2/16).
 *
 * G1 (assets-split-tripwire) captures the full { code, message } envelope
 * for each fixture. G5 narrows the lens to ONLY the ErrorCode enum value
 * for every security-path fixture, asserting a frozen mapping. Useful for
 * downstream consumers (pretext-pdf-mcp, integration tests) that switch on
 * error.code — they get a separate alarm independent of message wording.
 *
 * If you intentionally change an error code, update both this file and the
 * tripwire baseline in lockstep.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const TRIPWIRE_BASELINE = join(__dirname, 'data', 'assets-split-tripwire.json')

// Frozen contract — the error code that every security fixture in the
// tripwire must emit. Sanitize-kind fixtures are excluded (they have no code).
const EXPECTED_CODES: Record<string, string> = {
  'F1-file-passwd-no-allowedFileDirs':       'VALIDATION_ERROR',
  'F2-path-outside-allowedFileDirs':         'PATH_TRAVERSAL',
  'F3-loopback-127':                         'IMAGE_LOAD_FAILED',
  'F4-aws-imds':                             'IMAGE_LOAD_FAILED',
  'F5-ipv6-loopback':                        'IMAGE_LOAD_FAILED',
  'F6-ipv4-mapped-dotted':                   'IMAGE_LOAD_FAILED',
  'F7-ipv4-mapped-hex':                      'IMAGE_LOAD_FAILED',
  'F8-rfc1918-10':                           'IMAGE_LOAD_FAILED',
  'F9-rfc1918-172':                          'IMAGE_LOAD_FAILED',
  'F10-rfc1918-192':                         'IMAGE_LOAD_FAILED',
  'F11-cgnat':                               'IMAGE_LOAD_FAILED',
  'F12-ipv6-ula':                            'IMAGE_LOAD_FAILED',
  'F13-ipv6-link-local':                     'IMAGE_LOAD_FAILED',
  'F14-plaintext-http':                      'IMAGE_LOAD_FAILED',
  'F15-data-url':                            'VALIDATION_ERROR',
  'F16-javascript':                          'VALIDATION_ERROR',
  'F17-ftp':                                 'PATH_TRAVERSAL',
  'F18-invalid-url':                         'IMAGE_LOAD_FAILED',
  'F19-redirect-to-loopback':                'IMAGE_LOAD_FAILED',
  'F20-redirect-chain-too-many':             'IMAGE_LOAD_FAILED',
  'F21-redirect-no-location':                'IMAGE_LOAD_FAILED',
  'F22-svg-file-passwd':                     'VALIDATION_ERROR',
  'F23-watermark-passwd':                    'PATH_TRAVERSAL',
  'MA1-decimal-ipv4':                        'IMAGE_LOAD_FAILED',
  'MA2-octal-ipv4':                          'IMAGE_LOAD_FAILED',
  'MA3-whitespace-padded':                   'PATH_TRAVERSAL',
}

describe('G5 — ErrorCode enum stability across assets.ts split', () => {
  test('every security-path fixture emits the expected ErrorCode', () => {
    const baseline = JSON.parse(readFileSync(TRIPWIRE_BASELINE, 'utf8')) as Record<
      string,
      { kind: string; result: { errorCode?: string } }
    >

    for (const [fixture, expectedCode] of Object.entries(EXPECTED_CODES)) {
      const entry = baseline[fixture]
      assert.ok(entry, `fixture "${fixture}" missing from tripwire baseline`)
      assert.equal(entry.kind, 'error', `fixture "${fixture}" must be kind=error`)
      assert.equal(
        entry.result.errorCode,
        expectedCode,
        `fixture "${fixture}" expected code ${expectedCode}, got ${entry.result.errorCode}`,
      )
    }
  })

  test('MA6 mixed fixture: second asset emits IMAGE_LOAD_FAILED', () => {
    const baseline = JSON.parse(readFileSync(TRIPWIRE_BASELINE, 'utf8')) as Record<
      string,
      { kind: string; result: { secondCaptured?: { errorCode: string } } }
    >
    const entry = baseline['MA6-mixed-valid-and-ssrf']
    assert.ok(entry)
    assert.equal(entry.result.secondCaptured?.errorCode, 'IMAGE_LOAD_FAILED')
  })
})
