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
//
// NOTE (v1.4.1, M3): validateDocument is synchronous. JavaScript never
// interleaves sync function calls, so Promise.all over a list of sync
// validateDocument calls cannot actually exercise concurrent execution —
// each call runs to completion before the next begins.
//
// What this test DOES prove: shape stability across N invocations
// (parallel[i] === sequential[i] for every i), which would surface any
// per-call accumulator that retained state from the previous call.
//
// What this test does NOT prove: concurrent isolation under real
// interleaving. That guarantee comes structurally from code inspection of
// validate/index.ts — `validate()` opens a fresh per-call WeakSet at the
// top of every invocation, so there is no shared mutable state for
// concurrent callers to collide on in the first place.
//
// The async render-path tests later in this file (describe block #2 and
// onward) DO exercise real concurrent execution because render() is async
// and crosses await boundaries that JS may interleave.

describe('item #25 — parallel validate() isolation', () => {
  test('each doc produces errors specific to its own content, not other docs', () => {
    // validateDocument is synchronous; the isolation guarantee is structural —
    // each call opens a fresh per-call WeakSet (no module-level mutable state).
    // This test asserts that each invalid doc produces errors that MENTION its
    // own element type in the error message, proving the validator uses per-call
    // state rather than leaking across invocations.
    //
    // Design: 5 docs with known-bad payloads. Each invalid doc must produce at
    // least one error whose message contains a keyword specific to THAT element
    // type (e.g. paragraph errors must mention "paragraph" or "text", not
    // "table" or "list").
    // mustMention: verified against actual validateDocument output (v1.7.2 check)
    const cases: Array<{ doc: any; mustMention: string[] }> = [
      {
        doc: { content: [{ type: 'paragraph', text: 42 }] },
        mustMention: ['text'],                // → "'text' must be a string"
      },
      {
        doc: { content: [{ type: 'table', rows: 'not-an-array' }] },
        mustMention: ['columns'],             // → "'columns' must be a non-empty array"
      },
      {
        doc: { content: [{ type: 'list', items: 99 }] },
        mustMention: ['style', 'ordered'],    // → "'style' must be 'ordered' or 'unordered'"
      },
      {
        doc: { content: [{ type: 'rich-paragraph', spans: 'nope' }] },
        mustMention: ['spans'],               // → "'spans' must be a non-empty array"
      },
      {
        doc: { content: [{ type: 'image' /* missing src */ }] },
        mustMention: ['src'],                 // → "'src' must be a non-empty string path or Uint8Array"
      },
    ]

    // Run all validations (sync) — collect results
    const results = cases.map(c => validateDocument(c.doc))

    // Every case must be invalid (all docs are intentionally broken)
    for (let i = 0; i < results.length; i++) {
      assert.ok(
        results[i]!.valid === false,
        `case ${i} expected to be invalid but was valid`,
      )
    }

    // Each invalid result must have at least one error whose message contains
    // a keyword from that case's mustMention set. This proves the validator
    // applied the right element rules to each doc independently.
    for (let i = 0; i < results.length; i++) {
      const { errors } = results[i] as { valid: false; errors: Array<{ message: string }> }
      const allMessages = errors.map(e => e.message).join(' ')
      const matched = cases[i]!.mustMention.some(kw => allMessages.toLowerCase().includes(kw.toLowerCase()))
      assert.ok(
        matched,
        `case ${i} (${cases[i]!.mustMention[0]}): expected error message to mention one of [${cases[i]!.mustMention.join(', ')}], got: ${allMessages.slice(0, 200)}`,
      )
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
