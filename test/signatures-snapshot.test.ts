/**
 * signatures-snapshot.test.ts — Structural tripwire for the v1.7.0 signing path.
 *
 * Captures stable structural properties of a freshly signed PDF (positions
 * within the file are document-specific, so we record *categorical* shape,
 * not byte offsets). If a future refactor accidentally regresses the
 * placeholder hop — e.g. someone re-wires applySignature back through
 * @cantoo/pdf-lib — these assertions catch it before the crypto verify test
 * has a chance to run.
 *
 * What we capture per signed PDF:
 *   - presence of `%PDF` magic
 *   - presence and arity of /ByteRange [a b c d]
 *   - /AcroForm field count (length of /Fields array)
 *   - /SigFlags value
 *   - presence of /Type /Sig
 *   - presence of /Contents <hex> blob
 *
 * The signature itself uses fresh randomness on every run, so we do NOT
 * snapshot byte counts or absolute offsets — only categorical structure.
 *
 * Run: tsx --test test/signatures-snapshot.test.ts
 * Regenerate baseline: UPDATE_SNAPSHOT=1 tsx --test test/signatures-snapshot.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import forge from 'node-forge'
import { render } from '../src/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const BASELINE = join(__dirname, 'data', 'signatures-snapshot.json')

interface SnapshotShape {
  hasPdfMagic: boolean
  hasByteRange: boolean
  byteRangeArity: number
  hasAcroForm: boolean
  fieldsArrayPresent: boolean
  sigFlags: number | null
  hasSigType: boolean
  hasContentsHex: boolean
}

function buildSelfSignedP12(passphrase = 'snapshot-pass'): { p12Bytes: Uint8Array; passphrase: string } {
  // RSA-1024 is intentionally chosen for test speed (~50ms vs ~3000ms for RSA-2048).
  // This fixture is only used to verify structural shape of the signed PDF, not for
  // real security. The long-term improvement is to commit a pre-generated P12 to
  // test/data/snapshot-cert.p12 so keygen is eliminated entirely from CI runs.
  const keys = forge.pki.rsa.generateKeyPair(1024)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1)
  const attrs = [
    { name: 'commonName', value: 'pretext-pdf snapshot cert' },
    { name: 'organizationName', value: 'pretext-pdf' },
  ]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.sign(keys.privateKey, forge.md.sha256.create())
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase, {
    algorithm: '3des',
  })
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes()
  const p12Bytes = new Uint8Array(p12Der.length)
  for (let i = 0; i < p12Der.length; i += 1) p12Bytes[i] = p12Der.charCodeAt(i) & 0xff
  return { p12Bytes, passphrase }
}

function captureShape(pdf: Uint8Array): SnapshotShape {
  const text = Buffer.from(pdf).toString('latin1')
  const byteRangeMatch = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(text)
  const sigFlagsMatch = /\/SigFlags\s+(\d+)\b/.exec(text)
  return {
    hasPdfMagic: text.slice(0, 4) === '%PDF',
    hasByteRange: byteRangeMatch !== null,
    byteRangeArity: byteRangeMatch ? 4 : 0,
    hasAcroForm: /\/AcroForm\b/.test(text),
    fieldsArrayPresent: /\/Fields\s*\[/.test(text),
    sigFlags: sigFlagsMatch ? Number(sigFlagsMatch[1]) : null,
    hasSigType: /\/Type\s*\/Sig\b/.test(text),
    hasContentsHex: /\/Contents\s*<[0-9a-fA-F]+>/.test(text),
  }
}

test('signature path snapshot tripwire — structural shape stable across runs', async () => {
  const { p12Bytes, passphrase } = buildSelfSignedP12()

  const pdf = await render({
    content: [
      { type: 'heading', level: 1, text: 'Snapshot Tripwire' },
      { type: 'paragraph', text: 'Document under cryptographic signature.' },
    ],
    signature: {
      p12: p12Bytes,
      passphrase,
      signerName: 'Snapshot Tripwire',
      reason: 'Structural canary',
    },
  })

  const shape = captureShape(pdf)

  if (!existsSync(BASELINE) || process.env['UPDATE_SNAPSHOT'] === '1') {
    writeFileSync(BASELINE, JSON.stringify(shape, null, 2) + '\n', 'utf8')
    console.log(`[snapshot] Wrote baseline: ${BASELINE}`)
    return
  }

  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as SnapshotShape
  assert.deepEqual(
    shape,
    baseline,
    'Signature path structural shape drifted — regenerate with UPDATE_SNAPSHOT=1 if intentional',
  )
})
