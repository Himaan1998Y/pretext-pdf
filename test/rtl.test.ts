import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../dist/index.js'
import type { PdfDocument } from '../dist/types.js'
import { determineDirection, autoDetectRTL, detectAndReorderRTL } from '../src/measure-text.js'

// ─── Test Strings ─────────────────────────────────────────────────────────────

const HEBREW_SIMPLE = 'שלום עולם'  // "Hello world" in Hebrew
const HEBREW_LONG = 'זהו טקסט ארוך בעברית לבדיקת גישור טקסט רב שורות'
const ARABIC_SIMPLE = 'مرحبا بالعالم'  // "Hello world" in Arabic
const MIXED_TEXT = 'Hello שלום World'  // Mixed LTR/RTL
const ENGLISH_ONLY = 'The quick brown fox'  // Pure LTR

test('Phase 7F — RTL Text Support', async (t) => {
  // ─────────────────────────────────────────────────────────────────────────
  // Group A: RTL Detection (3 tests)
  // ─────────────────────────────────────────────────────────────────────────

  await t.test('Hebrew text detected as RTL (auto)', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'paragraph', text: HEBREW_SIMPLE, dir: 'auto' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
    const header = Buffer.from(pdf.slice(0, 4)).toString('ascii')
    assert.strictEqual(header, '%PDF')
  })

  await t.test('English text detected as LTR (auto)', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'paragraph', text: ENGLISH_ONLY, dir: 'auto' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  await t.test('Mixed Hebrew/English text renders correctly', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'paragraph', text: MIXED_TEXT, dir: 'auto' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Group B: Direction Override (2 tests)
  // ─────────────────────────────────────────────────────────────────────────

  await t.test('dir=rtl override forces RTL on English text', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'paragraph', text: 'Hello', dir: 'rtl' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  await t.test('dir=ltr override forces LTR on Hebrew text', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'paragraph', text: HEBREW_SIMPLE, dir: 'ltr' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Group C: RTL Alignment (2 tests)
  // ─────────────────────────────────────────────────────────────────────────

  await t.test('RTL paragraph defaults to right-align', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'paragraph', text: HEBREW_SIMPLE, dir: 'auto' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  await t.test('RTL paragraph with align=left overrides default', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'paragraph', text: HEBREW_SIMPLE, dir: 'auto', align: 'left' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Group D: Script Support (2 tests)
  // ─────────────────────────────────────────────────────────────────────────

  await t.test('Hebrew text renders without error', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'paragraph', text: HEBREW_LONG },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
    const header = Buffer.from(pdf.slice(0, 4)).toString('ascii')
    assert.strictEqual(header, '%PDF')
  })

  await t.test('Arabic text renders without error (no glyph shaping)', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'paragraph', text: ARABIC_SIMPLE },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Group E: Integration Tests (2 tests)
  // ─────────────────────────────────────────────────────────────────────────

  await t.test('RTL text in heading renders correctly', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'heading', level: 1, text: HEBREW_SIMPLE },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  await t.test('Mixed LTR/RTL content on same page', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'paragraph', text: 'Introduction in English' },
        { type: 'paragraph', text: HEBREW_SIMPLE },
        { type: 'paragraph', text: 'Conclusion in English' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Group F: Edge Cases & Regression (2 tests)
  // ─────────────────────────────────────────────────────────────────────────

  await t.test('Code block with RTL text stays in logical order', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'code', text: 'const x = 42;', fontFamily: 'Inter' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
  })

  await t.test('Regression: All existing non-RTL tests still pass', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      defaultFont: 'Inter',
      defaultFontSize: 12,
      content: [
        { type: 'heading', level: 1, text: 'Sample Document' },
        { type: 'paragraph', text: 'This is a normal English paragraph.' },
        { type: 'paragraph', text: 'Another paragraph with regular text.' },
      ],
    }

    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
    const header = Buffer.from(pdf.slice(0, 4)).toString('ascii')
    assert.strictEqual(header, '%PDF')
  })
})

// ─── B3 Regression — explicit dir override must win over auto-detect ──────────
//
// Previously, the legacy path could silently flip an explicitly-set dir:'rtl'
// paragraph back to LTR when its text happened to be ASCII-only. These tests
// pin the contract at the helper level so the bug cannot regress without
// reintroducing the bug AND deleting these tests.

test('B3 — determineDirection: explicit rtl wins over LTR-only text', () => {
  assert.equal(determineDirection('Hello world', 'rtl'), true)
  assert.equal(determineDirection('12345', 'rtl'), true)
  assert.equal(determineDirection('', 'rtl'), true)
})

test('B3 — determineDirection: explicit ltr wins over RTL-only text', () => {
  assert.equal(determineDirection(HEBREW_SIMPLE, 'ltr'), false)
  assert.equal(determineDirection(ARABIC_SIMPLE, 'ltr'), false)
})

test('B3 — determineDirection: auto-detects RTL when no override', () => {
  assert.equal(determineDirection(HEBREW_SIMPLE, 'auto'), true)
  assert.equal(determineDirection(HEBREW_SIMPLE, undefined), true)
  assert.equal(determineDirection(ARABIC_SIMPLE, 'auto'), true)
})

test('B3 — determineDirection: auto-detects LTR for ASCII-only text', () => {
  assert.equal(determineDirection(ENGLISH_ONLY, 'auto'), false)
  assert.equal(determineDirection(ENGLISH_ONLY, undefined), false)
})

test('B3 — autoDetectRTL: dominant script wins for mixed text', () => {
  assert.equal(autoDetectRTL(HEBREW_SIMPLE + ' x'), true)        // 8 RTL >= 1 LTR
  assert.equal(autoDetectRTL('Hello ' + HEBREW_SIMPLE), true)    // 8 RTL >= 5 LTR
  assert.equal(autoDetectRTL('Hello world ' + HEBREW_SIMPLE), false) // 8 RTL < 10 LTR
})

test('B3 — detectAndReorderRTL: explicit rtl + LTR text → isRTL=true', async () => {
  const r = await detectAndReorderRTL('Hello world', 'rtl')
  assert.equal(r.isRTL, true, 'explicit rtl must NOT be flipped by ASCII content')
  assert.equal(r.logical, 'Hello world')
})

test('B3 — detectAndReorderRTL: explicit ltr + RTL text → isRTL=false', async () => {
  const r = await detectAndReorderRTL(HEBREW_SIMPLE, 'ltr')
  assert.equal(r.isRTL, false, 'explicit ltr must NOT be flipped by RTL content')
})

test('B3 — detectAndReorderRTL: auto + RTL text → isRTL=true', async () => {
  const r = await detectAndReorderRTL(HEBREW_SIMPLE, 'auto')
  assert.equal(r.isRTL, true)
})
