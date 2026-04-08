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
