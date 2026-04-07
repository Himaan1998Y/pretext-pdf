/**
 * Phase 8G — Hyperlinks
 * Tests for paragraph.url, heading.url, anchor links, and href spans
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { render } from '../dist/index.js'

test('Phase 8G — Hyperlinks', async (t) => {
  await t.test('paragraph.url renders without error', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [
        {
          type: 'paragraph',
          text: 'Click me to visit Google',
          url: 'https://google.com',
        },
      ],
    })
    assert.ok(pdf)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('heading.url renders without error', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [
        {
          type: 'heading',
          level: 1,
          text: 'Clickable Heading',
          url: 'https://example.com',
        },
      ],
    })
    assert.ok(pdf)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('heading.anchor registers without error', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [
        {
          type: 'heading',
          level: 2,
          text: 'Section One',
          anchor: 'section-one',
        },
        {
          type: 'paragraph',
          text: 'Some content here',
        },
      ],
    })
    assert.ok(pdf)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('paragraph.url with empty string throws VALIDATION_ERROR', async () => {
    let error: any
    try {
      await render({
        pageSize: 'A4',
        content: [
          {
            type: 'paragraph',
            text: 'Test',
            url: '',
          },
        ],
      })
    } catch (e) {
      error = e
    }
    assert.ok(error)
    assert.strictEqual(error.code, 'VALIDATION_ERROR')
    assert.ok(error.message.includes('url'))
  })

  await t.test('heading.anchor with invalid characters throws VALIDATION_ERROR', async () => {
    let error: any
    try {
      await render({
        pageSize: 'A4',
        content: [
          {
            type: 'heading',
            level: 1,
            text: 'Test',
            anchor: 'bad anchor (spaces)',
          },
        ],
      })
    } catch (e) {
      error = e
    }
    assert.ok(error)
    assert.strictEqual(error.code, 'VALIDATION_ERROR')
    assert.ok(error.message.includes('anchor'))
  })

  await t.test('heading with both url and anchor works independently', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [
        {
          type: 'heading',
          level: 1,
          text: 'Linked & Anchored',
          url: 'https://example.com',
          anchor: 'my-section',
        },
      ],
    })
    assert.ok(pdf)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('rich-paragraph with href renders without error', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [
        {
          type: 'rich-paragraph',
          fontSize: 12,
          spans: [
            { text: 'Normal text ' },
            { text: 'linked text', href: 'https://example.com' },
            { text: ' more text' },
          ],
        },
      ],
    })
    assert.ok(pdf)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('mailto: links work with paragraph.url', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [
        {
          type: 'paragraph',
          text: 'Email me',
          url: 'mailto:test@example.com',
        },
      ],
    })
    assert.ok(pdf)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('multi-column paragraph with url renders without error', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [
        {
          type: 'paragraph',
          text: 'Lorem ipsum dolor sit amet consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
          columns: 2,
          url: 'https://example.com',
        },
      ],
    })
    assert.ok(pdf)
    assert.ok(pdf.byteLength > 0)
  })
})
