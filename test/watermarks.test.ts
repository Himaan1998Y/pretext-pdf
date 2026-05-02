import { test } from 'node:test'
import assert from 'node:assert'
import { render } from '../dist/index.js'
import type { PdfDocument } from '../dist/types.js'

test('Phase 7B — Watermarks', async (t) => {
  // ─────────────────────────────────────────────────────────────────────────
  // Test 1: Text watermark renders PDF without error
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('text watermark renders PDF without error', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      watermark: { text: 'DRAFT' },
      content: [
        { type: 'paragraph', text: 'This document is a draft.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
    const header = Buffer.from(pdf.slice(0, 4)).toString('ascii')
    assert.strictEqual(header, '%PDF')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: Watermark opacity 0.1 renders (near-invisible)
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('watermark opacity 0.1 renders', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      watermark: { text: 'CONFIDENTIAL', opacity: 0.1 },
      content: [
        { type: 'paragraph', text: 'Test content.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3: Watermark opacity 1.0 renders (fully opaque)
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('watermark opacity 1.0 renders (fully opaque)', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      watermark: { text: 'COPY', opacity: 1.0 },
      content: [
        { type: 'paragraph', text: 'Test content.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 4: Watermark opacity 1.5 throws VALIDATION_ERROR
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('watermark opacity 1.5 throws VALIDATION_ERROR', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      watermark: { text: 'TEST', opacity: 1.5 as any },
      content: [
        { type: 'paragraph', text: 'Test content.' },
      ],
    }

    try {
      await render(doc)
      assert.fail('Should have thrown VALIDATION_ERROR')
    } catch (err: any) {
      assert.strictEqual(err.code, 'VALIDATION_ERROR')
      assert.match(err.message, /opacity/)
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 5: Watermark with neither text nor image throws VALIDATION_ERROR
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('watermark with neither text nor image throws VALIDATION_ERROR', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      watermark: {},
      content: [
        { type: 'paragraph', text: 'Test content.' },
      ],
    }

    try {
      await render(doc)
      assert.fail('Should have thrown VALIDATION_ERROR')
    } catch (err: any) {
      assert.strictEqual(err.code, 'VALIDATION_ERROR')
      assert.match(err.message, /requires either/)
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 6: Custom rotation renders without error
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('custom rotation renders without error', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      watermark: { text: 'DRAFT', rotation: -30 },
      content: [
        { type: 'paragraph', text: 'Test content.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 7: Rotation out of bounds throws WATERMARK_ROTATION_OUT_OF_RANGE
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('watermark rotation 361 degrees throws WATERMARK_ROTATION_OUT_OF_RANGE', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      watermark: { text: 'DRAFT', rotation: 361 as any },
      content: [
        { type: 'paragraph', text: 'Test content.' },
      ],
    }

    try {
      await render(doc)
      assert.fail('Should have thrown WATERMARK_ROTATION_OUT_OF_RANGE')
    } catch (err: any) {
      assert.strictEqual(err.code, 'WATERMARK_ROTATION_OUT_OF_RANGE')
      assert.match(err.message, /between -360 and 360/)
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Test 8: Regression — document without watermark field renders identically
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('regression: document without watermark field renders identically', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      defaultLineHeight: 16,
      content: [
        { type: 'heading', level: 1, text: 'Document Title' },
        { type: 'paragraph', text: 'This is a test paragraph without watermark.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
    const header = Buffer.from(pdf.slice(0, 4)).toString('ascii')
    assert.strictEqual(header, '%PDF')
  })
})
