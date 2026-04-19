import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../dist/index.js'
import { PretextPdfError } from '../dist/index.js'

// ─── Chart (vega-lite) ────────────────────────────────────────────────────────

test('Phase 10B — Chart (vega-lite)', async (t) => {

  // ── Validation ────────────────────────────────────────────────────────────

  await t.test('chart: spec is required (missing throws VALIDATION_ERROR)', async () => {
    await assert.rejects(
      () => render({ content: [{ type: 'chart', spec: null } as any] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  await t.test('chart: spec as array throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render({ content: [{ type: 'chart', spec: [1, 2, 3] } as any] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  await t.test('chart: invalid width throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render({ content: [{ type: 'chart', spec: { mark: 'bar' }, width: -50 } as any] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  await t.test('chart: invalid height throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render({ content: [{ type: 'chart', spec: { mark: 'bar' }, height: 0 } as any] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  // ── Rendering ─────────────────────────────────────────────────────────────

  await t.test('chart: bar chart renders as PDF', async () => {
    const pdf = await render({
      content: [{
        type: 'chart',
        spec: {
          data: { values: [{ x: 'Q1', y: 120 }, { x: 'Q2', y: 98 }, { x: 'Q3', y: 145 }, { x: 'Q4', y: 180 }] },
          mark: 'bar',
          encoding: {
            x: { field: 'x', type: 'nominal', axis: { labelAngle: 0 } },
            y: { field: 'y', type: 'quantitative' },
          },
        },
        width: 300,
        height: 200,
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(Buffer.from(pdf.slice(0, 4)).toString('ascii'), '%PDF')
    assert.ok(pdf.byteLength > 1000)
  })

  await t.test('chart: line chart renders as PDF', async () => {
    const pdf = await render({
      content: [{
        type: 'chart',
        spec: {
          data: {
            values: [
              { month: 'Jan', revenue: 4200 },
              { month: 'Feb', revenue: 5100 },
              { month: 'Mar', revenue: 4800 },
              { month: 'Apr', revenue: 6200 },
            ],
          },
          mark: { type: 'line', point: true },
          encoding: {
            x: { field: 'month', type: 'nominal' },
            y: { field: 'revenue', type: 'quantitative' },
          },
        },
        width: 400,
        height: 220,
        align: 'center',
        spaceBefore: 16,
        spaceAfter: 16,
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(Buffer.from(pdf.slice(0, 4)).toString('ascii'), '%PDF')
  })

  await t.test('chart: pie/arc chart renders as PDF', async () => {
    const pdf = await render({
      content: [{
        type: 'chart',
        spec: {
          data: { values: [{ category: 'Tax', value: 30 }, { category: 'Net', value: 70 }] },
          mark: 'arc',
          encoding: {
            theta: { field: 'value', type: 'quantitative' },
            color: { field: 'category', type: 'nominal' },
          },
        },
        width: 200,
        height: 200,
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(Buffer.from(pdf.slice(0, 4)).toString('ascii'), '%PDF')
  })

  await t.test('chart: renders alongside text in invoice layout', async () => {
    const pdf = await render({
      content: [
        { type: 'heading', level: 1, text: 'Sales Report — Q1 2026' },
        { type: 'paragraph', text: 'Revenue by product category:' },
        {
          type: 'chart',
          spec: {
            data: {
              values: [
                { product: 'Electronics', revenue: 42000 },
                { product: 'Apparel', revenue: 18000 },
                { product: 'Home', revenue: 27000 },
              ],
            },
            mark: 'bar',
            encoding: {
              x: { field: 'product', type: 'nominal' },
              y: { field: 'revenue', type: 'quantitative' },
            },
          },
          width: 300,
          height: 180,
          align: 'center',
          spaceBefore: 12,
          spaceAfter: 12,
        },
        { type: 'paragraph', text: 'Total revenue exceeded targets by 12%.' },
      ],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(Buffer.from(pdf.slice(0, 4)).toString('ascii'), '%PDF')
  })

  await t.test('chart: invalid vega-lite spec throws CHART_SPEC_INVALID', async () => {
    await assert.rejects(
      () => render({
        content: [{
          type: 'chart',
          spec: { encoding: { x: { field: 'no_mark_provided' } } },
        }],
      }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.ok(
          err.code === 'CHART_SPEC_INVALID' || err.code === 'CHART_RENDER_FAILED',
          `expected CHART_SPEC_INVALID or CHART_RENDER_FAILED, got ${err.code}`
        )
        return true
      }
    )
  })

})
