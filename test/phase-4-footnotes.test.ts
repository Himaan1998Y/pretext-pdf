import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../src/index.js'
import { PretextPdfError } from '../src/errors.js'

test('Phase 4 — Footnotes & Endnotes', async (t) => {

  // 1. Basic: single footnote renders successfully
  await t.test('single footnote-def + ref in rich-paragraph renders valid PDF', async () => {
    const pdf = await render({
      content: [
        {
          type: 'rich-paragraph',
          spans: [
            { text: 'See note' },
            { text: ' ', footnoteRef: 'fn1' },
          ],
        },
        { type: 'footnote-def', id: 'fn1', text: 'This is the footnote text.' },
      ],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
    assert.ok(pdf.byteLength > 500)
  })

  // 2. Multiple footnotes on same page
  await t.test('multiple footnotes on same page render without error', async () => {
    const pdf = await render({
      content: [
        {
          type: 'rich-paragraph',
          spans: [
            { text: 'First' },
            { text: ' ', footnoteRef: 'fn1' },
            { text: ' and second' },
            { text: ' ', footnoteRef: 'fn2' },
          ],
        },
        { type: 'footnote-def', id: 'fn1', text: 'First footnote definition.' },
        { type: 'footnote-def', id: 'fn2', text: 'Second footnote definition.' },
      ],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 500)
  })

  // 3. Footnotes on different pages (forced page break)
  await t.test('footnotes on different pages render without error', async () => {
    const pdf = await render({
      content: [
        {
          type: 'rich-paragraph',
          spans: [{ text: 'Page one ref' }, { text: ' ', footnoteRef: 'fn1' }],
        },
        { type: 'page-break' },
        {
          type: 'rich-paragraph',
          spans: [{ text: 'Page two ref' }, { text: ' ', footnoteRef: 'fn2' }],
        },
        { type: 'footnote-def', id: 'fn1', text: 'Note on page one.' },
        { type: 'footnote-def', id: 'fn2', text: 'Note on page two.' },
      ],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 500)
  })

  // 4. Custom fontSize on footnote-def
  await t.test('footnote-def with custom fontSize renders without error', async () => {
    const pdf = await render({
      content: [
        {
          type: 'rich-paragraph',
          spans: [{ text: 'Note ref' }, { text: ' ', footnoteRef: 'fn1' }],
        },
        { type: 'footnote-def', id: 'fn1', text: 'Custom size note.', fontSize: 8 },
      ],
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  // 5. Document with no footnotes — single pass, renders normally
  await t.test('document with no footnotes renders normally (no regression)', async () => {
    const pdf = await render({
      content: [
        { type: 'heading', level: 1 as const, text: 'Title' },
        { type: 'paragraph', text: 'Normal paragraph without footnotes.' },
      ],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
  })

  // 6. FOOTNOTE_DEF_DUPLICATE error
  await t.test('duplicate footnote-def id throws FOOTNOTE_DEF_DUPLICATE', async () => {
    await assert.rejects(
      () => render({
        content: [
          {
            type: 'rich-paragraph',
            spans: [{ text: 'ref', footnoteRef: 'fn1' }],
          },
          { type: 'footnote-def', id: 'fn1', text: 'First.' },
          { type: 'footnote-def', id: 'fn1', text: 'Duplicate.' },
        ],
      }),
      (err: any) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'FOOTNOTE_DEF_DUPLICATE')
        return true
      }
    )
  })

  // 7. FOOTNOTE_REF_ORPHANED error
  await t.test('footnoteRef with no matching def throws FOOTNOTE_REF_ORPHANED', async () => {
    await assert.rejects(
      () => render({
        content: [
          {
            type: 'rich-paragraph',
            spans: [{ text: 'ref', footnoteRef: 'missing-id' }],
          },
        ],
      }),
      (err: any) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'FOOTNOTE_REF_ORPHANED')
        return true
      }
    )
  })

  // 8. FOOTNOTE_DEF_ORPHANED error
  await t.test('footnote-def with no matching ref throws FOOTNOTE_DEF_ORPHANED', async () => {
    await assert.rejects(
      () => render({
        content: [
          { type: 'paragraph', text: 'No footnote refs here.' },
          { type: 'footnote-def', id: 'fn1', text: 'Nobody references me.' },
        ],
      }),
      (err: any) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'FOOTNOTE_DEF_ORPHANED')
        return true
      }
    )
  })

  // 9. Invalid footnote-def id format
  await t.test('footnote-def with invalid id (contains spaces) throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render({
        content: [
          {
            type: 'rich-paragraph',
            spans: [{ text: 'ref', footnoteRef: 'bad id' }],
          },
          { type: 'footnote-def', id: 'bad id', text: 'Some text.' },
        ],
      }),
      (err: any) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  // 10b. Footnote at exact page-break boundary
  await t.test('footnote at exact page-break boundary renders on correct page without error', async () => {
    // A4 content height ≈ 698pt (842 - 72 top - 72 bottom).
    // Default paragraph lineHeight ≈ 14.4pt (fontSize 12 * 1.2) + spaceAfter 4pt ≈ 18.4pt per line.
    // Fill page with ~37 short paragraphs to push cursor near the bottom,
    // then place a footnote ref on the last paragraph before the break.
    // This exercises pagination correctness when a footnoted line sits at the boundary.
    const fillParas = Array.from({ length: 37 }, (_, i) => ({
      type: 'paragraph' as const,
      text: `Filler paragraph ${i + 1} to consume vertical space on the first page.`,
    }))
    const pdf = await render({
      content: [
        ...fillParas,
        {
          type: 'rich-paragraph' as const,
          spans: [
            { text: 'Boundary line with footnote' },
            { text: ' ', footnoteRef: 'boundary-fn' },
          ],
        },
        { type: 'footnote-def' as const, id: 'boundary-fn', text: 'Footnote at page boundary.' },
      ],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(new TextDecoder().decode(pdf.slice(0, 4)), '%PDF')
    // Multi-page PDF must be larger than a single-page one
    assert.ok(pdf.byteLength > 2000, `Expected multi-page PDF, got ${pdf.byteLength}B`)
  })

  // 10. Multi-paragraph document with a footnote
  await t.test('footnote in document with mixed element types renders without error', async () => {
    const pdf = await render({
      content: [
        { type: 'heading', level: 1 as const, text: 'Report Title' },
        { type: 'paragraph', text: 'Introduction paragraph.' },
        {
          type: 'rich-paragraph',
          spans: [
            { text: 'Key finding' },
            { text: ' ', footnoteRef: 'src1' },
            { text: ' is significant.' },
          ],
        },
        { type: 'paragraph', text: 'Conclusion paragraph.' },
        { type: 'footnote-def', id: 'src1', text: 'Source: Research Paper, 2026.' },
      ],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 500)
  })

})
