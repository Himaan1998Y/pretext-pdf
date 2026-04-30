import { test } from 'node:test'
import assert from 'node:assert'
import { render } from '../dist/index.js'

test('Phase 8A — Annotations/Comments', async (t) => {
  await t.test('comment element renders without error', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [
        { type: 'paragraph', text: 'Before comment.' },
        { type: 'comment', contents: 'This is a sticky note.' },
        { type: 'paragraph', text: 'After comment.' },
      ],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('annotation on paragraph renders without error', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [{
        type: 'paragraph',
        text: 'Annotated paragraph.',
        annotation: { contents: 'Review this section.' },
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('annotation on heading renders without error', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [{
        type: 'heading',
        level: 1,
        text: 'Annotated Heading',
        annotation: { contents: 'Needs review.' },
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('comment with custom author and color renders', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [{
        type: 'comment',
        contents: 'Please verify.',
        author: 'Himanshu',
        color: '#FF9900',
        open: true,
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('annotation with all optional fields renders', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [{
        type: 'paragraph',
        text: 'Full annotation.',
        annotation: {
          contents: 'Complete annotation.',
          author: 'Reviewer',
          color: '#00FF00',
          open: false,
        },
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('comment in multi-page doc renders without error', async () => {
    const content: any[] = []
    for (let i = 0; i < 25; i++) {
      content.push({ type: 'paragraph', text: `Paragraph ${i} with some content.` })
    }
    content.push({ type: 'comment', contents: 'End of document note.' })
    const pdf = await render({ pageSize: 'A4', content })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('missing comment contents throws VALIDATION_ERROR', async () => {
    let error: any
    try {
      await render({
        pageSize: 'A4',
        content: [{ type: 'comment', contents: '' }],
      })
    } catch (e) { error = e }
    assert.ok(error)
    assert.strictEqual(error.code, 'VALIDATION_ERROR')
  })

  await t.test('invalid annotation color throws VALIDATION_ERROR', async () => {
    let error: any
    try {
      await render({
        pageSize: 'A4',
        content: [{ type: 'comment', contents: 'Test', color: 'bad-color' }],
      })
    } catch (e) { error = e }
    assert.ok(error)
    assert.strictEqual(error.code, 'VALIDATION_ERROR')
  })
})
