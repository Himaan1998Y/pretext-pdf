import { test } from 'node:test'
import assert from 'node:assert'
import { render } from '../dist/index.js'
import type { PdfDocument } from '../dist/types.js'

test('Phase 7G — Encryption', async (t) => {
  // ─────────────────────────────────────────────────────────────────────────
  // Test 1: Encryption with userPassword produces PDF containing /Encrypt marker
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('encryption with userPassword produces PDF containing /Encrypt marker', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      encryption: { userPassword: 'secret123' },
      content: [
        { type: 'paragraph', text: 'This document is encrypted.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)

    // Check for /Encrypt marker in PDF trailer
    const pdfString = Buffer.from(pdf).toString('latin1')
    assert(pdfString.includes('/Encrypt'), 'Encrypted PDF should contain /Encrypt marker')

    // Verify PDF header
    const header = Buffer.from(pdf.slice(0, 4)).toString('ascii')
    assert.strictEqual(header, '%PDF')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: Encryption with no userPassword (permissions only) produces /Encrypt marker
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('encryption with no userPassword (permissions only) produces /Encrypt marker', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      encryption: { permissions: { printing: false, copying: false } },
      content: [
        { type: 'paragraph', text: 'Document with restricted permissions.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)

    const pdfString = Buffer.from(pdf).toString('latin1')
    assert(pdfString.includes('/Encrypt'), 'Encrypted PDF with permissions should contain /Encrypt marker')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3: ownerPassword empty string throws VALIDATION_ERROR
  // ─────────────────────────────────────────────────────────────────────────
  await t.test("ownerPassword empty string throws VALIDATION_ERROR", async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      encryption: { ownerPassword: '' as any },
      content: [
        { type: 'paragraph', text: 'Test content.' },
      ],
    }

    try {
      await render(doc)
      assert.fail('Should have thrown VALIDATION_ERROR')
    } catch (err: any) {
      assert.strictEqual(err.code, 'VALIDATION_ERROR')
      assert.match(err.message, /ownerPassword/)
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 4: permissions.printing = false renders without error
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('permissions.printing = false renders without error', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      encryption: { userPassword: 'test', permissions: { printing: false } },
      content: [
        { type: 'paragraph', text: 'Document with printing disabled.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)

    const pdfString = Buffer.from(pdf).toString('latin1')
    assert(pdfString.includes('/Encrypt'), 'Should be encrypted')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 5: permissions.modifying = true renders without error
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('permissions.modifying = true renders without error', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      encryption: { permissions: { modifying: true } },
      content: [
        { type: 'paragraph', text: 'Document allowing modifications.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)

    const pdfString = Buffer.from(pdf).toString('latin1')
    assert(pdfString.includes('/Encrypt'), 'Should be encrypted')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 6: Encrypted PDF is valid (starts with %PDF)
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('encrypted PDF is valid (starts with %PDF)', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      encryption: { userPassword: 'mypassword', ownerPassword: 'admin' },
      content: [
        { type: 'heading', level: 1, text: 'Encrypted Document' },
        { type: 'paragraph', text: 'This PDF is password protected.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)

    const header = Buffer.from(pdf.slice(0, 4)).toString('ascii')
    assert.strictEqual(header, '%PDF', 'Encrypted PDF should still have valid PDF header')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 7: Regression — document without encryption field renders normally (no /Encrypt marker)
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('regression: document without encryption field renders normally (no /Encrypt marker)', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        { type: 'heading', level: 1, text: 'Unencrypted Document' },
        { type: 'paragraph', text: 'This document is not encrypted.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)

    const pdfString = Buffer.from(pdf).toString('latin1')
    assert(!pdfString.includes('/Encrypt'), 'Unencrypted PDF should not contain /Encrypt marker')

    const header = Buffer.from(pdf.slice(0, 4)).toString('ascii')
    assert.strictEqual(header, '%PDF')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 8: permissions.printing = false clears the printing permission bit in /P
  // PDF spec §7.6.4: /P is a 32-bit signed integer. Bit 3 (value 4) = PrintDocument.
  // When printing is false, bit 3 must be CLEAR in /P.
  // This test verifies that the /P value is encoded correctly — not just that
  // /Encrypt appears (which would pass even if all permissions were granted).
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('permissions.printing = false clears printing bit in /P flag', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      encryption: { userPassword: 'test', permissions: { printing: false, copying: false } },
      content: [{ type: 'paragraph', text: 'Restricted document.' }],
    }

    const pdf = await render(doc)
    const pdfString = Buffer.from(pdf).toString('latin1')

    // Extract /P value from /Encrypt dict. PDF spec: /P <integer>
    const pMatch = pdfString.match(/\/P\s+(-?\d+)/)
    assert.ok(pMatch, '/P permission flag must be present in /Encrypt dict')

    const P = parseInt(pMatch![1]!, 10)
    // Bit 3 (0-indexed from 1 per PDF spec) = value 4 = PrintDocument permission.
    // When printing is DISABLED, bit 3 must be CLEAR (i.e., P & 4 === 0).
    assert.strictEqual(
      P & 4, 0,
      `Expected printing bit (bit 3) to be clear in /P=${P} when printing:false`
    )
    // Bit 5 (value 16) = CopyContent permission.
    // When copying is DISABLED, bit 5 must be CLEAR.
    assert.strictEqual(
      P & 16, 0,
      `Expected copying bit (bit 5) to be clear in /P=${P} when copying:false`
    )
  })
})
