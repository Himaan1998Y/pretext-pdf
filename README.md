# pretext-pdf

> **The PDF library AI agents speak natively — and humans love writing.**
>
> A `PdfDocument` is plain JSON. LLMs emit it in one shot — no codegen, no headless browser, no `eval`.
> Humans get a strict-typed declarative API for invoices, reports, resumes, and templates.

[![npm version](https://img.shields.io/npm/v/pretext-pdf)](https://www.npmjs.com/package/pretext-pdf)
[![npm downloads](https://img.shields.io/npm/dw/pretext-pdf)](https://www.npmjs.com/package/pretext-pdf)
[![CI](https://github.com/Himaan1998Y/pretext-pdf/actions/workflows/ci.yml/badge.svg)](https://github.com/Himaan1998Y/pretext-pdf/actions)
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-600%2B-brightgreen)](#tests)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Bundle](https://img.shields.io/badge/runtime%20deps-7-informational)](#runtime-footprint)

**[Live demo](https://himaan1998y.github.io/pretext-pdf/)** &nbsp;·&nbsp; **[`pretext-pdf-mcp`](https://www.npmjs.com/package/pretext-pdf-mcp)** (MCP server) &nbsp;·&nbsp; **[Migrating from pdfmake?](#migrating-from-pdfmake)**

*Layout powered by [`@chenglou/pretext`](https://github.com/chenglou/pretext) — the precision text-layout engine by [Cheng Lou](https://github.com/chenglou) (React core team, Midjourney).*

---

## Table of contents

- [Why pretext-pdf](#why-pretext-pdf)
- [Install](#install)
- [Quick start](#quick-start)
  - [Library API](#library-api)
  - [CLI](#cli)
  - [Markdown](#markdown)
  - [Templates](#templates)
  - [pdfmake migration](#migrating-from-pdfmake)
  - [MCP server (Claude / Cursor / Windsurf)](#mcp-server-claude--cursor--windsurf)
- [Built for AI agents](#built-for-ai-agents)
- [Element catalog](#element-catalog)
- [Document features](#document-level-features)
- [API reference](#api-reference)
- [India / GST invoicing](#india--gst-invoicing)
- [Custom fonts](#custom-fonts)
- [Rich text](#rich-text)
- [Footnotes](#footnotes)
- [Examples](#examples)
- [Error handling](#error-handling)
- [Troubleshooting](#troubleshooting)
- [Non-goals](#non-goals)
- [Runtime footprint](#runtime-footprint)
- [Performance](#performance)
- [Tests](#tests)
- [Security](#security)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Credits](#credits)

---

## Why pretext-pdf

Three established camps in JS PDF generation, and one gap. pretext-pdf lives in the gap.

| | pdfmake / jsPDF / pdfkit | Puppeteer / Playwright | LaTeX / WeasyPrint | **pretext-pdf** |
|---|---|---|---|---|
| Lightweight (no Chromium) | ✅ | ❌ ~300 MB | ❌ native binaries | ✅ |
| Pure ESM, runs in serverless | ✅ | ⚠️ painful in Lambda | ❌ | ✅ |
| Professional typography (kerning, hyphenation, RTL/CJK) | ❌ | ✅ | ✅ | ✅ |
| Declarative — describe the document, don't draw it | ⚠️ partial | ❌ | ❌ | ✅ |
| **LLM emits a working document in one shot** | ❌ requires codegen loop | ❌ requires HTML+CSS knowledge | ❌ requires LaTeX knowledge | ✅ pure JSON |
| MCP server out of the box | ❌ | ❌ | ❌ | ✅ |
| Drop-in CLI for shell pipelines | ❌ | ⚠️ wrap with code | ⚠️ separate binary | ✅ `pretext-pdf in.json out.pdf` |
| pdfmake migration shim | — | ❌ | ❌ | ✅ `fromPdfmake()` |

**The headline:** every other JS PDF library asks an LLM (or you) to *write code*. pretext-pdf asks for a JSON object. That difference is what makes agent-generated PDFs reliable — and the same shape happens to be a clean declarative API for humans too.

---

## Install

```bash
npm install pretext-pdf
```

> **ESM only** — use `import`, not `require`. Requires Node.js ≥ 18.

Optional peer dependencies — install only what you use:

| Peer | When you need it |
|---|---|
| `@napi-rs/canvas` | SVG / qr-code / barcode / chart elements (Node only — browser uses `OffscreenCanvas`) |
| `qrcode` | `qr-code` element |
| `bwip-js` | `barcode` element (100+ symbologies) |
| `vega` + `vega-lite` | `chart` element |
| `marked` | `pretext-pdf/markdown` entry point and `--markdown` CLI flag |
| `@signpdf/signpdf` | PKCS#7 cryptographic signing |

> **Encryption is built-in** since v0.4.0 — no extra install.

---

## Quick start

### Library API

```typescript
import { render } from 'pretext-pdf'
import { writeFileSync } from 'fs'

const pdf = await render({
  pageSize: 'A4',
  margins: { top: 40, bottom: 40, left: 50, right: 50 },
  metadata: { title: 'Invoice #001', author: 'Acme Corp' },
  content: [
    { type: 'heading', level: 1, text: 'Invoice #12345' },
    { type: 'paragraph', text: 'Thank you for your business.', fontSize: 12 },
    {
      type: 'table',
      columns: [
        { width: 200 },
        { width: 50, align: 'right' },
        { width: 100, align: 'right' },
      ],
      rows: [
        { isHeader: true, cells: [{ text: 'Item', fontWeight: 700 }, { text: 'Qty', fontWeight: 700 }, { text: 'Price', fontWeight: 700 }] },
        { cells: [{ text: 'Professional Services' }, { text: '10' }, { text: '$1,000' }] },
        { cells: [{ text: 'Hosting (annual)' }, { text: '1' }, { text: '$500' }] },
      ],
    },
    { type: 'paragraph', text: 'Total: $1,500', align: 'right', fontWeight: 700 },
  ],
})

writeFileSync('invoice.pdf', pdf)
```

### CLI

`pretext-pdf` ships with a binary that turns a JSON or Markdown file into a PDF — no Node code required.

```bash
# JSON in, PDF out
pretext-pdf doc.json invoice.pdf

# Stdin → stdout (pipe-friendly)
echo '{"content":[{"type":"heading","level":1,"text":"Hi"}]}' | pretext-pdf > out.pdf

# Markdown straight to PDF
pretext-pdf --markdown --code-font 'Courier New' README.md docs.pdf

# Help / version
pretext-pdf --help
pretext-pdf --version
```

| Flag | Meaning |
|---|---|
| `-i, --input <path>` | Read input from file (default: first positional, or stdin) |
| `-o, --output <path>` | Write PDF to file (default: second positional, or stdout) |
| `--markdown` | Treat input as Markdown — converts via `pretext-pdf/markdown` |
| `--code-font <name>` | With `--markdown`, font family for fenced code blocks |
| `-v, --version` | Print version |
| `-h, --help` | Print help |

Exit codes: `0` success, `1` user error (bad args, invalid JSON), `2` render error.

### Markdown

Convert any Markdown string to `ContentElement[]` in one call. Requires `marked` peer dep.

```typescript
import { markdownToContent } from 'pretext-pdf/markdown'
import { render } from 'pretext-pdf'

const md = `
# Q1 2026 Report

Revenue grew **18%** year-over-year.

| Metric | Q4 2025 | Q1 2026 | Change |
|--------|--------:|--------:|:------:|
| Revenue | $45M | $60M | +33% |
| Margin  | 62%  | 68%  | +6pp |

- [x] Cloud expansion launched
- [x] Enterprise pipeline doubled
- [ ] APAC region opening Q2

> All figures in USD millions.
`

const content = await markdownToContent(md, { codeFontFamily: 'Courier New' })
const pdf = await render({ content })
```

Supported: headings h1–h4, bold, italic, strikethrough, inline code, links, ordered/unordered lists (recursive nesting), **GFM tables (with column alignment)**, **GFM task lists** (☑/☐), fenced code blocks, blockquotes, horizontal rules.

### Templates

Pre-built zero-dependency template functions:

```typescript
import { createInvoice, createGstInvoice, createReport } from 'pretext-pdf/templates'
import { render } from 'pretext-pdf'

const content = createInvoice({
  from: { name: 'Acme Corp', address: '123 Main St', email: 'billing@acme.com' },
  to:   { name: 'Client Ltd', address: '456 Oak Ave' },
  invoiceNumber: 'INV-2026-001',
  date: '2026-04-20',
  items: [{ description: 'Consulting', quantity: 10, unitPrice: 150 }],
  currency: '$', taxRate: 10, taxLabel: 'GST',
  qrData: 'upi://pay?pa=acme@bank&am=1650',
})
const pdf = await render({ content })
```

Available: `createInvoice` (any currency), `createGstInvoice` (India GST/IGST/CGST+SGST + UPI QR + amount-in-words), `createReport` (with optional TOC).

### Migrating from pdfmake

`pretext-pdf/compat` translates pdfmake document descriptors into a `PdfDocument` — most common patterns work without code changes.

```typescript
import { fromPdfmake } from 'pretext-pdf/compat'
import { render } from 'pretext-pdf'

// Existing pdfmake document, unchanged
const pdfmakeDoc = {
  pageSize: 'LETTER',
  pageMargins: [40, 60, 40, 60],
  defaultStyle: { fontSize: 11 },
  styles: {
    header: { fontSize: 22, bold: true },
    subheader: { fontSize: 16 },
  },
  content: [
    { text: 'Invoice #001', style: 'header' },
    { text: 'Acme Corp', style: 'subheader' },
    'Thanks for your business.',
    {
      table: {
        widths: ['*', 'auto', 80],
        headerRows: 1,
        body: [
          ['Item', 'Qty', 'Price'],
          ['Widget', '3', '$30'],
          ['Sprocket', '5', '$50'],
        ],
      },
    },
    { ul: ['Net 30 terms', 'Late fee: 1.5%/mo'] },
  ],
}

const pdf = await render(fromPdfmake(pdfmakeDoc))
```

| pdfmake feature | Compat support |
|---|---|
| `string` content | ✅ → paragraph |
| `{ text, bold, italics, color, fontSize, alignment, font }` | ✅ → paragraph or rich-paragraph |
| `{ text, style: 'header' }` (style lookup) | ✅ — `header`/`h1`/`title` map to heading 1, `subheader`/`h2` to 2, etc. |
| `{ ul }` / `{ ol }` (recursive) | ✅ → list |
| `{ table: { body, widths, headerRows } }` | ✅ → table |
| `{ image, width, height }` | ✅ → image |
| `{ qr, fit }` | ✅ → qr-code |
| `{ pageBreak: 'before' \| 'after' }` | ✅ → page-break |
| `{ stack }` | ✅ → flattened inline |
| `{ link }` on inline text | ✅ → span.href |
| `pageSize`, `pageOrientation`, `pageMargins` | ✅ |
| `info` (title/author/subject/keywords) | ✅ → metadata |
| `header`, `footer` (string form) | ✅ |
| `{ columns }` | ⚠️ flattened with a warning |
| `{ canvas }` | ❌ unsupported (drawing primitives) |
| Function-style `header`/`footer` | ❌ pass a string |

Override the heading-name mapping via `fromPdfmake(doc, { headingMap: { ... } })`.

### MCP server (Claude / Cursor / Windsurf)

Drop into any MCP-aware AI agent in 60 seconds:

```json
{
  "mcpServers": {
    "pretext-pdf": {
      "command": "npx",
      "args": ["-y", "pretext-pdf-mcp"]
    }
  }
}
```

Exposes: `generate_pdf`, `generate_invoice`, `generate_report`, `generate_from_markdown`, `list_element_types`. Versioned alongside this library — see [`pretext-pdf-mcp`](https://www.npmjs.com/package/pretext-pdf-mcp).

---

## Built for AI agents

A `PdfDocument` is a plain JSON object. No functions are required. Every field is optional except `type` and a few element-specific essentials. That shape is exactly what an LLM can produce reliably with no tool-use loop.

```typescript
import { render } from 'pretext-pdf'

// Whatever produced this JSON — Claude, GPT, a workflow node, a form submission — works the same
const pdf = await render({
  metadata: { title: 'AI-generated quarterly report' },
  content: [
    { type: 'heading', level: 1, text: 'Q1 2026 Summary' },
    { type: 'paragraph', text: 'Revenue grew 18% YoY.' },
    { type: 'table', columns: [/* ... */], rows: [/* ... */] },
  ],
})
```

### Why JSON-first matters for agents

- **No code execution loop.** Model returns JSON; you call `render()`. No sandbox, no `vm`, no Vercel Sandbox roundtrip.
- **Schema-validatable.** Strict TypeScript types double as the contract. Pair with [Anthropic tool use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) or [Vercel AI SDK structured output](https://sdk.vercel.ai/docs/ai-sdk-core/generating-structured-data).
- **Self-correcting errors.** Every failure throws `PretextPdfError` with a typed `code`. Feed it back to the model and it fixes itself.
- **Progressive disclosure.** Optional peer deps mean agents only ask for QR codes, charts, or markdown when needed — token-efficient prompts.

---

## Element catalog

```
paragraph    heading(1-4)   spacer       hr           page-break
table        image          svg          list         code
blockquote   rich-paragraph callout      comment      form-field
toc          qr-code        barcode      chart        footnote-def
```

| Element | What it does |
| --- | --- |
| `paragraph` | Text block — font, size, color, align, background, letterSpacing, smallCaps, tabularNumbers, multi-column (`columns` + `columnGap`), RTL (`dir`) |
| `heading` | H1–H4 with bookmarks, URL links, internal anchors, tabularNumbers, RTL |
| `table` | Fixed/proportional/auto columns, colspan, rowspan, repeating headers across page breaks |
| `image` | PNG/JPG/WebP with sizing, alignment, float left/right with `floatText` or rich `floatSpans` |
| `list` | Ordered/unordered, recursive nesting, `nestedNumberingStyle: 'restart' \| 'continue'` |
| `code` | Monospace block with background and padding |
| `blockquote` | Left border + background |
| `rich-paragraph` | Mixed bold/italic/color/size/super/subscript spans with inline hyperlinks |
| `svg` | Embedded SVG graphics with auto-sizing from viewBox |
| `toc` | Auto-generated table of contents with accurate page numbers (two-pass) |
| `qr-code` | Scannable QR code — UPI, URLs, vCards. Requires `qrcode` peer dep. |
| `barcode` | 100+ symbologies — EAN-13, Code128, PDF417, DataMatrix, etc. Requires `bwip-js`. |
| `chart` | Vega-Lite data visualisation as vector SVG. Requires `vega` + `vega-lite`. |
| `comment` | PDF sticky-note annotation (visible in Acrobat/Preview sidebar) |
| `form-field` | Interactive text/checkbox/radio/dropdown/button (with `flattenForms` to bake) |
| `callout` | Info / warning / tip / note callout boxes |
| `footnote-def` | Paired with `span.footnoteRef` for proper footnote numbering + zone reservation |
| `hr` / `spacer` / `page-break` | Layout primitives |

### Document-level features

| Feature | Config key | Notes |
| --- | --- | --- |
| Watermarks | `doc.watermark` | Text or image, opacity, rotation |
| Encryption | `doc.encryption` | Password + granular permissions, built-in |
| Cryptographic signing | `doc.signature: { p12, passphrase, ... }` | PKCS#7, optional `@signpdf/signpdf` |
| PDF Bookmarks | `doc.bookmarks` | Auto-generated from headings |
| Hyphenation | `doc.hyphenation` | Liang's algorithm, e.g. `language: 'en-us'` |
| Headers/Footers | `doc.header` / `doc.footer` | `{{pageNumber}}`, `{{totalPages}}`, `{{date}}` tokens |
| Per-section overrides | `doc.sections` | Different header/footer per page range |
| Metadata | `doc.metadata` | Title, author, subject, keywords, language, producer |
| Hyperlinks | `paragraph.url`, `heading.url`, `heading.anchor`, `span.href` | External, mailto, internal anchors |
| Document assembly | `merge(pdfs)`, `assemble(parts)` | Combine pre-rendered + freshly rendered |
| Path-traversal lockdown | `doc.allowedFileDirs` | Restrict file-source reads to listed dirs |

---

## API reference

### `render(doc): Promise<Uint8Array>`

```typescript
import { render } from 'pretext-pdf'

const pdf = await render({
  pageSize: 'A4',          // 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | 'Tabloid' | [w, h]
  margins: { top: 72, bottom: 72, left: 72, right: 72 },
  defaultFont: 'Inter',    // Inter 400/700 bundled
  defaultFontSize: 12,
  metadata: { title: '...', author: '...', keywords: ['pdf'] },
  watermark: { text: 'DRAFT', opacity: 0.15, rotation: -45 },
  encryption: { userPassword: 'open', ownerPassword: 'admin', permissions: { printing: true, copying: false } },
  bookmarks: { minLevel: 1, maxLevel: 3 },
  hyphenation: { language: 'en-us', minWordLength: 6 },
  header: { text: '{{pageNumber}} of {{totalPages}}', align: 'right' },
  footer: { text: 'Confidential', align: 'center', color: '#999' },
  content: [ /* ContentElement[] */ ],
})
```

### `merge(pdfs): Promise<Uint8Array>`

Combine pre-rendered PDFs:

```typescript
import { merge } from 'pretext-pdf'
const combined = await merge([coverPdf, bodyPdf, appendixPdf])
```

### `assemble(parts): Promise<Uint8Array>`

Mix new docs with existing PDFs:

```typescript
import { assemble } from 'pretext-pdf'

const report = await assemble([
  { pdf: existingCoverPdf },
  { doc: { content: [/* fresh */] } },
  { pdf: standardTermsPdf },
])
```

### `createPdf(opts): PdfBuilder` (fluent builder)

```typescript
import { createPdf } from 'pretext-pdf'

const pdf = await createPdf({ pageSize: 'A4' })
  .addHeading('My Report', 1)
  .addText('Fluent chainable API.')
  .addTable({ columns: [{ name: 'Col A' }, { name: 'Col B' }], rows: [{ 'Col A': 'x', 'Col B': 'y' }] })
  .build()
```

### `markdownToContent(md, opts?)` *(from `pretext-pdf/markdown`)*

### `createInvoice / createGstInvoice / createReport` *(from `pretext-pdf/templates`)*

### `fromPdfmake(doc, opts?)` *(from `pretext-pdf/compat`)*

---

## India / GST invoicing

Built-in support for Indian invoice requirements:

- **₹ symbol** renders correctly (bundled Inter includes the Rupee glyph)
- **Indian number formatting** (`1,00,000` not `100,000`)
- **GST structure** — CGST/SGST (intra-state) and IGST (inter-state) layouts (auto-detected from state fields)
- **Amount in words** — Indian numbering system (Lakh/Crore), with correct sub-rupee handling
- **SAC/HSN codes** — column support in line-item tables

```typescript
import { createGstInvoice } from 'pretext-pdf/templates'
import { render } from 'pretext-pdf'

const content = createGstInvoice({
  supplier: { name: 'Antigravity Systems', address: 'Gurugram, HR', gstin: '06AAACA1234A1ZV', state: 'Haryana' },
  buyer: { name: 'TechStartup Ltd', address: 'Mumbai, MH', gstin: '27AABCB5678B1ZP', state: 'Maharashtra' },
  invoiceNumber: 'INV/2026-27/001',
  invoiceDate: '20 Apr 2026',
  placeOfSupply: 'Maharashtra (27)',
  items: [
    { description: 'Software Development', hsnSac: '998314', quantity: 80, unit: 'Hrs', rate: 3000, taxRate: 18 },
  ],
  qrUpiData: 'upi://pay?pa=merchant@hdfc&pn=Antigravity&am=283200',
  bankName: 'HDFC Bank', accountNumber: '501001234567', ifscCode: 'HDFC0001234',
})
const pdf = await render({ content })
```

See [`examples/gst-invoice-india.ts`](examples/gst-invoice-india.ts) for a fully wired example.

---

## Custom fonts

```typescript
const pdf = await render({
  fonts: [
    { family: 'Roboto', weight: 400, src: '/path/to/Roboto-Regular.ttf' },
    { family: 'Roboto', weight: 700, src: '/path/to/Roboto-Bold.ttf' },
    { family: 'Roboto', style: 'italic', src: '/path/to/Roboto-Italic.ttf' },
  ],
  defaultFont: 'Roboto',
  content: [
    { type: 'paragraph', text: 'Uses Roboto' },
    { type: 'paragraph', text: 'Bold', fontWeight: 700 },
  ],
})
```

> **Avoid `system-ui`** — known Pretext layout-measurement inaccuracy on macOS. Always name fonts explicitly.

---

## Rich text

```typescript
{
  type: 'rich-paragraph',
  fontSize: 13,
  spans: [
    { text: 'Normal ' },
    { text: 'bold', fontWeight: 700 },
    { text: ' and ', fontStyle: 'italic' },
    { text: 'colored', color: '#e63946' },
    { text: ' and ' },
    { text: 'linked', href: 'https://example.com', underline: true, color: '#0070f3' },
    { text: '. Also: E=mc' },
    { text: '2', verticalAlign: 'superscript' },
    { text: ' and H' },
    { text: '2', verticalAlign: 'subscript' },
    { text: 'O.' },
  ],
}
```

---

## Footnotes

`createFootnoteSet()` produces matched reference/definition pairs with guaranteed unique IDs:

```typescript
import { render, createFootnoteSet } from 'pretext-pdf'

const notes = createFootnoteSet([
  { text: 'Smith, J. (2022). Typography in PDFs.' },
  { text: 'Ibid., p. 42.' },
])

await render({
  content: [
    {
      type: 'rich-paragraph',
      spans: [
        { text: 'See the original research' },
        { text: '¹', verticalAlign: 'superscript', footnoteRef: notes[0]!.id },
        { text: ' for details.' },
      ],
    },
    ...notes.map(n => n.def),  // footnote-def elements go at end of document
  ],
})
```

---

## Examples

```bash
npm run example                # Basic invoice
npm run example:gst            # India GST invoice
npm run example:watermark      # Text/image watermarks
npm run example:bookmarks      # PDF outline/bookmarks
npm run example:toc            # Auto table of contents
npm run example:rtl            # Arabic/Hebrew RTL text
npm run example:encryption     # Password-protected PDF
npm run example:hyperlinks     # External + email + internal anchors
npm run example:annotations    # Sticky notes
npm run example:assembly       # Merge + assemble multiple PDFs
npm run example:inline         # Super/subscript, letterSpacing, smallCaps
npm run example:forms          # Interactive form fields
npm run example:callout        # Callout boxes
```

All write to `output/*.pdf`.

---

## Error handling

Every error throws `PretextPdfError` with a typed `code`:

```typescript
import { render, PretextPdfError } from 'pretext-pdf'

try {
  const pdf = await render(config)
} catch (err) {
  if (err instanceof PretextPdfError) {
    switch (err.code) {
      case 'VALIDATION_ERROR':   // Invalid config
      case 'FONT_LOAD_FAILED':   // Font file not found
      case 'IMAGE_TOO_TALL':     // Image doesn't fit on page
      case 'IMAGE_LOAD_FAILED':  // URL fetch / safety check failed
      case 'ASSEMBLY_EMPTY':     // merge / assemble called with empty array
      // ... see CHANGELOG.md for the full list
    }
  }
}
```

This shape is also designed for AI self-correction loops — the typed `code` is enough context for an LLM to fix its own output.

---

## Troubleshooting

### Hyphenation language not found

Use **lowercase** language codes that match the npm package name:

```typescript
hyphenation: { language: 'en-us' }  // ✅
hyphenation: { language: 'en-US' }  // ❌ fails on Linux (case-sensitive FS)
```

### SVG / chart / qr-code / barcode rendering

Install `@napi-rs/canvas` (Node only — browsers use native `OffscreenCanvas`):

```bash
npm install @napi-rs/canvas
```

### PDF is blank or too small

Check margins. If `left + right` exceeds page width, content width becomes negative:

```typescript
margins: { top: 36, bottom: 36, left: 36, right: 36 }
```

### Form fields not interactive

`flattenForms: true` bakes fields into static content — by design. Remove the flag to keep them interactive.

### Browser usage

Supply font bytes via `doc.fonts: [{ family: 'Inter', weight: 400, src: <Uint8Array> }]` — the bundled Inter loader is Node-only. Also register the same font with `document.fonts.add(new FontFace(...))` so pretext's measurement matches pdf-lib's drawing.

---

## Non-goals

What pretext-pdf is **not** trying to be — pick a different tool for these:

- **Editing or parsing existing PDFs** → [`pdf-lib`](https://github.com/Hopding/pdf-lib), [`pdf-parse`](https://www.npmjs.com/package/pdf-parse)
- **Filling existing PDF form templates** → [`pdf-lib`](https://github.com/Hopding/pdf-lib), [`pdftk`](https://www.pdflabs.com/tools/pdftk-server/)
- **Heavily art-directed pages** with CSS grids, SVG illustrations, floats, background images → headless Chrome (Puppeteer)
- **PDF/A archival, PDF/UA accessibility tagging** → not yet
- **Print-shop kerning pairs, OpenType ligatures, variable-font axes beyond weight** → upstream Pretext doesn't model these

---

## Runtime footprint

Mandatory runtime dependencies:

- `@cantoo/pdf-lib` — PDF assembly
- `@chenglou/pretext` — text-layout engine
- `@fontsource/inter` + `@pdf-lib/fontkit` — bundled Inter + font subsetting
- `bidi-js` — bidirectional text resolution
- `hypher` + `hyphenation.en-us` — hyphenation

All other capabilities (SVG, charts, QR, barcodes, markdown, signing) are optional peer deps — install only what you use.

**Browser:** the library imports cleanly from any non-`file://` URL (esm.sh, Vite dev server, browser bundles) since v0.8.1. Bring your own Inter font via `doc.fonts` and register it with `document.fonts.add(...)` for accurate measurement.

---

## Performance

Benchmarked on Windows 11 / Node 22 / Intel i7-12th Gen. Averages over 10 runs, excluding the first cold JIT.

| Document | Render time | PDF size |
| --- | --- | --- |
| 1 page (heading + paragraph + list) | ~220 ms | ~45 KB |
| Mixed (heading + paragraph + 20-row table + list + hr) | ~290 ms | ~60 KB |
| 10 pages (40 sections, mixed elements) | ~1,100 ms | ~180 KB |

**Font subsetting** is automatic for TTF/OTF fonts. Only used glyphs are embedded — typically 40–60% smaller than full-font embedding. Single-font invoices render under 65 KB.

For documents with 10,000+ elements, set `NODE_OPTIONS=--max-old-space-size=4096`.

---

## Tests

600+ tests with 100% pass rate:

```bash
npm test              # Full suite (contract + unit + e2e + phases + 2f stress)
npm run test:unit     # Validation, builder, rich-text
npm run test:e2e      # End-to-end render
npm run test:phases   # All phase tests including v0.8/v0.9 features
npm run test:rich     # Rich-paragraph compositor (incl. v0.8.2 whitespace regressions)
npm run test:contract # Public API surface contracts
npm run test:visual   # Pixel-diff visual regressions
```

**Coverage**: type safety, path validation, SSRF, error handling, boundary cases, crypto signing, document assembly, every content element, optional-dep error codes, MCP tool validation, browser import simulation.

---

## Security

A comprehensive April 2026 audit fixed 41 issues across path-traversal protection, async I/O, error sanitization, type safety, and explicit failure modes. Subsequent fixes:

- **v0.8.3** — IPv4-mapped IPv6 SSRF bypass closed; `fetch` redirects now revalidated per hop.
- **v0.8.1** — Browser module-init crashes fixed (Node-only APIs gated behind `IS_NODE` checks).

Highlights of the current security posture:

- Opt-in `allowedFileDirs` lockdown for user-controlled file inputs
- All error messages sanitized (no filesystem paths or secrets leak)
- Async file I/O throughout (non-blocking)
- Strict TypeScript with documented `any`-casts only at pdf-lib internal boundaries
- HTTPS-only fetch with private-IP / SSRF guard, including IPv6
- HTTP redirect chain re-validated against the same SSRF guard

See [SECURITY.md](SECURITY.md) for disclosure policy.

---

## Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| 1–6 | Core engine, pagination, typography, rich text, builder, columns | ✅ |
| 7A–G | Bookmarks, watermarks, hyphenation, TOC, SVG, RTL, encryption | ✅ |
| 8A–H | Annotations, forms, assembly, callouts, signatures, metadata, hyperlinks, inline formatting | ✅ |
| 9A–C | Cryptographic signatures (PKCS#7), image floats, font subsetting | ✅ |
| 10A–D | QR codes, barcodes, Vega-Lite charts, Markdown, templates | ✅ |
| 11+ | Performance enhancements, hardening | ✅ |
| **0.9.0** | **CLI, pdfmake compat shim, GFM tables + task lists** | ✅ |
| Future | Variable fonts, OpenType features, PDF/A, PDF/UA accessibility | 🔜 |

See [docs/ROADMAP.md](docs/ROADMAP.md).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). TDD approach — write tests first.

Useful commands:

```bash
npm install            # one-time setup
npm run build          # tsc → dist/
npm run typecheck      # tsc --noEmit
npm test               # full suite
npm run example        # run a sample render
```

---

## License

[MIT](LICENSE)

---

## Credits

Built by [Himanshu Jain](https://github.com/Himaan1998Y) on the shoulders of [pretext](https://github.com/chenglou/pretext), [pdf-lib](https://github.com/Hopding/pdf-lib), and [@napi-rs/canvas](https://github.com/napi-rs/canvas).

Questions? [Open an issue](https://github.com/Himaan1998Y/pretext-pdf/issues) — or try it live at the [demo](https://himaan1998y.github.io/pretext-pdf/).
