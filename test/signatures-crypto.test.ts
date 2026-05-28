import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as path from 'node:path'
import * as crypto from 'node:crypto'
import forge from 'node-forge'
import { render } from '../src/index.js'
import { PretextPdfError } from '../src/errors.js'

/**
 * Build a self-signed RSA-2048 cert + P12 (PKCS#12) bundle in-memory for
 * cryptographic verification tests. Returns the P12 DER bytes and the
 * passphrase used to encrypt it.
 */
function buildSelfSignedP12(passphrase = 'test-pass'): { p12Bytes: Uint8Array; passphrase: string } {
  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1)
  const attrs = [
    { name: 'commonName', value: 'pretext-pdf test cert' },
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

test('Phase 9A — Cryptographic Signatures', async (t) => {

  await t.test('invisible: true skips visual signature box rendering', async () => {
    // Without invisible flag — visual box is drawn
    const withVisual = await render({
      content: [{ type: 'heading', level: 1, text: 'Document' }],
      signature: { signerName: 'John Doe', reason: 'Approval' }
    })

    // With invisible: true — no visual box, clean page
    const invisible = await render({
      content: [{ type: 'heading', level: 1, text: 'Document' }],
      signature: { invisible: true, signerName: 'John Doe', reason: 'Approval' }
    })

    // Invisible PDF should be smaller (no signature box rendering)
    assert.ok(invisible.byteLength < withVisual.byteLength, 'Invisible sig should produce smaller PDF')
    assert.equal(new TextDecoder().decode(invisible.slice(0, 4)), '%PDF')
  })

  await t.test('invisible: true without p12 also skips visual box', async () => {
    const pdf = await render({
      content: [
        { type: 'heading', level: 1, text: 'Confidential' },
        { type: 'paragraph', text: 'This document will be signed invisibly.' }
      ],
      signature: { invisible: true }
    })

    assert.ok(pdf instanceof Uint8Array)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
  })

  await t.test('invisible: true without p12 is valid', async () => {
    // Should not throw — invisible sig without p12 is valid
    const pdf = await render({
      content: [{ type: 'paragraph', text: 'Test' }],
      signature: { invisible: true, signerName: 'Alice' }
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  await t.test('signature.invisible must be a boolean', async () => {
    await assert.rejects(
      () => render({
        content: [{ type: 'paragraph', text: 'Test' }],
        signature: { invisible: 'yes' } as any
      }),
      (err: any) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        assert.match(err.message, /boolean/)
        return true
      }
    )
  })

  await t.test('SIGNATURE_P12_LOAD_FAILED with non-existent absolute path', async () => {
    await assert.rejects(
      () => render({
        content: [{ type: 'paragraph', text: 'Test' }],
        allowedFileDirs: [path.resolve('/nonexistent/path/to')],
        signature: { p12: path.resolve('/nonexistent/path/to/cert.p12'), passphrase: 'test' }
      }),
      (err: any) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'SIGNATURE_P12_LOAD_FAILED')
        return true
      }
    )
  })

  await t.test('SIGNATURE_P12_LOAD_FAILED with relative path', async () => {
    // After fix: relative path should throw SIGNATURE_P12_LOAD_FAILED (not SIGNATURE_FAILED)
    await assert.rejects(
      () => render({
        content: [{ type: 'paragraph', text: 'Test' }],
        allowedFileDirs: [path.resolve(process.cwd(), 'relative')],
        signature: { p12: 'relative/cert.p12', passphrase: 'test' }
      }),
      (err: any) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'SIGNATURE_P12_LOAD_FAILED', 'Relative path should be SIGNATURE_P12_LOAD_FAILED')
        return true
      }
    )
  })

  await t.test('corrupt P12 bytes cause signing error', async () => {
    // Corrupt P12 (just random bytes) should fail during signing
    // The error may be SIGNATURE_FAILED or SIGNATURE_DEP_MISSING depending on @signpdf state
    await assert.rejects(
      () => render({
        content: [{ type: 'paragraph', text: 'Test' }],
        signature: { p12: new Uint8Array([1, 2, 3, 4, 5]), passphrase: 'test' }
      })
    )
  })

  await t.test('signing with encryption together throws SIGNATURE_CERT_AND_ENCRYPTION', async () => {
    await assert.rejects(
      () => render({
        content: [{ type: 'paragraph', text: 'Test' }],
        signature: { p12: new Uint8Array([1, 2, 3, 4, 5]) },
        encryption: { userPassword: 'test' }
      }),
      (err: any) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'SIGNATURE_CERT_AND_ENCRYPTION')
        assert.match(err.message, /signature.*encryption|encryption.*signature/i)
        return true
      }
    )
  })

  await t.test('invisible-only signature: renders without p12, no crypto deps needed', async () => {
    // invisible: true without p12 draws no visual box and triggers no cryptographic
    // signing — the PDF is returned as-is. This path exercises the early-exit guard
    // in applySignature (sig.p12 is undefined → skip signing entirely).
    const pdf = await render({
      content: [{ type: 'paragraph', text: 'Invisible-only signature document.' }],
      signature: { invisible: true },
    })
    assert.ok(pdf instanceof Uint8Array, 'render must return Uint8Array')
    assert.ok(pdf.length > 100, 'PDF must have non-trivial size')
    // Invisible-only: no ByteRange dict (no PKCS#7 signing happened)
    const text = Buffer.from(pdf).toString('latin1')
    assert.ok(!/\/ByteRange/.test(text), 'invisible-only PDF must NOT contain a /ByteRange dict')
  })

  await t.test('P12 signature verifies cryptographically (real CMS verify)', async () => {
    // Build a self-signed P12 in-memory and sign a real document with it.
    const { p12Bytes, passphrase } = buildSelfSignedP12('crypto-verify-pass')

    const pdfU8 = await render({
      content: [
        { type: 'heading', level: 1, text: 'Cryptographically Signed' },
        { type: 'paragraph', text: 'This PDF should produce a valid CMS signature.' },
      ],
      signature: {
        p12: p12Bytes,
        passphrase,
        signerName: 'Crypto Verify',
        reason: 'CMS Verification Test',
      },
    })
    const pdf = Buffer.from(pdfU8)
    assert.equal(new TextDecoder().decode(pdfU8.slice(0, 4)), '%PDF')

    // Locate /ByteRange [a b c d] — written by signpdf into the signed PDF.
    const byteRangeMatch = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(
      pdf.toString('latin1')
    )
    assert.ok(byteRangeMatch, '/ByteRange must be present in signed PDF')
    const [a, b, c, d] = byteRangeMatch.slice(1, 5).map(Number)

    // Concatenate the two signed ranges (everything except the /Contents <hex> blob).
    const signedRange = Buffer.concat([pdf.subarray(a, a + b), pdf.subarray(c, c + d)])

    // Extract the hex /Contents blob: it lives between byte offsets a+b and c
    // (excluding the surrounding '<' and '>' brackets, and trailing 00 padding).
    const contentsHex = pdf
      .subarray(a + b, c)
      .toString('latin1')
      .replace(/^[^<]*</, '')
      .replace(/>[^>]*$/, '')
      .replace(/(?:00)+$/, '')
    assert.ok(contentsHex.length > 0, '/Contents hex blob must not be empty')
    const cmsDer = Buffer.from(contentsHex, 'hex')
    assert.ok(cmsDer.length > 0, 'CMS DER must decode from hex')

    // Parse CMS SignedData via node-forge.
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(cmsDer.toString('binary')))
    const p7 = forge.pkcs7.messageFromAsn1(asn1) as forge.pkcs7.PkcsSignedData
    assert.ok(p7.certificates && p7.certificates.length > 0, 'CMS must contain at least one cert')
    assert.ok(p7.rawCapture && (p7.rawCapture as any).signature, 'CMS must contain signer signature bytes')

    // Pull signer cert + signature bytes + algorithm.
    const signerCert = p7.certificates[0]
    const signerPubKey = forge.pki.publicKeyToPem(signerCert.publicKey)
    const sigBinary = (p7.rawCapture as any).signature as string
    const signatureBytes = Buffer.from(sigBinary, 'binary')

    // Determine the digest algorithm. signpdf defaults to RSA-SHA256.
    // Decode signer info digest algorithm OID; fall back to SHA-256.
    const digestAlgOid = (p7.rawCapture as any).digestAlgorithm
      ? forge.asn1.derToOid((p7.rawCapture as any).digestAlgorithm)
      : forge.pki.oids.sha256
    const oidToHash: Record<string, string> = {
      [forge.pki.oids.sha256]: 'RSA-SHA256',
      [forge.pki.oids.sha384]: 'RSA-SHA384',
      [forge.pki.oids.sha512]: 'RSA-SHA512',
      [forge.pki.oids.sha1]: 'RSA-SHA1',
    }
    const verifyAlgo = oidToHash[digestAlgOid] || 'RSA-SHA256'

    // CMS attached/detached: signpdf produces signed attributes (authenticatedAttributes).
    // When present, the signature is over the DER-encoded SET of authenticatedAttributes,
    // not the raw signedRange. Detect and verify accordingly.
    const authAttrs = (p7.rawCapture as any).authenticatedAttributes as any[] | undefined
    let dataToVerify: Buffer
    if (authAttrs && authAttrs.length > 0) {
      // Re-encode authenticatedAttributes as a SET (tag 0x31), per RFC 5652 §5.4.
      const set = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, authAttrs)
      const der = forge.asn1.toDer(set).getBytes()
      dataToVerify = Buffer.from(der, 'binary')

      // Sanity check: the messageDigest attribute inside authAttrs must equal the
      // hash of signedRange, proving the CMS attests to our signed bytes.
      const expectedDigest = crypto.createHash('sha256').update(signedRange).digest()
      const mdAttr = authAttrs.find((attr: any) => {
        const oid = forge.asn1.derToOid(attr.value[0].value)
        return oid === forge.pki.oids.messageDigest
      })
      assert.ok(mdAttr, 'messageDigest signed attribute must be present')
      const mdValue = Buffer.from(mdAttr.value[1].value[0].value, 'binary')
      assert.deepEqual(mdValue, expectedDigest, 'messageDigest must equal SHA-256(signedRange)')
    } else {
      dataToVerify = signedRange
    }

    // Positive verification.
    const okVerifier = crypto.createVerify(verifyAlgo)
    okVerifier.update(dataToVerify)
    const verified = okVerifier.verify(signerPubKey, signatureBytes)
    assert.equal(verified, true, 'CMS signature must verify against signer public key')

    // Negative test: mutate one byte of the signed range. When authAttrs are
    // used, mutate the messageDigest input (signedRange) and recompute — the
    // signature over the *original* authAttrs should no longer match a freshly
    // computed messageDigest. We verify by mutating dataToVerify directly,
    // which is what the verifier actually checks.
    const tampered = Buffer.from(dataToVerify)
    tampered[Math.floor(tampered.length / 2)] ^= 0xff
    const badVerifier = crypto.createVerify(verifyAlgo)
    badVerifier.update(tampered)
    const tamperedVerified = badVerifier.verify(signerPubKey, signatureBytes)
    assert.equal(tamperedVerified, false, 'Tampered data must NOT verify')

    // AcroForm regression assertion — any valid signed PDF must carry an
    // AcroForm dict with at least one signature field, SigFlags=3 (SignaturesExist
    // | AppendOnly), and a Sig object. If commit 1's placeholder swap loses
    // any of these, this assertion is the canary.
    const pdfText = pdf.toString('latin1')
    assert.match(pdfText, /\/AcroForm\b/, 'Signed PDF must contain an /AcroForm dict')
    assert.match(pdfText, /\/SigFlags\s+3\b/, 'AcroForm must declare /SigFlags 3')
    assert.match(pdfText, /\/Type\s*\/Sig\b/, 'Signed PDF must contain a /Type /Sig object')
    assert.match(pdfText, /\/Fields\s*\[/, 'AcroForm must contain a /Fields array')
  })

  await t.test('multi-section document with top-level signature renders all sections without suppressing signature', async () => {
    // Verifies that a document with multiple headings and paragraphs correctly
    // renders the visual signature placeholder alongside the content.
    // (The schema supports only one top-level signature per document; this test
    // ensures complex content layout doesn't suppress or corrupt the sig field.)
    // Note: /Type /Sig only appears when a P12 cert is provided (crypto signing).
    // Visual-only signatures produce a rendered box and an /AcroForm catalog entry.
    const pdf = await render({
      content: [
        { type: 'heading', level: 1, text: 'Section 1' },
        { type: 'paragraph', text: 'Some content' },
        { type: 'heading', level: 1, text: 'Section 2' },
        { type: 'paragraph', text: 'More content' }
      ],
      signature: { signerName: 'Authorized Signer', page: 0 }
    })

    assert.ok(pdf instanceof Uint8Array && pdf.length > 0)
    const pdfText = Buffer.from(pdf).toString('latin1')
    // AcroForm catalog entry must be present (required by PDF spec for sig widgets)
    assert.match(pdfText, /\/AcroForm\b/, 'multi-section signed PDF must contain /AcroForm catalog entry')
    // Bookmark outline must exist — confirms both headings were laid out
    // (outlines are only emitted when headings exist in the content)
    assert.match(pdfText, /\/Type\s*\/Outlines\b/, 'signed PDF with headings must contain /Outlines entry')
    // Section 1 bookmark title: UTF-16BE hex for "Section 1" = 0053 0065 006300740069006F006E 0020 0031
    assert.ok(pdfText.includes('006E00200031'), 'Section 1 heading must appear in PDF bookmark outline')
  })

})
