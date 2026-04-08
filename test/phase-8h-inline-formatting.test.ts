import { test } from 'node:test'
import assert from 'node:assert'
import { render } from '../dist/index.js'

test('Phase 8H — Inline Formatting', async (t) => {
  await t.test('superscript span renders without error', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [{
        type: 'rich-paragraph',
        fontSize: 12,
        spans: [
          { text: 'E = mc' },
          { text: '2', verticalAlign: 'superscript' },
        ],
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('subscript span renders without error', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [{
        type: 'rich-paragraph',
        fontSize: 12,
        spans: [
          { text: 'H' },
          { text: '2', verticalAlign: 'subscript' },
          { text: 'O' },
        ],
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('mixed super/subscript in same line renders', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [{
        type: 'rich-paragraph',
        fontSize: 12,
        spans: [
          { text: 'x' },
          { text: '2', verticalAlign: 'superscript' },
          { text: ' + y' },
          { text: '2', verticalAlign: 'subscript' },
          { text: ' = z' },
        ],
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('letterSpacing on paragraph renders without error', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [{
        type: 'paragraph',
        text: 'Spaced out text for display.',
        letterSpacing: 2,
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('smallCaps on heading renders without error', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [{
        type: 'heading',
        level: 1,
        text: 'Small Caps Heading',
        smallCaps: true,
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('invalid verticalAlign throws VALIDATION_ERROR', async () => {
    let error: any
    try {
      await render({
        pageSize: 'A4',
        content: [{
          type: 'rich-paragraph',
          fontSize: 12,
          spans: [{ text: 'test', verticalAlign: 'middle' as any }],
        }],
      })
    } catch (e) { error = e }
    assert.ok(error)
    assert.strictEqual(error.code, 'VALIDATION_ERROR')
  })

  await t.test('negative letterSpacing throws VALIDATION_ERROR', async () => {
    let error: any
    try {
      await render({
        pageSize: 'A4',
        content: [{
          type: 'paragraph',
          text: 'Test',
          letterSpacing: -1,
        }],
      })
    } catch (e) { error = e }
    assert.ok(error)
    assert.strictEqual(error.code, 'VALIDATION_ERROR')
  })

  await t.test('superscript in multi-page doc renders without error', async () => {
    const content: any[] = []
    for (let i = 0; i < 30; i++) {
      content.push({
        type: 'rich-paragraph',
        fontSize: 12,
        spans: [
          { text: `Line ${i}: formula x` },
          { text: String(i), verticalAlign: 'superscript' },
        ],
      })
    }
    const pdf = await render({ pageSize: 'A4', content })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })
})
