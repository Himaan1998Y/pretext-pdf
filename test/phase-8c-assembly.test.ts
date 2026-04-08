import { test } from 'node:test'
import assert from 'node:assert'
import { render, merge, assemble } from '../dist/index.js'

test('Phase 8C — Document Assembly', async (t) => {
  await t.test('merge two PDFs produces combined result', async () => {
    const doc1 = await render({
      pageSize: 'A4',
      content: [{ type: 'heading', level: 1, text: 'Document 1' }],
    })
    const doc2 = await render({
      pageSize: 'A4',
      content: [{ type: 'heading', level: 1, text: 'Document 2' }],
    })
    const merged = await merge([doc1, doc2])
    assert.ok(merged instanceof Uint8Array)
    assert.ok(merged.byteLength > 0)
    const header = new TextDecoder().decode(merged.slice(0, 4))
    assert.strictEqual(header, '%PDF')
  })

  await t.test('merge single PDF returns valid PDF', async () => {
    const doc = await render({
      pageSize: 'A4',
      content: [{ type: 'paragraph', text: 'Single document.' }],
    })
    const result = await merge([doc])
    assert.ok(result instanceof Uint8Array)
    assert.ok(result.byteLength > 0)
  })

  await t.test('assemble with mixed doc and pdf parts', async () => {
    const existingPdf = await render({
      pageSize: 'A4',
      content: [{ type: 'paragraph', text: 'Pre-rendered.' }],
    })
    const result = await assemble([
      { pdf: existingPdf },
      { doc: { pageSize: 'A4', content: [{ type: 'paragraph', text: 'New doc.' }] } },
    ])
    assert.ok(result instanceof Uint8Array)
    assert.ok(result.byteLength > 0)
  })

  await t.test('assemble with two docs renders both', async () => {
    const result = await assemble([
      { doc: { pageSize: 'A4', content: [{ type: 'heading', level: 1, text: 'Part 1' }] } },
      { doc: { pageSize: 'A4', content: [{ type: 'heading', level: 1, text: 'Part 2' }] } },
    ])
    assert.ok(result instanceof Uint8Array)
    assert.ok(result.byteLength > 0)
  })

  await t.test('merge empty array throws ASSEMBLY_EMPTY', async () => {
    let error: any
    try {
      await merge([])
    } catch (e) { error = e }
    assert.ok(error)
    assert.strictEqual(error.code, 'ASSEMBLY_EMPTY')
  })

  await t.test('assemble empty array throws ASSEMBLY_EMPTY', async () => {
    let error: any
    try {
      await assemble([])
    } catch (e) { error = e }
    assert.ok(error)
    assert.strictEqual(error.code, 'ASSEMBLY_EMPTY')
  })

  await t.test('assemble part with neither doc nor pdf throws VALIDATION_ERROR', async () => {
    let error: any
    try {
      await assemble([{}])
    } catch (e) { error = e }
    assert.ok(error)
    assert.strictEqual(error.code, 'VALIDATION_ERROR')
  })

  await t.test('merge three PDFs produces valid result', async () => {
    const pdfs = await Promise.all([1, 2, 3].map(i =>
      render({ pageSize: 'A4', content: [{ type: 'paragraph', text: `Doc ${i}` }] })
    ))
    const merged = await merge(pdfs)
    assert.ok(merged instanceof Uint8Array)
    assert.ok(merged.byteLength > 0)
  })
})
