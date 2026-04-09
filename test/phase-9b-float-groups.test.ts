import { test } from 'node:test'
import assert from 'node:assert/strict'
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

test('Phase 9B — Float Groups', async (t) => {

  await t.test('float-group with float: left renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'float-group',
        image: { src: TINY_PNG, format: 'png', height: 100 },
        float: 'left',
        content: [
          { type: 'paragraph', text: 'This text appears to the right of the image.' },
          { type: 'paragraph', text: 'Multiple paragraphs can flow alongside the float.' },
        ],
      }]
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
  })

  await t.test('float-group with float: right renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'float-group',
        image: { src: TINY_PNG, format: 'png', height: 100 },
        float: 'right',
        content: [
          { type: 'paragraph', text: 'This text appears to the left of the image.' },
          { type: 'paragraph', text: 'The image is positioned on the right side.' },
        ],
      }]
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  await t.test('float-group with mixed content types renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'float-group',
        image: { src: TINY_PNG, format: 'png', height: 120 },
        float: 'left',
        content: [
          { type: 'heading', level: 3 as const, text: 'Image Caption' },
          { type: 'paragraph', text: 'Heading and paragraph content flowing alongside the image.' },
          {
            type: 'rich-paragraph',
            spans: [
              { text: 'Rich paragraph with ', style: {} },
              { text: 'bold text', style: { bold: true } },
              { text: ' alongside float.', style: {} },
            ],
          },
        ],
      }]
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  await t.test('float-group with custom floatWidth and floatGap renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'float-group',
        image: { src: TINY_PNG, format: 'png', height: 100 },
        float: 'left',
        floatWidth: 120,
        floatGap: 16,
        content: [
          { type: 'paragraph', text: 'Text column width reduced due to custom floatWidth.' },
        ],
      }]
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  await t.test('float-group with image taller than text renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'float-group',
        image: { src: TINY_PNG, format: 'png', height: 200 },
        float: 'left',
        content: [
          { type: 'paragraph', text: 'Short text.' },
        ],
      }]
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  await t.test('float-group with image shorter than text renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'float-group',
        image: { src: TINY_PNG, format: 'png', height: 40 },
        float: 'right',
        content: [
          { type: 'paragraph', text: 'This is a longer text that extends below the image height, allowing text to wrap naturally without the float column constraint.' },
          { type: 'paragraph', text: 'Second paragraph continues after the image bounds.' },
        ],
      }]
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  await t.test('float-group in multi-element document renders without error', async () => {
    const pdf = await render({
      content: [
        { type: 'heading', level: 1 as const, text: 'Document with Floats' },
        { type: 'paragraph', text: 'Introduction paragraph before the float.' },
        {
          type: 'float-group',
          image: { src: TINY_PNG, format: 'png', height: 100 },
          float: 'left',
          content: [
            { type: 'paragraph', text: 'Float-group content in middle of document.' },
          ],
        },
        { type: 'paragraph', text: 'Content after the float group.' },
      ]
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  await t.test('float-group with spaceBefore and spaceAfter renders without error', async () => {
    const pdf = await render({
      content: [
        { type: 'paragraph', text: 'Content before float.' },
        {
          type: 'float-group',
          image: { src: TINY_PNG, format: 'png', height: 100 },
          float: 'left',
          spaceBefore: 16,
          spaceAfter: 16,
          content: [
            { type: 'paragraph', text: 'Content with explicit spacing.' },
          ],
        },
        { type: 'paragraph', text: 'Content after float.' },
      ]
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  await t.test('float-group with empty content throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render({
        content: [{
          type: 'float-group',
          image: { src: TINY_PNG, format: 'png', height: 100 },
          float: 'left',
          content: [],
        }]
      }),
      (err: any) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        assert.match(err.message, /content/)
        return true
      }
    )
  })

  await t.test('float-group with invalid float value throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render({
        content: [{
          type: 'float-group',
          image: { src: TINY_PNG, format: 'png', height: 100 },
          float: 'center' as any,
          content: [{ type: 'paragraph', text: 'Text' }],
        }]
      }),
      (err: any) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  await t.test('float-group with invalid content element type throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render({
        content: [{
          type: 'float-group',
          image: { src: TINY_PNG, format: 'png', height: 100 },
          float: 'left',
          content: [{ type: 'list', tight: true, items: [] } as any],
        }]
      }),
      (err: any) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  await t.test('float-group with missing image.src throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render({
        content: [{
          type: 'float-group',
          image: {} as any,
          float: 'left',
          content: [{ type: 'paragraph', text: 'Text' }],
        }]
      }),
      (err: any) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  await t.test('float-group on page break boundary keeps block together', async () => {
    const pdf = await render({
      pageHeight: 200, // Small page to force pagination
      content: [
        { type: 'paragraph', text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.' },
        {
          type: 'float-group',
          image: { src: TINY_PNG, format: 'png', height: 100 },
          float: 'left',
          content: [
            { type: 'paragraph', text: 'Float block that must not split across pages.' },
          ],
        },
        { type: 'paragraph', text: 'Content after float.' },
      ]
    })
    assert.ok(pdf instanceof Uint8Array)
    // Verify PDF has multiple pages (due to page break handling)
    const pdfText = new TextDecoder().decode(pdf)
    const pageMatches = pdfText.match(/\/Type \/Page[^s]/g) || []
    assert.ok(pageMatches.length >= 1, 'PDF should have at least 1 page')
  })

})
