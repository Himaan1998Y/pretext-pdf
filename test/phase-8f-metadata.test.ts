import { test } from 'node:test'
import assert from 'node:assert'
import { render, PretextPdfError } from '../dist/index.js'
import type { PdfDocument } from '../dist/index.js'

test('Phase 8F — Document Metadata Extensions', async (t) => {
  await t.test('metadata.language renders without error', async () => {
    const doc: PdfDocument = {
      metadata: { language: 'en-US' },
      content: [{ type: 'paragraph', text: 'Hello world.' }],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
  })

  await t.test('metadata.producer renders without error', async () => {
    const doc: PdfDocument = {
      metadata: { producer: 'MyApp v2.1' },
      content: [{ type: 'paragraph', text: 'Hello world.' }],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
  })

  await t.test('both language and producer render together', async () => {
    const doc: PdfDocument = {
      metadata: {
        title: 'Test Doc',
        author: 'Himanshu',
        language: 'hi',
        producer: 'pretext-pdf-test',
      },
      content: [
        { type: 'heading', level: 1, text: 'Document' },
        { type: 'paragraph', text: 'Content here.' },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
  })

  await t.test('empty language string throws VALIDATION_ERROR', async () => {
    const doc: PdfDocument = {
      metadata: { language: '' },
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

  await t.test('empty producer string throws VALIDATION_ERROR', async () => {
    const doc: PdfDocument = {
      metadata: { producer: '' },
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
