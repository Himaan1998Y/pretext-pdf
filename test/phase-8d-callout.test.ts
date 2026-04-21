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

  // ── Bug-fix regression: callout spaceAfter was counted twice ─────────────────
  // Pre-fix: measure-blocks baked (el.spaceAfter ?? 12) into `totalHeight` AND also
  // returned it as block.spaceAfter, which paginate.ts added on top → double gap.
  // Fix: height carries visual geometry only; paginator adds spaceAfter exactly once.
  // Two tests below cover this: the paginator integration (downstream) and the
  // measurer-level isolation (upstream).

  await t.test('paginator places next block at height + spaceAfter (not double)', async () => {
    const { measureBlock } = await import('../dist/measure-blocks.js')
    const { paginate } = await import('../dist/paginate.js')

    const calloutEl: any = {
      type: 'callout',
      content: 'Short callout.',
      style: 'info',
    }
    const paraEl: any = {
      type: 'paragraph',
      text: 'Following paragraph.',
    }

    const opts = { defaultFont: 'Inter', fonts: [] }
    const calloutBlock = await measureBlock(calloutEl, 480, opts) as any
    const paraBlock = await measureBlock(paraEl, 480, opts) as any

    const paginatedDoc = paginate(
      [calloutBlock, paraBlock],
      2000,
      { minOrphanLines: 1, minWidowLines: 1 }
    )

    assert.equal(paginatedDoc.pages.length, 1, 'Both blocks should fit on one page')

    const placedCallout = paginatedDoc.pages[0]!.blocks[0]!
    const placedPara = paginatedDoc.pages[0]!.blocks[1]!

    const expectedParaTop = placedCallout.yFromTop + calloutBlock.height + calloutBlock.spaceAfter
    assert.ok(
      Math.abs(placedPara.yFromTop - expectedParaTop) < 1,
      `Para yFromTop (${placedPara.yFromTop.toFixed(2)}) must equal callout yFromTop + height + spaceAfter (${expectedParaTop.toFixed(2)}). ` +
      `Pre-fix: spaceAfter was baked into height AND added again by paginator, inflating the gap by ${calloutBlock.spaceAfter}pt.`
    )
  })

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

  // ── Bug-fix regression: titled callout split — first chunk must account for titleHeight ─
  // Before fix: splitBlock omitted calloutData.titleHeight from availableForLines.
  // This allowed floor((titleH + lh) / lh) extra lines to be placed on the first chunk
  // despite there being no room — the title row was clipped by content drawn on top of it.
  // Fix: availableForLines = available - topPad - bottomPadReserve - titleH (first chunk only).

  await t.test('titled callout split across pages: first chunk line count accounts for titleHeight', async () => {
    const { measureBlock } = await import('../dist/measure-blocks.js')
    const { paginate } = await import('../dist/paginate.js')

    const el: any = {
      type: 'callout',
      title: 'Important Title',
      content: Array(8).fill('This is a line of callout content.').join(' '),
      style: 'info',
    }

    const block = await measureBlock(el, 480, { defaultFont: 'Inter', fonts: [] }) as any

    assert.ok(block.lines.length >= 3, `Need >= 3 lines to force a split; got ${block.lines.length}`)
    assert.ok(block.calloutData?.titleHeight > 0, 'Expected positive titleHeight for titled callout')

    const paddingV: number = block.blockquotePaddingV ?? 10
    const titleH: number = block.calloutData.titleHeight
    const lh: number = block.lineHeight

    // Tight page: fits exactly 1 content line when titleHeight is correctly subtracted.
    // availableForLines = (paddingV + titleH + lh + paddingV + 1) - paddingV - paddingV - titleH = lh + 1
    // Without fix: availableForLines = titleH + lh + 1 → floor gives ≥ 2 (clips title row).
    const pageContentHeight = paddingV + titleH + lh + paddingV + 1

    const paginatedDoc = paginate(
      [block],
      pageContentHeight,
      { minOrphanLines: 1, minWidowLines: 1 }
    )

    assert.ok(paginatedDoc.pages.length >= 2, `Expected callout to split across pages; got ${paginatedDoc.pages.length} page(s)`)

    const firstChunk = paginatedDoc.pages[0]!.blocks[0]!
    const linesInFirstChunk = firstChunk.endLine - firstChunk.startLine

    assert.equal(
      linesInFirstChunk, 1,
      `First chunk must have exactly 1 content line (title takes the reserved space). Got ${linesInFirstChunk}. Pre-fix: titleH not subtracted from availableForLines — extra lines were placed, clipping the title row.`
    )
  })
})
