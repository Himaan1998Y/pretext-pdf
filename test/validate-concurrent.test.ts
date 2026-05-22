/**
 * Concurrency isolation tests — item #25 (v1.3.6).
 *
 * Verifies that concurrent validate()/render() calls do NOT share mutable state
 * across documents. Documented mutable module state that could leak:
 *
 *   - src/vendor/pretext/measurement.ts:20-34 — measureContext, cachedEngineProfile,
 *     lastContextFont (collision risk under concurrent renders with different fonts)
 *   - src/vendor/pretext/analysis.ts:78-79 — sharedWordSegmenter, segmenterLocale
 *     (collision risk across locales)
 *   - src/index.ts:62 _fnSetCounter — intentionally monotonic, asserted positively
 *
 * Strategy: run N renders/validations in parallel, then sequentially, and assert
 * byte-identical output. Drift => mutable state leaked across the await boundary.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

const { render, validateDocument, createFootnoteSet } = await import('../dist/index.js') as any
type PdfDocument = import('../dist/types.js').PdfDocument

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/**
 * Normalize PDFs by stripping byte ranges that legitimately differ between runs
 * (CreationDate, ModDate, /ID arrays). Anything left should be deterministic
 * across identical doc inputs.
 */
function stripPdfNonDeterminism(pdf: Uint8Array): string {
  const text = Buffer.from(pdf).toString('latin1')
  return text
    .replace(/\/CreationDate\s*\([^)]*\)/g, '/CreationDate()')
    .replace(/\/ModDate\s*\([^)]*\)/g, '/ModDate()')
    .replace(/\/ID\s*\[\s*<[^>]*>\s*<[^>]*>\s*\]/g, '/ID[<><>]')
}

function pdfFingerprint(pdf: Uint8Array): string {
  return createHash('sha256').update(stripPdfNonDeterminism(pdf)).digest('hex')
}

// ─── 1. Parallel validate() across 8 different element kinds ──────────────────

describe('item #25 — parallel validate() isolation', () => {
  test('8 parallel validates of different element kinds, each error path scoped to its own doc', async () => {
    // Each doc has a deliberately INVALID element so validateDocument returns
    // errors. The doc.metadata.title and a per-doc invalid path let us prove
    // error messages come back tagged to the originating document only.
    const badDocs: Array<{ tag: string; doc: any }> = [
      { tag: 'paragraph',       doc: { metadata: { title: 'doc-paragraph' },       content: [{ type: 'paragraph',       text: 42 }] } },
      { tag: 'table',           doc: { metadata: { title: 'doc-table' },           content: [{ type: 'table',           rows: 'not-an-array' }] } },
      { tag: 'list',            doc: { metadata: { title: 'doc-list' },            content: [{ type: 'list',            items: 99 }] } },
      { tag: 'rich-paragraph',  doc: { metadata: { title: 'doc-rich' },            content: [{ type: 'rich-paragraph',  spans: 'nope' }] } },
      { tag: 'image',           doc: { metadata: { title: 'doc-image' },           content: [{ type: 'image' /* missing src */ }] } },
      { tag: 'form-field',      doc: { metadata: { title: 'doc-form' },            content: [{ type: 'form-field',      fieldType: 'bogus-kind' }] } },
      { tag: 'signature',       doc: { metadata: { title: 'doc-signature' },       content: [{ type: 'signature' /* missing required fields */ }] } },
      { tag: 'callout',         doc: { metadata: { title: 'doc-callout' },         content: [{ type: 'callout',         variant: 'not-a-variant' }] } },
    ]

    const parallel = await Promise.all(badDocs.map(b => Promise.resolve().then(() => validateDocument(b.doc))))
    const sequential: any[] = []
    for (const b of badDocs) sequential.push(validateDocument(b.doc))

    assert.equal(parallel.length, 8)

    // Each result is independent: parallel[i] must deep-equal sequential[i].
    // (Module-level state leaking into validation would surface as drift here.)
    for (let i = 0; i < parallel.length; i++) {
      assert.deepEqual(
        parallel[i], sequential[i],
        `validate isolation failed for ${badDocs[i]!.tag}: parallel result diverged from sequential`,
      )
    }

    // Sanity: each doc had some failure mode, so at least one of the 8 must be
    // invalid. (A few may pass validation if the "bad" payload is permissive —
    // that's fine; we only need cross-talk detection, not strict counts.)
    const invalidCount = parallel.filter(r => r.valid === false).length
    assert.ok(invalidCount >= 4, `expected most bad docs to fail validation, got ${invalidCount}/8`)

    // Cross-talk check: no error path from doc-N should reference another doc's
    // metadata.title. validate() doesn't naturally include titles in error
    // paths, but if module state ever leaked we'd see foreign element kinds.
    for (let i = 0; i < parallel.length; i++) {
      const result = parallel[i]
      if (result.valid) continue
      const otherTags = badDocs.filter((_, j) => j !== i).map(b => `doc-${b.tag}`)
      for (const err of result.errors) {
        for (const other of otherTags) {
          assert.equal(
            err.message.includes(other), false,
            `doc ${badDocs[i]!.tag} leaked reference to ${other} in error: ${err.message}`,
          )
        }
      }
    }
  })
})

// ─── 2. Parallel render() with different fonts (measurement.ts collision) ─────

describe('item #25 — parallel render() with different fonts', () => {
  test('4 parallel renders at different font sizes match sequential byte fingerprints', async () => {
    // Only "Inter" is bundled. Vary defaultFontSize instead — that produces
    // distinct CSS font strings ("12px Inter", "14px Inter", ...) and exercises
    // measurement.ts lastContextFont swap on every render.
    const sizes = [10, 12, 14, 16]
    const mkDoc = (size: number): PdfDocument => ({
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: size,
      metadata: { title: `font-${size}`, language: 'en' },
      renderDate: '2026-01-01T00:00:00Z',
      content: [
        { type: 'heading', level: 1, text: `Heading at ${size}pt` },
        { type: 'paragraph', text: 'The quick brown fox jumps over the lazy dog. '.repeat(8) },
      ],
    })

    const parallel = await Promise.all(sizes.map(s => render(mkDoc(s))))
    const sequential: Uint8Array[] = []
    for (const s of sizes) sequential.push(await render(mkDoc(s)))

    // Each font-size doc must render to the SAME bytes whether run in parallel
    // or sequentially. Divergence => measurement.ts lastContextFont leaked.
    for (let i = 0; i < sizes.length; i++) {
      const pf = pdfFingerprint(parallel[i]!)
      const sf = pdfFingerprint(sequential[i]!)
      assert.equal(
        pf, sf,
        `font-size ${sizes[i]}pt: parallel render fingerprint (${pf}) != sequential (${sf}). ` +
        `VENDOR BUG SUSPECT: src/vendor/pretext/measurement.ts lastContextFont state leaked across renders.`,
      )
    }

    // And each distinct size must yield a distinct fingerprint (sanity: we are
    // actually exercising different measurement paths).
    const uniq = new Set(sequential.map(b => pdfFingerprint(b)))
    assert.equal(uniq.size, sizes.length, 'distinct font sizes must produce distinct PDFs')
  })
})

// ─── 3. Parallel render() across locales (analysis.ts collision) ──────────────

describe('item #25 — parallel render() across locales', () => {
  test('4 parallel renders at different languages/scripts match sequential fingerprints', async () => {
    // Different scripts force setAnalysisLocale() into different states.
    // If two renders race the segmenterLocale setter, one render's text shaping
    // can pick up the other's locale and produce different output.
    const docs: Array<{ tag: string; doc: PdfDocument }> = [
      {
        tag: 'en',
        doc: {
          pageSize: 'A4', margins: { top: 40, bottom: 40, left: 40, right: 40 },
          defaultFont: 'Inter', defaultFontSize: 12,
          metadata: { title: 'doc-en', language: 'en' },
          renderDate: '2026-01-01T00:00:00Z',
          content: [{ type: 'paragraph', text: 'The quick brown fox jumps over the lazy dog.' }],
        },
      },
      {
        tag: 'he',
        doc: {
          pageSize: 'A4', margins: { top: 40, bottom: 40, left: 40, right: 40 },
          defaultFont: 'Inter', defaultFontSize: 12,
          metadata: { title: 'doc-he', language: 'he' },
          renderDate: '2026-01-01T00:00:00Z',
          content: [{ type: 'paragraph', text: 'שלום עולם זהו טקסט בעברית', dir: 'auto' }],
        },
      },
      {
        tag: 'ar',
        doc: {
          pageSize: 'A4', margins: { top: 40, bottom: 40, left: 40, right: 40 },
          defaultFont: 'Inter', defaultFontSize: 12,
          metadata: { title: 'doc-ar', language: 'ar' },
          renderDate: '2026-01-01T00:00:00Z',
          content: [{ type: 'paragraph', text: 'مرحبا بالعالم هذا نص عربي', dir: 'auto' }],
        },
      },
      {
        tag: 'th',
        doc: {
          pageSize: 'A4', margins: { top: 40, bottom: 40, left: 40, right: 40 },
          defaultFont: 'Inter', defaultFontSize: 12,
          metadata: { title: 'doc-th', language: 'th' },
          renderDate: '2026-01-01T00:00:00Z',
          content: [{ type: 'paragraph', text: 'สวัสดีชาวโลกนี่คือข้อความภาษาไทย' }],
        },
      },
    ]

    const parallel = await Promise.all(docs.map(d => render(d.doc)))
    const sequential: Uint8Array[] = []
    for (const d of docs) sequential.push(await render(d.doc))

    for (let i = 0; i < docs.length; i++) {
      const pf = pdfFingerprint(parallel[i]!)
      const sf = pdfFingerprint(sequential[i]!)
      assert.equal(
        pf, sf,
        `locale ${docs[i]!.tag}: parallel render fingerprint (${pf}) != sequential (${sf}). ` +
        `VENDOR BUG SUSPECT: src/vendor/pretext/analysis.ts sharedWordSegmenter/segmenterLocale ` +
        `leaked across concurrent renders.`,
      )
    }
  })
})

// ─── 4. createFootnoteSet monotonicity (intentionally-shared _fnSetCounter) ───

describe('item #25 — createFootnoteSet monotonic counter (positive test)', () => {
  test('3 sequential createFootnoteSet calls yield strictly increasing base counters', () => {
    // Documents the INTENTIONAL shared-state behavior at src/index.ts:62.
    // _fnSetCounter is module-level and monotonic by design — IDs must remain
    // unique within a process. This test pins that contract so we notice if
    // someone "fixes" it by accident.
    const a = createFootnoteSet([{ text: 'first' }])
    const b = createFootnoteSet([{ text: 'second' }])
    const c = createFootnoteSet([{ text: 'third' }])

    // Parse `fn-<base>-<idx>` and assert strictly increasing base.
    const parseBase = (id: string): number => {
      const m = /^fn-(\d+)-\d+$/.exec(id)
      assert.ok(m, `id ${id} must match fn-<base>-<idx>`)
      return parseInt(m![1]!, 10)
    }
    const ba = parseBase(a[0]!.id)
    const bb = parseBase(b[0]!.id)
    const bc = parseBase(c[0]!.id)

    assert.ok(bb > ba, `base must strictly increase: got ${ba} then ${bb}`)
    assert.ok(bc > bb, `base must strictly increase: got ${bb} then ${bc}`)
    // All three IDs must be distinct.
    assert.equal(new Set([a[0]!.id, b[0]!.id, c[0]!.id]).size, 3)
  })
})
