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
})
