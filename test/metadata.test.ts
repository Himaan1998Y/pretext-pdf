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

  await t.test('T7: metadata title/author/subject use PDFHexString — no raw literal-string injection (injection guard)', async () => {
    // Titles with unbalanced parentheses would break PDF literal strings `(...)`.
    // PDFHexString.fromText encodes as UTF-16BE hex <FEFF...> — no raw parens in output.
    const title = 'Report (Q1) notes'
    const author = "O'Brien & Smith (Ltd)"
    const doc: PdfDocument = {
      metadata: { title, author, subject: 'Test (subject)' },
      content: [{ type: 'paragraph', text: 'Content.' }],
    }
    const pdf = await render(doc)
    const text = new TextDecoder('latin1').decode(pdf)
    // Raw parenthesized form must NOT appear (that would be an unescaped literal string)
    assert.ok(!text.includes(`(${title})`), 'title must not appear as raw PDF literal string')
    assert.ok(!text.includes(`(${author})`), 'author must not appear as raw PDF literal string')
    // UTF-16BE hex encoding with BOM must be present: FEFF = BOM, 0052 = "R"
    assert.ok(text.includes('FEFF0052'), 'UTF-16BE BOM+R hex prefix not found in PDF bytes (title encoding check)')
    // /Title key must appear in the Info dict
    assert.ok(text.includes('/Title'), '/Title key not found in PDF bytes')
  })

  await t.test('T7: accessibility metadata written as UTF-16BE hex-encoded Info dict entry', async () => {
    const doc: PdfDocument = {
      metadata: {
        title: 'Accessible Doc',
        accessibility: { lang: 'en', role: 'document' },
      },
      content: [{ type: 'paragraph', text: 'Content.' }],
    }
    const pdf = await render(doc)
    const text = new TextDecoder('latin1').decode(pdf)
    // /Accessibility key must appear in the Info dict
    assert.ok(text.includes('/Accessibility'), '/Accessibility key not found in PDF bytes')
    // Value must be hex-encoded (starts with <FEFF for UTF-16BE BOM), not raw literal (...)
    const accessJson = JSON.stringify({ lang: 'en', role: 'document' })
    assert.ok(!text.includes(`(${accessJson})`), 'accessibility must not appear as raw PDF literal string')
    // Locate the /Accessibility key and check its value is hex-encoded (not a literal string).
    // Pattern: /Accessibility followed by whitespace then a hex string <FEFF...>
    // This is more specific than a global `text.includes('FEFF')` which would pass
    // even if /Accessibility itself was raw-literal but another field was hex-encoded.
    assert.ok(
      /\/Accessibility\s+<FEFF/i.test(text),
      '/Accessibility value must immediately be a hex string starting with FEFF (UTF-16BE BOM)'
    )
  })
})
