/**
 * Tests for v0.9.0 additions:
 *   - Markdown: GFM tables, task lists
 *   - CLI binary: dist/cli.js (stdin/file, stdout/file, --markdown)
 *   - pdfmake compat shim: dist/compat.js fromPdfmake()
 */
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

// Polyfill needed for any code path that imports rendering (pretext loads canvas).
before(async () => {
  if (typeof OffscreenCanvas === 'undefined' && typeof window === 'undefined') {
    const { installNodePolyfill } = await import('../dist/node-polyfill.js')
    await installNodePolyfill()
  }
})

const repoRoot = path.resolve(new URL('../', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))
const cliPath = path.join(repoRoot, 'dist', 'cli.js')

// ─── Markdown: GFM tables + task lists ───────────────────────────────────────

describe('v0.9.0 — markdown: GFM tables', () => {
  test('table with header row and aligned columns produces a TableElement', async () => {
    const { markdownToContent } = await import('../dist/markdown.js')
    const md = '| Name  | Score | Notes |\n|:------|------:|:-----:|\n| Alice | 95    | A+    |\n| Bob   | 87    | B     |'
    const elements = await markdownToContent(md)
    assert.equal(elements.length, 1)
    const t = elements[0] as any
    assert.equal(t.type, 'table')
    assert.equal(t.columns.length, 3)
    assert.equal(t.columns[0].align, 'left')
    assert.equal(t.columns[1].align, 'right')
    assert.equal(t.columns[2].align, 'center')
    // Header + 2 body rows
    assert.equal(t.rows.length, 3)
    assert.equal(t.rows[0].isHeader, true)
    assert.equal(t.rows[0].cells[0].text, 'Name')
    assert.equal(t.rows[0].cells[0].fontWeight, 700)
    assert.equal(t.rows[1].cells[1].text, '95')
    assert.equal(t.rows[2].cells[2].text, 'B')
  })

  test('table with ragged rows is padded with empty cells', async () => {
    const { markdownToContent } = await import('../dist/markdown.js')
    // Marked may emit malformed tables with row lengths < header length
    const md = '| A | B | C |\n|---|---|---|\n| 1 | 2 |'
    const elements = await markdownToContent(md)
    const t = elements[0] as any
    assert.equal(t.type, 'table')
    assert.equal(t.rows[1].cells.length, 3, 'short row should be padded to 3 cells')
    assert.equal(t.rows[1].cells[2].text, '')
  })
})

describe('v0.9.0 — markdown: GFM task lists', () => {
  test('task list items render with ☑/☐ markers', async () => {
    const { markdownToContent } = await import('../dist/markdown.js')
    const md = '- [x] done item\n- [ ] todo item'
    const elements = await markdownToContent(md)
    const list = elements[0] as any
    assert.equal(list.type, 'list')
    assert.equal(list.items.length, 2)
    assert.match(list.items[0].text, /^\u2611 done item$/, `expected ☑ prefix; got ${JSON.stringify(list.items[0].text)}`)
    assert.match(list.items[1].text, /^\u2610 todo item$/, `expected ☐ prefix; got ${JSON.stringify(list.items[1].text)}`)
  })
})

// ─── CLI ─────────────────────────────────────────────────────────────────────

describe('v0.9.0 — CLI', () => {
  let tmp: string
  before(() => { tmp = mkdtempSync(path.join(tmpdir(), 'pretext-pdf-cli-')) })

  function run(args: string[], opts: { input?: string } = {}): SpawnSyncReturns<string> {
    return spawnSync('node', [cliPath, ...args], {
      cwd: repoRoot,
      encoding: 'utf-8',
      ...(opts.input !== undefined ? { input: opts.input } : {}),
    })
  }

  test('--version prints current version', () => {
    const r = run(['--version'])
    assert.equal(r.status, 0)
    assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+/)
  })

  test('--help prints usage and exits 0', () => {
    const r = run(['--help'])
    assert.equal(r.status, 0)
    assert.match(r.stdout, /Usage:/)
    assert.match(r.stdout, /pretext-pdf/)
  })

  test('reads JSON from stdin and writes PDF to file', () => {
    const out = path.join(tmp, 'stdin.pdf')
    const r = run(['-o', out], { input: JSON.stringify({ content: [{ type: 'paragraph', text: 'Hi' }] }) })
    assert.equal(r.status, 0, `stderr: ${r.stderr}`)
    const bytes = readFileSync(out)
    assert.equal(bytes.subarray(0, 4).toString('ascii'), '%PDF', 'output should start with %PDF')
  })

  test('reads JSON from file and writes PDF to file (positional args)', () => {
    const inFile = path.join(tmp, 'in.json')
    const outFile = path.join(tmp, 'positional.pdf')
    writeFileSync(inFile, JSON.stringify({ content: [{ type: 'heading', level: 1, text: 'Hello' }] }))
    const r = run([inFile, outFile])
    assert.equal(r.status, 0, `stderr: ${r.stderr}`)
    const bytes = readFileSync(outFile)
    assert.equal(bytes.subarray(0, 4).toString('ascii'), '%PDF')
  })

  test('--markdown converts markdown input to PDF', () => {
    const inFile = path.join(tmp, 'doc.md')
    const outFile = path.join(tmp, 'md.pdf')
    writeFileSync(inFile, '# Title\n\nFirst paragraph.\n\n- one\n- two')
    const r = run(['--markdown', inFile, outFile])
    assert.equal(r.status, 0, `stderr: ${r.stderr}`)
    const bytes = readFileSync(outFile)
    assert.equal(bytes.subarray(0, 4).toString('ascii'), '%PDF')
  })

  test('invalid JSON input produces exit 1 + clear error', () => {
    const r = run(['-o', path.join(tmp, 'bad.pdf')], { input: '{ not json' })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /invalid JSON/)
  })

  test('unknown option exits 1 + suggests --help', () => {
    const r = run(['--no-such-flag'])
    assert.equal(r.status, 1)
    assert.match(r.stderr, /unknown option/)
  })
})

// ─── pdfmake compat shim ─────────────────────────────────────────────────────

describe('v0.9.0 — pdfmake compat: fromPdfmake()', () => {
  test('plain string content becomes paragraph', async () => {
    const { fromPdfmake } = await import('../dist/compat.js')
    const doc = fromPdfmake({ content: ['hello world'] })
    assert.equal(doc.content.length, 1)
    assert.deepEqual(doc.content[0], { type: 'paragraph', text: 'hello world' })
  })

  test('text node with style + bold becomes paragraph with fontWeight', async () => {
    const { fromPdfmake } = await import('../dist/compat.js')
    const doc = fromPdfmake({
      content: [{ text: 'Important', bold: true, color: '#ff0000' }],
    })
    const p = doc.content[0] as any
    assert.equal(p.type, 'paragraph')
    assert.equal(p.text, 'Important')
    assert.equal(p.fontWeight, 700)
    assert.equal(p.color, '#ff0000')
  })

  test('style-named node mapped to heading (default headingMap)', async () => {
    const { fromPdfmake } = await import('../dist/compat.js')
    const doc = fromPdfmake({
      content: [
        { text: 'Big Title', style: 'header' },
        { text: 'Subtitle', style: 'subheader' },
      ],
      styles: { header: { fontSize: 22, bold: true }, subheader: { fontSize: 16 } },
    })
    const h1 = doc.content[0] as any
    const h2 = doc.content[1] as any
    assert.equal(h1.type, 'heading')
    assert.equal(h1.level, 1)
    assert.equal(h1.text, 'Big Title')
    assert.equal(h2.type, 'heading')
    assert.equal(h2.level, 2)
  })

  test('mixed-format text array produces a rich-paragraph', async () => {
    const { fromPdfmake } = await import('../dist/compat.js')
    const doc = fromPdfmake({
      content: [{
        text: [
          'plain ',
          { text: 'bold', bold: true },
          ' and ',
          { text: 'italic', italics: true },
        ],
      }],
    })
    const rp = doc.content[0] as any
    assert.equal(rp.type, 'rich-paragraph')
    assert.equal(rp.spans.length, 4)
    assert.equal(rp.spans[1].fontWeight, 700)
    assert.equal(rp.spans[3].fontStyle, 'italic')
  })

  test('ul / ol become unordered / ordered list', async () => {
    const { fromPdfmake } = await import('../dist/compat.js')
    const doc = fromPdfmake({
      content: [
        { ul: ['a', 'b', 'c'] },
        { ol: ['x', 'y'] },
      ],
    })
    const ul = doc.content[0] as any
    const ol = doc.content[1] as any
    assert.equal(ul.type, 'list')
    assert.equal(ul.style, 'unordered')
    assert.equal(ul.items.length, 3)
    assert.equal(ul.items[0].text, 'a')
    assert.equal(ol.type, 'list')
    assert.equal(ol.style, 'ordered')
    assert.equal(ol.items.length, 2)
  })

  test('table { body, widths, headerRows } translates correctly', async () => {
    const { fromPdfmake } = await import('../dist/compat.js')
    const doc = fromPdfmake({
      content: [{
        table: {
          widths: ['*', '*', 100],
          headerRows: 1,
          body: [
            ['Item', 'Qty', 'Price'],
            ['Widget', '3', '$30'],
            ['Sprocket', '5', '$50'],
          ],
        },
      }],
    })
    const t = doc.content[0] as any
    assert.equal(t.type, 'table')
    assert.equal(t.columns.length, 3)
    assert.equal(t.columns[2].width, 100)
    assert.equal(t.rows.length, 3)
    assert.equal(t.rows[0].isHeader, true)
    assert.equal(t.rows[0].cells[0].text, 'Item')
    assert.equal(t.rows[0].cells[0].fontWeight, 700)
    assert.equal(t.rows[2].cells[2].text, '$50')
  })

  test('image and qr nodes translate', async () => {
    const { fromPdfmake } = await import('../dist/compat.js')
    const doc = fromPdfmake({
      content: [
        { image: 'data:image/png;base64,iVBORw0KGgo=', width: 100 },
        { qr: 'https://example.com', fit: 80 },
      ],
    })
    const img = doc.content[0] as any
    const qr = doc.content[1] as any
    assert.equal(img.type, 'image')
    assert.equal(img.src, 'data:image/png;base64,iVBORw0KGgo=')
    assert.equal(img.width, 100)
    assert.equal(qr.type, 'qr-code')
    assert.equal(qr.data, 'https://example.com')
    assert.equal(qr.size, 80)
  })

  test('pageBreak before/after emits page-break around the content', async () => {
    const { fromPdfmake } = await import('../dist/compat.js')
    const doc = fromPdfmake({
      content: [
        'first',
        { text: 'second', pageBreak: 'before' },
        { text: 'third', pageBreak: 'after' },
        'fourth',
      ],
    })
    const types = doc.content.map(e => e.type)
    assert.deepEqual(types, ['paragraph', 'page-break', 'paragraph', 'paragraph', 'page-break', 'paragraph'])
  })

  test('stack flattens children inline', async () => {
    const { fromPdfmake } = await import('../dist/compat.js')
    const doc = fromPdfmake({
      content: [{ stack: ['one', 'two', 'three'] }],
    })
    assert.equal(doc.content.length, 3)
    assert.equal((doc.content[0] as any).text, 'one')
    assert.equal((doc.content[2] as any).text, 'three')
  })

  test('document-level pageSize / pageMargins / pageOrientation', async () => {
    const { fromPdfmake } = await import('../dist/compat.js')
    const doc = fromPdfmake({
      content: ['x'],
      pageSize: 'LETTER',
      pageOrientation: 'landscape',
      pageMargins: [10, 20, 30, 40],
    })
    assert.equal(doc.pageSize, 'Letter')
    // landscape with named string keeps the named size; only object pageSize gets swapped
    assert.deepEqual(doc.margins, { left: 10, top: 20, right: 30, bottom: 40 })
  })

  test('translated document renders to a real PDF', async () => {
    const { fromPdfmake } = await import('../dist/compat.js')
    const { render } = await import('../dist/index.js')
    const doc = fromPdfmake({
      content: [
        { text: 'Invoice #001', style: 'header' },
        'Thanks for your business.',
        { table: {
          widths: ['*', 'auto'],
          headerRows: 1,
          body: [['Item', 'Price'], ['Widget', '$30']],
        }},
      ],
      styles: { header: { fontSize: 20, bold: true } },
    })
    const pdf = await render(doc)
    assert.equal(Buffer.from(pdf.subarray(0, 4)).toString('ascii'), '%PDF')
    assert.ok(pdf.byteLength > 1000)
  })
})
