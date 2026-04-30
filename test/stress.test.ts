/// <reference types="node" />
/**
 * Phase 2F — Stress Tests & Performance Benchmarks
 *
 * Block A: Large document stress (50-page equivalent, 200-row table, all element types)
 * Block B: Edge case stress (empty content, unicode, extreme sizes, pathological inputs)
 * Block C: Timing benchmarks (1-page < 500ms, 10-page < 5000ms, mixed < 1000ms)
 * Block D: Template smoke tests (all 6 production templates render via subprocess)
 *
 * Baselines recorded 2026-04-17 on Windows 11 / Node 22 / Intel i7:
 *   1-page:  ~220ms
 *   10-page: ~1100ms
 *   mixed:   ~290ms
 *
 * Block D requires a built dist/ (run `npm run build` first).
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { existsSync, statSync, openSync, readSync, closeSync } from 'node:fs'
import path from 'node:path'
import { render } from '../src/index.js'

// Helper: Verify output is a valid PDF with magic bytes %PDF and reasonable size
function assertValidPdf(pdf: Uint8Array, minBytes = 1_000, maxBytes = 50_000_000): void {
  assert.ok(pdf instanceof Uint8Array, 'Output must be Uint8Array')
  assert.equal(pdf[0], 0x25, 'PDF magic byte 0 (%) mismatch')
  assert.equal(pdf[1], 0x50, 'PDF magic byte 1 (P) mismatch')
  assert.equal(pdf[2], 0x44, 'PDF magic byte 2 (D) mismatch')
  assert.equal(pdf[3], 0x46, 'PDF magic byte 3 (F) mismatch')
  assert.ok(pdf.byteLength >= minBytes, `PDF size ${pdf.byteLength} bytes < minimum ${minBytes} bytes`)
  assert.ok(pdf.byteLength <= maxBytes, `PDF size ${pdf.byteLength} bytes > maximum ${maxBytes} bytes`)
}

// ─── Block A: Large Document Stress ──────────────────────────────────────────

describe('Block A — Large Document Stress', () => {
  test('50-page equivalent document renders without error', async () => {
    const paragraphs = Array.from({ length: 200 }, (_, i) => [
      {
        type: 'heading' as const,
        level: 2 as const,
        text: `Section ${i + 1}: Market Analysis for Q${(i % 4) + 1}`,
        spaceAfter: 6,
      },
      {
        type: 'paragraph' as const,
        text: `This is the body text for section ${i + 1}. It contains a full paragraph of business analysis content that would typically appear in a long-form report document with multiple chapters and sub-sections covering various aspects of the market.`,
        spaceAfter: 10,
      },
    ]).flat()

    const pdf = await render({
      pageSize: 'A4',
      margins: { top: 60, bottom: 60, left: 64, right: 64 },
      content: paragraphs,
    })

    assertValidPdf(pdf, 50_000, 10_000_000)
  })

  test('table with 200 data rows renders without error', async () => {
    const rows = [
      {
        isHeader: true,
        cells: [
          { text: 'ID', fontWeight: 700 as 700 },
          { text: 'Product', fontWeight: 700 as 700 },
          { text: 'Revenue ($)', fontWeight: 700 as 700 },
          { text: 'Growth', fontWeight: 700 as 700 },
        ],
      },
      ...Array.from({ length: 200 }, (_, i) => ({
        cells: [
          { text: String(i + 1) },
          { text: `Product ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) || ''}` },
          { text: String((i + 1) * 1234) },
          { text: `${((i % 30) - 10).toFixed(1)}%` },
        ],
      })),
    ]

    const pdf = await render({
      content: [{
        type: 'table',
        columns: [
          { width: 60, align: 'right' as const },
          { width: '2*', align: 'left' as const },
          { width: 120, align: 'right' as const },
          { width: 80, align: 'right' as const },
        ],
        rows,
        headerBgColor: '#1a1a2e',
        borderWidth: 0.5,
        borderColor: '#dddddd',
        cellPaddingH: 6,
        cellPaddingV: 5,
      }],
    })

    assertValidPdf(pdf, 20_000, 5_000_000)
  })

  test('document using every element type renders without error', async () => {
    const pdf = await render({
      pageSize: 'A4',
      watermark: { text: 'TEST', opacity: 0.05, rotation: -45, fontSize: 72 },
      bookmarks: { minLevel: 1, maxLevel: 3 },
      header: { text: 'Every Element Type Test', fontSize: 8, align: 'right' },
      footer: { text: 'Page {{pageNumber}} of {{totalPages}}', fontSize: 8, align: 'center' },
      metadata: { title: 'All Elements', author: 'Test', subject: 'Coverage' },
      content: [
        { type: 'heading', level: 1, text: 'Heading Level 1', anchor: 'h1' },
        { type: 'heading', level: 2, text: 'Heading Level 2', anchor: 'h2' },
        { type: 'heading', level: 3, text: 'Heading Level 3' },
        { type: 'heading', level: 4, text: 'Heading Level 4' },
        { type: 'paragraph', text: 'Normal paragraph with body text.' },
        { type: 'paragraph', text: 'Bold paragraph.', fontWeight: 700 },
        { type: 'paragraph', text: 'Colored paragraph.', color: '#0070f3' },
        { type: 'paragraph', text: 'Small caps paragraph.', smallCaps: true, letterSpacing: 2 },
        { type: 'paragraph', text: 'Underlined text.', underline: true },
        { type: 'paragraph', text: 'Strikethrough text.', strikethrough: true },
        { type: 'paragraph', text: 'Justified alignment text with enough content to demonstrate word spacing.', align: 'justify' },
        { type: 'rich-paragraph', spans: [
          { text: 'Bold ' , fontWeight: 700 },
          { text: 'colored ', color: '#0070f3' },
          { text: 'small ', fontSize: 8 },
          { text: 'normal' },
        ]},
        { type: 'list', style: 'unordered', items: [
          { text: 'Bullet item one' },
          { text: 'Bullet item two', fontWeight: 700 },
          { text: 'Bullet item three' },
        ]},
        { type: 'list', style: 'ordered', items: [
          { text: 'Numbered item one' },
          { text: 'Numbered item two' },
        ]},
        { type: 'table', columns: [{ width: '1*' }, { width: '1*' }], rows: [
          { isHeader: true, cells: [{ text: 'Col A', fontWeight: 700 }, { text: 'Col B', fontWeight: 700 }] },
          { cells: [{ text: 'Cell 1' }, { text: 'Cell 2' }] },
        ], borderWidth: 0.5, borderColor: '#dddddd' },
        { type: 'hr', color: '#dddddd', thickness: 0.5 },
        { type: 'spacer', height: 20 },
        { type: 'page-break' },
        {
          type: 'toc',
          title: 'Table of Contents',
          showTitle: true,
          leader: '.',
          minLevel: 1,
          maxLevel: 2,
          fontSize: 11,
        },
        { type: 'paragraph', text: 'Inline code substitute (code block requires loaded monospace font).' },
        { type: 'paragraph', text: 'RTL test: مرحبا بالعالم', dir: 'rtl' },
      ],
    })

    assertValidPdf(pdf, 10_000, 2_000_000)
  })

  test('document with long unordered and ordered lists (50 items each) renders without error', async () => {
    const items = Array.from({ length: 50 }, (_, i) => ({
      text: `Item ${i + 1}: This is a list item with enough text to potentially wrap to the next line in the PDF.`,
    }))

    const pdf = await render({
      content: [
        { type: 'list', style: 'unordered', items },
        { type: 'spacer', height: 10 },
        { type: 'list', style: 'ordered', items },
      ],
    })

    assertValidPdf(pdf, 10_000, 2_000_000)
  })

  test('list with 0 items throws VALIDATION_ERROR (empty array validation)', async () => {
    await assert.rejects(
      () => render({
        content: [{ type: 'list', style: 'unordered', items: [] }],
      }),
      { code: 'VALIDATION_ERROR' },
    )
  })

  test('rich-paragraph with empty spans throws VALIDATION_ERROR (empty array validation)', async () => {
    await assert.rejects(
      () => render({
        content: [{ type: 'rich-paragraph', spans: [] }],
      }),
      { code: 'VALIDATION_ERROR' },
    )
  })

  test('extremely small page size throws PAGE_TOO_SMALL error (margin constraint)', async () => {
    await assert.rejects(
      () => render({
        pageSize: [100, 200],
        content: [
          { type: 'heading', level: 1, text: 'Narrow Page' },
          { type: 'paragraph', text: 'This page is too narrow.' },
        ],
      }),
      { code: 'PAGE_TOO_SMALL' },
    )
  })

  test('document with all named page sizes renders without error', async () => {
    const sizes = ['Letter', 'Legal', 'A3', 'A4', 'A5'] as const
    for (const size of sizes) {
      const pdf = await render({
        pageSize: size,
        content: [{ type: 'paragraph', text: `Page size: ${size}` }],
      })
      assertValidPdf(pdf, 500)
    }
  })
})

// ─── Block B: Edge Case Stress ────────────────────────────────────────────────

describe('Block B — Edge Case Stress', () => {
  test('empty content array throws VALIDATION_ERROR', async () => {
    await assert.rejects(
      () => render({ content: [] }),
      { code: 'VALIDATION_ERROR' },
    )
  })

  test('single zero-height spacer renders without error', async () => {
    const pdf = await render({ content: [{ type: 'spacer', height: 0 }] })
    assertValidPdf(pdf)
  })

  test('paragraph with empty string renders without error', async () => {
    const pdf = await render({ content: [{ type: 'paragraph', text: '' }] })
    assertValidPdf(pdf)
  })

  test('paragraph with a single very long word (no whitespace) renders without error', async () => {
    const longWord = 'a'.repeat(500)
    const pdf = await render({ content: [{ type: 'paragraph', text: longWord }] })
    assertValidPdf(pdf)
  })

  test('paragraph with CJK characters renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'paragraph',
        text: '日本語テスト。中文测试。한국어 테스트。これはテストです。Unicode CJK characters.',
      }],
    })
    assertValidPdf(pdf)
  })

  test('paragraph with Arabic and Hebrew renders without error', async () => {
    const pdf = await render({
      content: [
        { type: 'paragraph', text: 'مرحبا بالعالم — Arabic text in a paragraph', dir: 'rtl' },
        { type: 'paragraph', text: 'שלום עולם — Hebrew text in a paragraph', dir: 'rtl' },
      ],
    })
    assertValidPdf(pdf)
  })

  test('heading with extreme font size (72pt) renders without error', async () => {
    const pdf = await render({
      content: [{ type: 'heading', level: 1, text: 'Giant Heading', fontSize: 72 }],
    })
    assertValidPdf(pdf)
  })

  test('paragraph with very small font size (6pt) renders without error', async () => {
    const pdf = await render({
      content: [{ type: 'paragraph', text: 'Tiny text', fontSize: 6 }],
    })
    assertValidPdf(pdf)
  })

  test('table with 1 column and 1 cell renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'table',
        columns: [{ width: 200 }],
        rows: [{ cells: [{ text: 'Single cell' }] }],
      }],
    })
    assertValidPdf(pdf)
  })

  test('table with star-width columns renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'table',
        columns: [{ width: '3*' }, { width: '1*' }, { width: '2*' }],
        rows: [
          { isHeader: true, cells: [{ text: 'Wide', fontWeight: 700 }, { text: 'Narrow', fontWeight: 700 }, { text: 'Medium', fontWeight: 700 }] },
          { cells: [{ text: 'Three parts' }, { text: '1 part' }, { text: 'Two parts' }] },
        ],
        borderWidth: 0.5,
        borderColor: '#dddddd',
      }],
    })
    assertValidPdf(pdf)
  })

  test('HR with zero thickness renders without error', async () => {
    const pdf = await render({
      content: [
        { type: 'paragraph', text: 'Above' },
        { type: 'hr', thickness: 0 },
        { type: 'paragraph', text: 'Below' },
      ],
    })
    assertValidPdf(pdf)
  })

  test('document with letter spacing near zero renders without error', async () => {
    const pdf = await render({
      content: [{ type: 'paragraph', text: 'Letter spacing test', letterSpacing: 0.1 }],
    })
    assertValidPdf(pdf)
  })

  test('document with encryption (copying: false) produces valid PDF', async () => {
    const pdf = await render({
      encryption: { permissions: { copying: false } },
      content: [{ type: 'paragraph', text: 'Protected document content.' }],
    })
    assertValidPdf(pdf)
  })

  test('multiple consecutive page-breaks render without error', async () => {
    const pdf = await render({
      content: [
        { type: 'paragraph', text: 'Page 1' },
        { type: 'page-break' },
        { type: 'page-break' },
        { type: 'page-break' },
        { type: 'paragraph', text: 'Page 4 (after 3 consecutive page-breaks)' },
      ],
    })
    assertValidPdf(pdf)
  })

  test('paragraph with whitespace-only text renders without error (edge case)', async () => {
    const pdf = await render({
      content: [{ type: 'paragraph', text: '   \n\t  ' }],
    })
    assertValidPdf(pdf)
  })
})

// ─── Block C: Timing Benchmarks ───────────────────────────────────────────────

describe('Block C — Timing Benchmarks', () => {
  test('1-page document renders in < 500ms (excluding JIT warm-up)', async () => {
    // Warm-up render to avoid cold JIT overhead affecting benchmark
    await render({ content: [{ type: 'paragraph', text: 'Warm-up' }] })

    const start = performance.now()
    await render({
      pageSize: 'A4',
      content: [
        { type: 'heading', level: 1, text: 'One Page Document' },
        { type: 'paragraph', text: 'This is a single-page document used for baseline timing.' },
        { type: 'list', style: 'unordered', items: [
          { text: 'Item one' }, { text: 'Item two' }, { text: 'Item three' },
        ]},
      ],
    })
    const elapsed = performance.now() - start
    assert.ok(elapsed < 500, `1-page render took ${elapsed.toFixed(0)}ms, expected < 500ms`)
  })

  test('10-page document renders in < 5000ms', async () => {
    const content = Array.from({ length: 40 }, (_, i) => [
      { type: 'heading' as const, level: 2 as const, text: `Chapter ${i + 1}` },
      { type: 'paragraph' as const, text: `Content for chapter ${i + 1}. This paragraph provides enough text to simulate a realistic multi-page business document with normal prose density.` },
      ...(i % 4 === 3 ? [{ type: 'page-break' as const }] : []),
    ]).flat()

    const start = performance.now()
    await render({ pageSize: 'A4', content })
    const elapsed = performance.now() - start
    assert.ok(elapsed < 5000, `10-page render took ${elapsed.toFixed(0)}ms, expected < 5000ms`)
  })

  test('mixed-element document (heading+paragraph+table+list+hr) renders in < 1000ms', async () => {
    const start = performance.now()
    await render({
      content: [
        { type: 'heading', level: 1, text: 'Performance Test Document' },
        { type: 'paragraph', text: 'Introduction paragraph with normal prose content.' },
        { type: 'list', style: 'unordered', items: Array.from({ length: 10 }, (_, i) => ({ text: `List item ${i + 1}` })) },
        {
          type: 'table',
          columns: [{ width: '2*' }, { width: 100, align: 'right' as const }, { width: 100, align: 'right' as const }],
          rows: [
            { isHeader: true, cells: [{ text: 'Item', fontWeight: 700 }, { text: 'Qty', fontWeight: 700 }, { text: 'Total', fontWeight: 700 }] },
            ...Array.from({ length: 20 }, (_, i) => ({
              cells: [{ text: `Product ${i + 1}` }, { text: String(i + 1) }, { text: `$${((i + 1) * 99.99).toFixed(2)}` }],
            })),
          ],
          borderWidth: 0.5,
          borderColor: '#dddddd',
        },
        { type: 'hr', thickness: 0.5 },
        { type: 'paragraph', text: 'Footer paragraph with closing remarks and additional context.' },
      ],
    })
    const elapsed = performance.now() - start
    assert.ok(elapsed < 1000, `Mixed-element render took ${elapsed.toFixed(0)}ms, expected < 1000ms`)
  })
})

// ─── Block D: Template Smoke Tests ───────────────────────────────────────────

describe('Block D — Template Smoke Tests', () => {
  const templatesDir = path.resolve(process.cwd(), 'templates')
  const outputDir = path.resolve(templatesDir, 'output')
  const distIndex = path.resolve(process.cwd(), 'dist', 'index.js')
  const distBuilt = existsSync(distIndex)

  // Skip all tests in this block if dist is not built
  if (!distBuilt) {
    test.skip('(Block D requires `npm run build` — all tests skipped)', () => {})
    return
  }

  function runTemplate(name: string): void {
    const templatePath = path.join(templatesDir, `${name}.ts`)
    assert.ok(existsSync(templatePath), `Template file not found: ${templatePath}`)

    execSync(`npx tsx "${templatePath}"`, {
      cwd: path.resolve(process.cwd()),
      timeout: 30_000,
      stdio: 'pipe',
    })

    const outPath = path.join(outputDir, `${name}.pdf`)
    assert.ok(existsSync(outPath), `Expected output not found: ${outPath}`)

    const size = statSync(outPath).size
    const pdfBytes = Buffer.alloc(4)
    const fd = openSync(outPath, 'r')
    readSync(fd, pdfBytes, 0, 4, 0)
    closeSync(fd)

    // Verify PDF magic bytes
    assert.equal(pdfBytes[0], 0x25, `${name}.pdf: missing PDF magic byte %`)
    assert.equal(pdfBytes[1], 0x50, `${name}.pdf: missing PDF magic byte P`)
    assert.equal(pdfBytes[2], 0x44, `${name}.pdf: missing PDF magic byte D`)
    assert.equal(pdfBytes[3], 0x46, `${name}.pdf: missing PDF magic byte F`)

    // Reasonable size range: > 5KB (not empty), < 50MB (not corrupted/bloated)
    assert.ok(size > 5_000, `${name}.pdf is suspiciously small: ${size} bytes`)
    assert.ok(size < 50_000_000, `${name}.pdf is suspiciously large: ${size} bytes (> 50MB)`)
  }

  test('invoice-gst template renders successfully', () => {
    runTemplate('invoice-gst')
  })

  test('invoice-intl template renders successfully', () => {
    runTemplate('invoice-intl')
  })

  test('report template renders successfully', () => {
    runTemplate('report')
  })

  test('nda template renders successfully', () => {
    runTemplate('nda')
  })

  test('meeting-minutes template renders successfully', () => {
    runTemplate('meeting-minutes')
  })

  test('resume template renders successfully', () => {
    runTemplate('resume')
  })
})
