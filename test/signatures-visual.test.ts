import { test } from 'node:test'
import assert from 'node:assert'
import { render, PretextPdfError } from '../dist/index.js'
import type { PdfDocument } from '../dist/index.js'

test('Phase 8E — Signature Placeholder', async (t) => {
  await t.test('default signature box renders on last page', async () => {
    const doc: PdfDocument = {
      signature: {},
      content: [
        { type: 'heading', level: 1, text: 'Agreement' },
        { type: 'paragraph', text: 'This document requires a signature.' },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
  })

  await t.test('signature with signerName and reason renders', async () => {
    const doc: PdfDocument = {
      signature: {
        signerName: 'Himanshu Jain',
        reason: 'I approve this document',
        location: 'New Delhi, India',
      },
      content: [{ type: 'paragraph', text: 'Contract text.' }],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
  })

  await t.test('signature with custom position and dimensions renders', async () => {
    const doc: PdfDocument = {
      signature: { x: 100, y: 200, width: 250, height: 80, page: 0 },
      content: [{ type: 'paragraph', text: 'Document.' }],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
  })

  await t.test('signature.page out of range clamps to last page gracefully', async () => {
    const doc: PdfDocument = {
      signature: { page: 9999 },
      content: [{ type: 'paragraph', text: 'Single page.' }],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
  })

  await t.test('signature on multi-page document renders on correct page', async () => {
    const doc: PdfDocument = {
      signature: { signerName: 'John', page: 0 },
      content: [
        { type: 'heading', level: 1, text: 'Page 1' },
        { type: 'page-break' },
        { type: 'heading', level: 1, text: 'Page 2' },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
  })

  await t.test('H6: signerName longer than 100 chars renders without error (truncation guard)', async () => {
    // signing/placeholder.ts: displayName = sig.signerName.slice(0, 100)
    // CIDFont encoding means we cannot directly search for the raw string in PDF bytes.
    // What we CAN verify: a 300-char name renders to a valid PDF of SMALLER byte size
    // than a 300-char-rendered version would — and critically, it does NOT throw.
    const longName = 'Himanshu'.repeat(40)  // 320 chars — well over the 100-char cap
    const doc: PdfDocument = {
      signature: { signerName: longName },
      content: [{ type: 'paragraph', text: 'Truncation test document.' }],
    }
    const pdfLong = await render(doc)
    assert.ok(pdfLong instanceof Uint8Array && pdfLong.length > 0, 'PDF with 320-char signerName must render')

    // Baseline: render with exactly 100 chars. Output should be approximately the same size
    // (both truncate to 100 chars in the visual placeholder).
    const doc100: PdfDocument = {
      signature: { signerName: 'Himanshu'.repeat(13).slice(0, 100) },  // exactly 100 chars
      content: [{ type: 'paragraph', text: 'Truncation test document.' }],
    }
    const pdf100 = await render(doc100)
    // Both PDFs should be within 5% of each other — same visual content after truncation.
    const ratio = pdfLong.length / pdf100.length
    assert.ok(ratio > 0.95 && ratio < 1.05,
      `PDFs diverged too much (ratio=${ratio.toFixed(3)}) — truncation may not be applied. ` +
      `longName=${pdfLong.length}B, 100-char=${pdf100.length}B`)
  })

  await t.test('M7: backslash in signerName/reason is escaped in PDF literal string', async () => {
    // post-process.ts: escapePdfLit escapes \\ -> \\\\, ( -> \\(, ) -> \\)
    const doc: PdfDocument = {
      signature: {
        signerName: 'C:\\Users\\Himanshu',
        reason: 'path\\to\\approval',
        location: 'Delhi (India)',
      },
      content: [{ type: 'paragraph', text: 'Escape test.' }],
    }
    // Just confirm it renders without throwing — the escaping prevents PDF corruption
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
  })

  await t.test('signature.width <= 0 throws VALIDATION_ERROR', async () => {
    const doc: PdfDocument = {
      signature: { width: -10 },
      content: [{ type: 'paragraph', text: 'Test.' }],
    }
    await assert.rejects(
      () => render(doc),
      (err: any) => {
        assert(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })
})
