import { test } from 'node:test'
import assert from 'node:assert'
import { render, PretextPdfError } from '../dist/index.js'
import type { PdfDocument } from '../dist/index.js'

test('Phase 8D — Callout Boxes', async (t) => {
  await t.test('basic callout renders without error', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'callout', content: 'This is an important note.' },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
  })

  await t.test('callout with style: info renders', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'callout', content: 'Info box content here.', style: 'info', title: 'Note' },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
  })

  await t.test('callout with style: warning renders', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'callout', content: 'Warning: Do not do this.', style: 'warning', title: '⚠️ Warning' },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
  })

  await t.test('callout with style: tip renders', async () => {
    const doc: PdfDocument = {
      content: [{ type: 'callout', content: 'Pro tip: use TypeScript.', style: 'tip' }],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
  })

  await t.test('callout with style: note renders', async () => {
    const doc: PdfDocument = {
      content: [{ type: 'callout', content: 'Side note here.', style: 'note' }],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
  })

  await t.test('callout with custom colors renders', async () => {
    const doc: PdfDocument = {
      content: [
        {
          type: 'callout',
          content: 'Custom styled callout.',
          title: 'Custom Title',
          backgroundColor: '#FFF0E0',
          borderColor: '#FF6600',
          color: '#333333',
        },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
  })

  await t.test('callout with empty content throws VALIDATION_ERROR', async () => {
    const doc: PdfDocument = {
      content: [{ type: 'callout', content: '' }],
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

  await t.test('callout in multi-page document paginates correctly', async () => {
    const content: any[] = [
      { type: 'heading', level: 1, text: 'Report' },
    ]
    for (let i = 0; i < 20; i++) {
      content.push({ type: 'paragraph', text: `Paragraph ${i + 1} with some content.` })
    }
    content.push({ type: 'callout', content: 'This callout appears after many paragraphs.', style: 'info', title: 'Summary' })
    const doc: PdfDocument = { content }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array && pdf.length > 0)
  })

  // ── Bug-fix regression: callout spaceAfter double-counting ────────────────────
  // Before fix: measure-blocks.ts included (el.spaceAfter ?? 12) inside `totalHeight`
  // AND stored it separately as block.spaceAfter. paginate.ts added spaceAfter twice,
  // pushing the callout and subsequent content down by one extra gap (~12pt).
  // Fix: totalHeight = pv + titleHeight + contentHeight + pv only.

  await t.test('callout block.height does not bake in spaceAfter (regression: double-counting)', async () => {
    const { measureBlock } = await import('../dist/measure-blocks.js')

    const el: any = {
      type: 'callout',
      content: 'One line of content.',
      style: 'info',
      title: 'Title',
    }
    const blockDefault = await measureBlock(
      el,
      480, // contentWidth
      { defaultFont: 'Inter', fonts: [] },
    ) as any

    assert.equal(blockDefault.spaceAfter, 12, 'default spaceAfter must be 12')

    // Re-measure with a custom spaceAfter; the visual height must be the same
    const elCustom: any = { ...el, spaceAfter: 50 }
    const blockCustom = await measureBlock(
      elCustom,
      480,
      { defaultFont: 'Inter', fonts: [] },
    ) as any

    assert.equal(blockCustom.spaceAfter, 50, 'custom spaceAfter must be returned in block.spaceAfter')
    assert.ok(
      Math.abs(blockDefault.height - blockCustom.height) < 1,
      `block.height (${blockDefault.height.toFixed(2)}) must be independent of spaceAfter (custom: ${blockCustom.height.toFixed(2)}). Bug: spaceAfter was baked into height.`
    )
  })
})
