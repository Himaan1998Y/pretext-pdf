import { test } from 'node:test'
import assert from 'node:assert'
import { render, PretextPdfError } from '../dist/index.js'
import type { PdfDocument } from '../dist/index.js'

test('Phase 8B — Interactive Forms', async (t) => {
  await t.test('text field renders without error', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'heading', level: 2, text: 'Contact Form' },
        { type: 'form-field', fieldType: 'text', name: 'fullName', label: 'Full Name' },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
  })

  await t.test('multiline text field renders', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'form-field', fieldType: 'text', name: 'message', label: 'Message', multiline: true, defaultValue: 'Hello' },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
  })

  await t.test('checkbox (checked: true) renders', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'form-field', fieldType: 'checkbox', name: 'agree', label: 'I agree to terms', checked: true },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
  })

  await t.test('radio group with 3 options renders', async () => {
    const doc: PdfDocument = {
      content: [
        {
          type: 'form-field',
          fieldType: 'radio',
          name: 'department',
          label: 'Select Department',
          options: [
            { value: 'eng', label: 'Engineering' },
            { value: 'mkt', label: 'Marketing' },
            { value: 'ops', label: 'Operations' },
          ],
          defaultSelected: 'eng',
        },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
  })

  await t.test('dropdown with options renders', async () => {
    const doc: PdfDocument = {
      content: [
        {
          type: 'form-field',
          fieldType: 'dropdown',
          name: 'country',
          label: 'Country',
          options: [
            { value: 'in', label: 'India' },
            { value: 'us', label: 'United States' },
          ],
          defaultSelected: 'in',
        },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
  })

  await t.test('button renders', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'form-field', fieldType: 'button', name: 'submit', label: 'Submit' },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
  })

  await t.test('flattenForms: true renders flattened PDF', async () => {
    const doc: PdfDocument = {
      flattenForms: true,
      content: [
        { type: 'form-field', fieldType: 'text', name: 'name', defaultValue: 'Himanshu' },
        { type: 'form-field', fieldType: 'checkbox', name: 'check', checked: false },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
  })

  await t.test('duplicate field name throws FORM_FIELD_NAME_DUPLICATE', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'form-field', fieldType: 'text', name: 'email' },
        { type: 'form-field', fieldType: 'text', name: 'email' },
      ],
    }
    await assert.rejects(
      () => render(doc),
      (err: any) => {
        assert(err instanceof PretextPdfError)
        assert.equal(err.code, 'FORM_FIELD_NAME_DUPLICATE')
        return true
      }
    )
  })

  await t.test('missing field name throws VALIDATION_ERROR', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'form-field', fieldType: 'text', name: '' },
      ],
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

  await t.test('radio without options throws VALIDATION_ERROR', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'form-field', fieldType: 'radio', name: 'choice' },
      ],
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

  await t.test('field name with unsafe chars throws VALIDATION_ERROR (HIGH-2)', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'form-field', fieldType: 'text', name: 'bad)name' },
      ],
    }
    await assert.rejects(
      () => render(doc),
      (err: any) => {
        assert(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        assert.ok(err.message.includes('name must contain'), `unexpected message: ${err.message}`)
        return true
      }
    )
  })

  await t.test('option value with unsafe chars throws VALIDATION_ERROR (HIGH-2)', async () => {
    const doc: PdfDocument = {
      content: [
        {
          type: 'form-field',
          fieldType: 'radio',
          name: 'choice',
          options: [{ value: 'ok', label: 'OK' }, { value: 'bad(value)', label: 'Bad' }],
        },
      ],
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

  await t.test('T6: accessibilityLabel appears as /TU — UTF-16BE hex-encoded, not raw literal (injection guard)', async () => {
    // Labels with parentheses (e.g. "Email (required)") would break PDF literal strings.
    // PDFHexString.fromText encodes as <FEFF...> UTF-16BE hex — no raw parens.
    const label = 'Email address (required)'
    const doc: PdfDocument = {
      content: [
        { type: 'form-field', fieldType: 'text', name: 'email', accessibilityLabel: label },
      ],
    }
    const pdf = await render(doc)
    const text = new TextDecoder('latin1').decode(pdf)
    // Verify /TU key is present in the AcroForm field dict
    assert.ok(text.includes('/TU'), '/TU annotation key not found in PDF bytes')
    // Raw parenthesized form must NOT appear (injection vector)
    assert.ok(!text.includes(`(${label})`), 'accessibilityLabel must not appear as raw PDF literal string')
    // UTF-16BE BOM + "E" (0045) confirms proper hex encoding: FEFF0045...
    assert.ok(text.includes('FEFF0045'), 'UTF-16BE hex encoding for "Email" not found in PDF bytes')
  })
})
