import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as path from 'node:path'
import { render } from '../src/index.js'
import { PretextPdfError } from '../src/errors.js'

// Minimal 1x1 white PNG (valid PNG bytes)
const TINY_PNG = new Uint8Array([
  0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00,0x00,0x00,0x0d,0x49,0x48,0x44,0x52,
  0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
  0xde,0x00,0x00,0x00,0x0c,0x49,0x44,0x41,0x54,0x08,0xd7,0x63,0xf8,0xff,0xff,0x3f,
  0x00,0x05,0xfe,0x02,0xfe,0xdc,0xcc,0x59,0xe7,0x00,0x00,0x00,0x00,0x49,0x45,0x4e,
  0x44,0xae,0x42,0x60,0x82,
])

test('Phase 5 — Image Floats', async (t) => {

  await t.test('float-left image with floatText renders without error', async () => {
    const floatText = 'This text appears to the right of the image in a two-column layout.'
    const pdf = await render({
      content: [{
        type: 'image',
        src: TINY_PNG,
        format: 'png',
        width: 100,
        height: 100,
        float: 'left',
        floatText,
      }]
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
    // floatText content must be encoded in PDF stream — verify PDF is larger than image-only
    // render an equivalent non-float image to confirm float adds content (text column)
    const pdfNoFloat = await render({
      content: [{ type: 'image', src: TINY_PNG, format: 'png', width: 100, height: 100 }]
    })
    assert.ok(
      pdf.byteLength > pdfNoFloat.byteLength,
      `Float PDF (${pdf.byteLength}B) should be larger than no-float PDF (${pdfNoFloat.byteLength}B) due to embedded floatText`
    )
  })

  await t.test('float-right image with floatText renders without error', async () => {
    const floatText = 'This text appears to the left of the image.'
    const pdf = await render({
      content: [{
        type: 'image',
        src: TINY_PNG,
        format: 'png',
        width: 80,
        height: 80,
        float: 'right',
        floatText,
      }]
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
    // float PDF (image + text column) must be larger than image-only PDF
    const pdfNoFloat = await render({
      content: [{ type: 'image', src: TINY_PNG, format: 'png', width: 80, height: 80 }]
    })
    assert.ok(
      pdf.byteLength > pdfNoFloat.byteLength,
      `Float PDF (${pdf.byteLength}B) should be larger than no-float PDF (${pdfNoFloat.byteLength}B) due to embedded floatText`
    )
  })

  await t.test('float with custom floatWidth and floatGap renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'image',
        src: TINY_PNG,
        format: 'png',
        width: 150,
        height: 100,
        float: 'left',
        floatWidth: 150,
        floatGap: 20,
        floatText: 'Custom width and gap.',
      }]
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  await t.test('float with custom floatFontSize and floatColor renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'image',
        src: TINY_PNG,
        format: 'png',
        width: 100,
        height: 80,
        float: 'left',
        floatText: 'Styled float text.',
        floatFontSize: 10,
        floatColor: '#333333',
      }]
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  await t.test('float without floatText throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render({
        content: [{
          type: 'image',
          src: TINY_PNG,
          format: 'png',
          float: 'left',
        }]
      }),
      (err: any) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        assert.match(err.message, /floatText/)
        return true
      }
    )
  })

  await t.test('floatText without float throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render({
        content: [{
          type: 'image',
          src: TINY_PNG,
          format: 'png',
          floatText: 'Text without float direction',
        }]
      }),
      (err: any) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  await t.test('invalid float value throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render({
        content: [{
          type: 'image',
          src: TINY_PNG,
          format: 'png',
          float: 'center' as any,
          floatText: 'Some text',
        }]
      }),
      (err: any) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  await t.test('float image in multi-element document renders without error', async () => {
    const pdf = await render({
      content: [
        { type: 'heading', level: 1 as const, text: 'Document Title' },
        {
          type: 'image',
          src: TINY_PNG,
          format: 'png',
          width: 120,
          height: 80,
          float: 'right',
          floatText: 'Caption text for the image that appears to the left side.',
        },
        { type: 'paragraph', text: 'Content after the float block.' },
      ]
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  // 2G: error code coverage — IMAGE_LOAD_FAILED
  await t.test('image with bad file path throws IMAGE_LOAD_FAILED when onImageLoadError returns throw', async () => {
    await assert.rejects(
      () => render({
        onImageLoadError: (_src, _err) => 'throw',
        allowedFileDirs: [path.resolve('/nonexistent')],
        content: [{ type: 'image', src: path.resolve('/nonexistent/does-not-exist.png') }],
      }),
      { code: 'IMAGE_LOAD_FAILED' },
    )
  })

})
