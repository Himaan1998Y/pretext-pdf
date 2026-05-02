import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../dist/index.js'
import { PretextPdfError } from '../dist/index.js'

// ─── QR Code ──────────────────────────────────────────────────────────────────

test('Phase 10A — QR Code + Barcode', async (t) => {

  // ── QR Code validation ─────────────────────────────────────────────────────

  await t.test('qr-code: missing data throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render({ content: [{ type: 'qr-code', data: '' } as any] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  await t.test('qr-code: data over 2953 chars throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render({ content: [{ type: 'qr-code', data: 'a'.repeat(2954) } as any] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        assert.ok((err as PretextPdfError).message.includes('2953'))
        return true
      }
    )
  })

  await t.test('qr-code: invalid errorCorrectionLevel throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render({ content: [{ type: 'qr-code', data: 'test', errorCorrectionLevel: 'X' } as any] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  await t.test('qr-code: invalid foreground colour throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render({ content: [{ type: 'qr-code', data: 'test', foreground: 'red' } as any] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  await t.test('qr-code: invalid size throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render({ content: [{ type: 'qr-code', data: 'test', size: -10 } as any] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  await t.test('qr-code: renders URL as PDF', async () => {
    const pdf = await render({
      content: [{ type: 'qr-code', data: 'https://example.com/invoice/123' }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(Buffer.from(pdf.slice(0, 4)).toString('ascii'), '%PDF')
    assert.ok(pdf.byteLength > 1000)
  })

  await t.test('qr-code: renders with custom size and colours', async () => {
    const pdf = await render({
      content: [{
        type: 'qr-code',
        data: 'upi://pay?pa=test@upi&pn=Test&am=1000',
        size: 120,
        errorCorrectionLevel: 'H',
        foreground: '#1a1a2e',
        background: '#ffffff',
        align: 'center',
        spaceBefore: 12,
        spaceAfter: 12,
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(Buffer.from(pdf.slice(0, 4)).toString('ascii'), '%PDF')
  })

  await t.test('qr-code: renders alongside other elements', async () => {
    const pdf = await render({
      content: [
        { type: 'heading', level: 1, text: 'GST Invoice' },
        { type: 'paragraph', text: 'Scan QR to pay:' },
        { type: 'qr-code', data: 'upi://pay?pa=merchant@paytm&pn=Acme&am=5000', size: 80, align: 'right' },
        { type: 'paragraph', text: 'Thank you for your business.' },
      ],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(Buffer.from(pdf.slice(0, 4)).toString('ascii'), '%PDF')
  })

  // ── Barcode validation ─────────────────────────────────────────────────────

  await t.test('barcode: missing symbology throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render({ content: [{ type: 'barcode', symbology: '', data: '123456789012' } as any] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  await t.test('barcode: missing data throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render({ content: [{ type: 'barcode', symbology: 'ean13', data: '' } as any] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  await t.test('barcode: invalid width throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render({ content: [{ type: 'barcode', symbology: 'ean13', data: '123', width: 0 } as any] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  await t.test('barcode: EAN-13 renders as PDF', async () => {
    const pdf = await render({
      content: [{
        type: 'barcode',
        symbology: 'ean13',
        data: '5901234123457',
        width: 180,
        height: 60,
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(Buffer.from(pdf.slice(0, 4)).toString('ascii'), '%PDF')
    assert.ok(pdf.byteLength > 1000)
  })

  await t.test('barcode: Code128 renders as PDF', async () => {
    const pdf = await render({
      content: [{
        type: 'barcode',
        symbology: 'code128',
        data: 'INV-2026-0042',
        width: 200,
        height: 50,
        includeText: true,
        align: 'center',
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(Buffer.from(pdf.slice(0, 4)).toString('ascii'), '%PDF')
  })

  await t.test('barcode: PDF417 renders as PDF', async () => {
    const pdf = await render({
      content: [{
        type: 'barcode',
        symbology: 'pdf417',
        data: 'SHIPMENT-ID-20260419-ABCDEF',
        width: 220,
        height: 80,
        includeText: false,
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(Buffer.from(pdf.slice(0, 4)).toString('ascii'), '%PDF')
  })

  await t.test('barcode: unknown symbology throws BARCODE_SYMBOLOGY_INVALID', async () => {
    await assert.rejects(
      () => render({ content: [{ type: 'barcode', symbology: 'not-a-real-symbology', data: '123' }] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.ok(
          err.code === 'BARCODE_SYMBOLOGY_INVALID' || err.code === 'BARCODE_GENERATE_FAILED',
          `expected BARCODE_SYMBOLOGY_INVALID or BARCODE_GENERATE_FAILED, got ${err.code}`
        )
        return true
      }
    )
  })

  await t.test('barcode: renders alongside QR code in invoice layout', async () => {
    const pdf = await render({
      content: [
        { type: 'heading', level: 1, text: 'Product Label' },
        { type: 'paragraph', text: 'Scan barcode at checkout:' },
        { type: 'barcode', symbology: 'ean13', data: '5901234123457', width: 160, height: 50 },
        { type: 'spacer', height: 8 },
        { type: 'paragraph', text: 'Scan QR for product page:' },
        { type: 'qr-code', data: 'https://example.com/product/5901234123457', size: 80 },
      ],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(Buffer.from(pdf.slice(0, 4)).toString('ascii'), '%PDF')
  })
})
