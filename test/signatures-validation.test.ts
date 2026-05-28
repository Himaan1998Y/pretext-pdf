import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as path from 'node:path'
import { render } from '../src/index.js'
import { PretextPdfError } from '../src/errors.js'

const minDoc = (sig: any) => ({
  signature: sig,
  content: [{ type: 'paragraph' as const, text: 'Contract document.' }],
})

test('Phase 3 — Cryptographic Digital Signatures', async (t) => {

  await t.test('visual-only signature (no p12) still renders valid PDF', async () => {
    const pdf = await render(minDoc({ signerName: 'Alice', reason: 'Approved' }))
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
  })

  await t.test('signature.p12 as empty string throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render(minDoc({ p12: '' })),
      (err: any) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        assert.match(err.message, /p12/)
        return true
      }
    )
  })

  await t.test('signature.p12 as invalid type throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render(minDoc({ p12: 42 as any })),
      (err: any) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  await t.test('signature.passphrase as non-string throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render(minDoc({ p12: new Uint8Array([1, 2, 3]), passphrase: 99 as any })),
      (err: any) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        assert.match(err.message, /passphrase/)
        return true
      }
    )
  })

  await t.test('signature.contactInfo as non-string throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render(minDoc({ p12: new Uint8Array([1]), contactInfo: 123 as any })),
      (err: any) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        assert.match(err.message, /contactInfo/)
        return true
      }
    )
  })

  await t.test('p12 + encryption together throws SIGNATURE_CERT_AND_ENCRYPTION', async () => {
    await assert.rejects(
      () => render({
        signature: { p12: new Uint8Array([1, 2, 3]) },
        encryption: { userPassword: 'pass' },
        content: [{ type: 'paragraph' as const, text: 'test' }],
      }),
      (err: any) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'SIGNATURE_CERT_AND_ENCRYPTION')
        assert.match(err.message, /encryption/)
        return true
      }
    )
  })

  await t.test('non-existent p12 file path throws SIGNATURE_P12_LOAD_FAILED or SIGNATURE_DEP_MISSING', async () => {
    await assert.rejects(
      () => render({
        ...minDoc({ p12: path.resolve('/tmp/__nonexistent_cert_pretext_test_abc123__.p12') }),
        allowedFileDirs: [path.resolve('/tmp')],
      }),
      (err: any) => {
        assert.ok(err instanceof PretextPdfError, `Expected PretextPdfError, got: ${err?.constructor?.name}`)
        assert.ok(
          err.code === 'SIGNATURE_P12_LOAD_FAILED' || err.code === 'SIGNATURE_DEP_MISSING',
          `Expected SIGNATURE_P12_LOAD_FAILED or SIGNATURE_DEP_MISSING, got: ${err.code}`
        )
        return true
      }
    )
  })

  await t.test('p12 as invalid cert bytes throws an error', async () => {
    // Invalid P12 bytes cause an error — could be PretextPdfError or TypeError from @signpdf
    // The important thing is that invalid bytes don't silently pass
    await assert.rejects(
      () => render(minDoc({ p12: new Uint8Array([0x30, 0x82, 0x01, 0x00]) }))
    )
  })

  await t.test('signing fields with parentheses must not appear as unescaped PDF literal strings (injection guard)', async () => {
    // PDF literal strings use `(` and `)` as delimiters. If reason/location/signerName
    // contain unescaped parens, the PDF dict is malformed and an attacker could inject
    // synthetic dict entries (e.g. `/Author (injected)` inside a reason field).
    // The escapePdfLit fix in post-process.ts escapes `\`, `(`, `)` before
    // passing values to pdflibAddPlaceholder. This test verifies the escaping holds.
    const reason = 'Approved (Q1 2026)'
    const location = 'New York (USA)'
    const signerName = 'Alice (Smith)'
    const doc = {
      signature: { signerName, reason, location },
      content: [{ type: 'paragraph' as const, text: 'Contract.' }],
    }
    const pdf = await render(doc as any)
    assert.ok(pdf instanceof Uint8Array && pdf.length > 0)

    const bytes = new TextDecoder('latin1').decode(pdf)

    // Raw unescaped parenthesized form must NOT appear in the byte stream.
    // If present, it means the inner parens are unescaped and break PDF structure.
    assert.ok(
      !bytes.includes(`(${reason})`),
      `reason must not appear as unescaped PDF literal — found raw "(${reason})" in bytes`
    )
    assert.ok(
      !bytes.includes(`(${location})`),
      `location must not appear as unescaped PDF literal — found raw "(${location})" in bytes`
    )
    assert.ok(
      !bytes.includes(`(${signerName})`),
      `signerName must not appear as unescaped PDF literal — found raw "(${signerName})" in bytes`
    )
  })

})
