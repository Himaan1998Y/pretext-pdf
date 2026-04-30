import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render, createFootnoteSet } from '../src/index.js'

// Minimal 1x1 white PNG
const TINY_PNG = new Uint8Array([
  0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00,0x00,0x00,0x0d,0x49,0x48,0x44,0x52,
  0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
  0xde,0x00,0x00,0x00,0x0c,0x49,0x44,0x41,0x54,0x08,0xd7,0x63,0xf8,0xff,0xff,0x3f,
  0x00,0x05,0xfe,0x02,0xfe,0xdc,0xcc,0x59,0xe7,0x00,0x00,0x00,0x00,0x49,0x45,0x4e,
  0x44,0xae,0x42,0x60,0x82,
])

test('Phase 11 — Cross-cutting Enhancements', async (t) => {

  // ─── Phase 3: Rich-paragraph inline features ────────────────────────────────

  await t.test('smallCaps span in rich-paragraph renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'rich-paragraph',
        spans: [
          { text: 'Normal text and ' },
          { text: 'Small Caps', smallCaps: true },
          { text: ' back to normal.' },
        ],
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
  })

  await t.test('letterSpacing span in rich-paragraph renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'rich-paragraph',
        spans: [
          { text: 'Tracked ' },
          { text: 'letter spacing', letterSpacing: 2 },
          { text: ' text.' },
        ],
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('tabularNumbers on rich-paragraph aligns digits', async () => {
    const pdf = await render({
      content: [{
        type: 'rich-paragraph',
        tabularNumbers: true,
        spans: [
          { text: '1,234.56' },
          { text: ' — ' },
          { text: '987,654.32' },
        ],
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('smallCaps + letterSpacing combined in same paragraph renders', async () => {
    const pdf = await render({
      content: [{
        type: 'rich-paragraph',
        spans: [
          { text: 'SPACED CAPS', smallCaps: true, letterSpacing: 1.5 },
          { text: ' normal text.' },
        ],
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

  // ─── Phase 4: DX helpers ────────────────────────────────────────────────────

  await t.test('{{date}} token in header resolves to ISO date', async () => {
    const fixedDate = new Date('2024-06-15')
    const pdf = await render({
      renderDate: fixedDate,
      header: { text: 'Report dated {{date}}', fontSize: 9 },
      content: [{ type: 'paragraph', text: 'Body text.' }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
  })

  await t.test('{{author}} token in footer resolves from metadata', async () => {
    const pdf = await render({
      metadata: { author: 'Test Author' },
      footer: { text: 'Author: {{author}}', fontSize: 9 },
      content: [{ type: 'paragraph', text: 'Content.' }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('renderDate as string sets PDF creation date without error', async () => {
    const pdf = await render({
      renderDate: '2025-01-01',
      content: [{ type: 'paragraph', text: 'Dated document.' }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('createFootnoteSet generates unique IDs per call', () => {
    const setA = createFootnoteSet([
      { text: 'First footnote.' },
      { text: 'Second footnote.' },
    ])
    const setB = createFootnoteSet([
      { text: 'Third footnote.' },
    ])
    assert.equal(setA.length, 2)
    assert.equal(setB.length, 1)
    // IDs must be unique across both sets
    const allIds = [...setA, ...setB].map(f => f.id)
    assert.equal(new Set(allIds).size, allIds.length)
    // Each entry has a matching def.id
    for (const entry of [...setA, ...setB]) {
      assert.equal(entry.id, entry.def.id)
      assert.equal(entry.def.type, 'footnote-def')
    }
  })

  await t.test('onFormFieldError callback accepted — valid form renders without error', async () => {
    let callbackInvoked = false
    const pdf = await render({
      content: [
        { type: 'paragraph', text: 'Before form.' },
        { type: 'form-field', name: 'field-a', fieldType: 'text', label: 'Name', height: 24 },
        { type: 'form-field', name: 'field-b', fieldType: 'checkbox', height: 20 },
        { type: 'paragraph', text: 'After form.' },
      ],
      onFormFieldError: (_name, _err) => {
        callbackInvoked = true
        return 'skip'
      },
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
    // No errors for valid unique fields — callback should NOT be invoked
    assert.equal(callbackInvoked, false)
  })

  await t.test('onFormFieldError: render with multiple unique fields succeeds', async () => {
    const pdf = await render({
      content: [
        { type: 'form-field', name: 'first', fieldType: 'text', height: 24 },
        { type: 'form-field', name: 'second', fieldType: 'dropdown', options: [{ value: 'A', label: 'Option A' }], height: 28 },
        { type: 'form-field', name: 'third', fieldType: 'radio', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }], height: 40 },
      ],
      onFormFieldError: () => 'skip',
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

  // ─── Phase 5A: floatSpans ───────────────────────────────────────────────────

  await t.test('floatSpans renders rich text beside float image', async () => {
    const pdf = await render({
      content: [{
        type: 'image',
        src: TINY_PNG,
        format: 'png',
        float: 'left',
        floatSpans: [
          { text: 'Bold caption: ' },
          { text: 'important detail', bold: true },
          { text: ', normal tail.' },
        ],
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
  })

  await t.test('floatSpans with letterSpacing renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'image',
        src: TINY_PNG,
        format: 'png',
        float: 'right',
        floatSpans: [
          { text: 'Spaced', letterSpacing: 1.5 },
          { text: ' normal.' },
        ],
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('floatSpans + floatText mutual exclusion throws VALIDATION_ERROR', async () => {
    let error: any
    try {
      await render({
        content: [{
          type: 'image',
          src: TINY_PNG,
          format: 'png',
          float: 'left',
          floatText: 'plain text',
          floatSpans: [{ text: 'rich text' }],
        }],
      })
    } catch (e) { error = e }
    assert.ok(error)
    assert.equal(error.code, 'VALIDATION_ERROR')
  })

  // ─── Phase 5B: 2-level list nesting ────────────────────────────────────────

  await t.test('2-level nested list renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'list',
        style: 'unordered',
        items: [
          {
            text: 'Level 1 item A',
            items: [
              { text: 'Level 2 item A.1' },
              { text: 'Level 2 item A.2' },
            ],
          },
          { text: 'Level 1 item B' },
        ],
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
  })

  await t.test('2-level ordered nested list renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'list',
        style: 'ordered',
        items: [
          {
            text: 'First',
            items: [
              { text: 'Sub-first' },
              { text: 'Sub-second' },
            ],
          },
          { text: 'Second' },
        ],
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

  // ─── Phase 5C: Table rowspan ────────────────────────────────────────────────

  await t.test('table with rowspan=2 renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'table',
        columns: [{ width: '1*' }, { width: '1*' }, { width: '1*' }],
        rows: [
          {
            cells: [
              { text: 'Spans 2 rows', rowspan: 2 },
              { text: 'Row 1 Col 2' },
              { text: 'Row 1 Col 3' },
            ],
          },
          {
            cells: [
              { text: 'Row 2 Col 2' },
              { text: 'Row 2 Col 3' },
            ],
          },
          {
            cells: [
              { text: 'Row 3 Col 1' },
              { text: 'Row 3 Col 2' },
              { text: 'Row 3 Col 3' },
            ],
          },
        ],
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
  })

  await t.test('table with rowspan and bgColor renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'table',
        columns: [{ width: '1*' }, { width: '2*' }],
        rows: [
          {
            cells: [
              { text: 'Colored span', rowspan: 3, bgColor: '#E0F0FF' },
              { text: 'Row 1' },
            ],
          },
          { cells: [{ text: 'Row 2' }] },
          { cells: [{ text: 'Row 3' }] },
        ],
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

  await t.test('2-level ordered list with nestedNumberingStyle restart renders', async () => {
    const pdf = await render({
      content: [{
        type: 'list',
        style: 'ordered',
        nestedNumberingStyle: 'restart',
        items: [
          {
            text: 'Parent One',
            items: [
              { text: 'Child 1.1' },
              { text: 'Child 1.2' },
            ],
          },
          { text: 'Parent Two' },
        ],
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
  })

  // ─── onImageLoadError ───────────────────────────────────────────────────────

  await t.test('onImageLoadError skip — invalid image bytes skips without crash', async () => {
    let callbackInvoked = false
    const pdf = await render({
      content: [
        { type: 'paragraph', text: 'Before image.' },
        { type: 'image', src: new Uint8Array([0x00, 0x01, 0x02]), format: 'png' },
        { type: 'paragraph', text: 'After image.' },
      ],
      onImageLoadError: (_src, _err) => {
        callbackInvoked = true
        return 'skip'
      },
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
    assert.ok(callbackInvoked, 'onImageLoadError callback should have been invoked for corrupt image')
  })

  await t.test('onImageLoadError throw — invalid image bytes propagates error', async () => {
    let thrown: any
    try {
      await render({
        content: [
          { type: 'image', src: new Uint8Array([0x00, 0x01, 0x02]), format: 'png' },
        ],
        onImageLoadError: (_src, _err) => 'throw',
      })
    } catch (e) { thrown = e }
    assert.ok(thrown, 'Expected render to throw when onImageLoadError returns "throw"')
  })

  // ─── MONOSPACE_FONT_REQUIRED ────────────────────────────────────────────────

  await t.test('code block without fontFamily throws MONOSPACE_FONT_REQUIRED', async () => {
    let error: any
    try {
      await render({
        content: [{ type: 'code', text: 'const x = 1' }],
      })
    } catch (e) { error = e }
    assert.ok(error)
    assert.equal(error.code, 'MONOSPACE_FONT_REQUIRED')
  })

  await t.test('table with rowspan + colspan combined renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'table',
        columns: [{ width: '1*' }, { width: '1*' }, { width: '1*' }],
        rows: [
          {
            isHeader: true,
            cells: [
              { text: 'Header A', rowspan: 2 },
              { text: 'Header B+C', colspan: 2 },
            ],
          },
          {
            isHeader: true,
            cells: [
              { text: 'Sub B' },
              { text: 'Sub C' },
            ],
          },
          {
            cells: [
              { text: 'Data A1' },
              { text: 'Data B1' },
              { text: 'Data C1' },
            ],
          },
        ],
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

})
