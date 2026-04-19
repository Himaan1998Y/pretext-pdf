# pretext-pdf

> **The PDF library AI agents speak natively.**
>
> A `PdfDocument` is plain JSON. LLMs emit it in one shot — no codegen, no headless browser, no `eval`. Humans get a strict-typed, declarative API for invoices, reports, and templates.

[![npm version](https://img.shields.io/npm/v/pretext-pdf)](https://www.npmjs.com/package/pretext-pdf)
[![npm downloads](https://img.shields.io/npm/dw/pretext-pdf)](https://www.npmjs.com/package/pretext-pdf)
[![CI](https://github.com/Himaan1998Y/pretext-pdf/actions/workflows/ci.yml/badge.svg)](https://github.com/Himaan1998Y/pretext-pdf/actions)
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-598-brightgreen)](#test-coverage)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**[Live demo](https://himaan1998y.github.io/pretext-pdf/)** — edit JSON, render PDFs instantly. No install.
**[`pretext-pdf-mcp`](https://www.npmjs.com/package/pretext-pdf-mcp)** — drop-in MCP server for Claude / Cursor / Windsurf.
**[Migrating from pdfmake?](docs/MIGRATION_FROM_PDFMAKE.md)** — every pattern mapped.

*Layout powered by [`@chenglou/pretext`](https://github.com/chenglou/pretext) — the precision text-layout engine by [Cheng Lou](https://github.com/chenglou) (React core team, Midjourney).*

---

## Why pretext-pdf

There are three established camps in JS PDF generation, and one gap. pretext-pdf lives in the gap.

| | pdfmake / jsPDF / pdfkit | Puppeteer / Playwright | LaTeX / WeasyPrint | **pretext-pdf** |
|---|---|---|---|---|
| Lightweight (no Chromium) | ✅ | ❌ ~300 MB | ❌ native binaries | ✅ |
| Pure ESM, runs in serverless | ✅ | ⚠️ painful in Lambda | ❌ | ✅ |
| Professional typography (kerning, hyphenation, RTL/CJK) | ❌ | ✅ | ✅ | ✅ |
| Declarative — describe the document, don't draw it | ⚠️ partial | ❌ | ❌ | ✅ |
| **LLM emits a working document in one shot** | ❌ requires a code-execution loop | ❌ requires HTML+CSS knowledge | ❌ requires LaTeX knowledge | ✅ pure JSON |
| MCP server available out of the box | ❌ | ❌ | ❌ | ✅ |

**The headline:** every other JS PDF library asks an LLM to *write code*. pretext-pdf asks it for a JSON object. That difference is what makes agent-generated PDFs reliable.

---

## Built for AI agents

A `PdfDocument` is a plain JSON object. No functions are required. No classes to instantiate. Every field is optional except `type` and a few element-specific essentials. That shape is exactly what an LLM can produce reliably with no tool-use loop.

### Drop into Claude / Cursor / Windsurf via MCP

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

Tools exposed: `generate_pdf`, `generate_invoice`, `generate_report`, `generate_from_markdown`, `list_element_types`. Built on the live [`pretext-pdf-mcp`](https://www.npmjs.com/package/pretext-pdf-mcp) package — versioned alongside this library.

### Or call from any agent framework

```typescript
import { render } from 'pretext-pdf'

// Whatever produced this JSON — Claude, GPT, a workflow node, a form submission — works the same
const pdf = await render({
  metadata: { title: 'AI-generated quarterly report' },
  content: [
    { type: 'heading', level: 1, text: 'Q1 2026 Summary' },
    { type: 'paragraph', text: 'Revenue grew 18% YoY.' },
    { type: 'table', columns: [...], rows: [...] },
  ],
})
```

### Why JSON-first matters for agents

- **No code execution loop.** The model returns JSON; you call `render()`. No sandbox, no `vm`, no Vercel Sandbox roundtrip.
- **Schema-validatable.** Strict TypeScript types double as the contract. Pair with [Anthropic tool use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) or [Vercel AI SDK structured output](https://sdk.vercel.ai/docs/ai-sdk-core/generating-structured-data) for guaranteed-shape results.
- **Self-correcting errors.** Every failure throws `PretextPdfError` with a typed `code`. Feed it back to the model and it fixes itself.
- **Progressive disclosure.** Optional peer deps mean an agent can ask for QR codes, charts, or markdown only when needed — token-efficient prompts.

---

## Install

```bash
npm install pretext-pdf
```

> **ESM only** — use `import`, not `require`. Requires Node.js ≥ 18.

Optional peer dependencies — install only what you need:

```bash
npm install @napi-rs/canvas    # SVG / qr-code / barcode / chart elements
npm install qrcode             # qr-code element
npm install bwip-js            # barcode element
npm install vega vega-lite     # chart element (Vega-Lite specs → vector SVG)
npm install marked             # pretext-pdf/markdown entry point
npm install @signpdf/signpdf   # PKCS#7 cryptographic signing
```

> **Encryption is built-in** since v0.4.0 — no extra install needed. Just add `encryption` to your document config.

---

## Quick start

```typescript
import { render } from 'pretext-pdf'
import { writeFileSync } from 'fs'

const pdf = await render({
  pageSize: 'A4',
  margins: { top: 40, bottom: 40, left: 50, right: 50 },
  metadata: { title: 'My Invoice', author: 'Acme Corp' },
  content: [
    { type: 'heading', level: 1, text: 'Invoice #12345' },
    { type: 'paragraph', text: 'Thank you for your business.', fontSize: 12 },
    {
      type: 'table',
      columns: [
        { name: 'Item', width: 200 },
        { name: 'Qty', width: 50, align: 'right' },
        { name: 'Price', width: 100, align: 'right' },
      ],
      rows: [
        { Item: 'Professional Services', Qty: '10', Price: '$1,000' },
        { Item: 'Hosting (annual)', Qty: '1', Price: '$500' },
      ],
    },
    { type: 'paragraph', text: 'Total: $1,500', align: 'right', fontWeight: 700 },
  ],
})

writeFileSync('invoice.pdf', pdf)
```

### Builder API (fluent style)

```typescript
import { createPdf } from 'pretext-pdf'

const pdf = await createPdf({ pageSize: 'A4' })
  .addHeading('My Report', 1)
  .addText('Fluent chainable API.')
  .addTable({ columns: [{ name: 'Col A' }, { name: 'Col B' }], rows: [{ 'Col A': 'x', 'Col B': 'y' }] })
  .build()
```

---

## Output samples

Real documents generated with pretext-pdf:

| Invoice | Market Report | Resume / CV |
|---------|--------------|-------------|
| [![Invoice](docs/screenshots/showcase-invoice.png)](examples/showcase-invoice.ts) | [![Report](docs/screenshots/showcase-report.png)](examples/showcase-report.ts) | [![Resume](docs/screenshots/showcase-resume.png)](examples/showcase-resume.ts) |
| [View source](examples/showcase-invoice.ts) | [View source](examples/showcase-report.ts) | [View source](examples/showcase-resume.ts) |

---

## What's in v0.8.0

Five new capabilities, all behind optional peer dependencies (zero extra weight if unused):

- **`qr-code`** — scannable QR codes for UPI payments, URLs, vCards. Requires `qrcode`.
- **`barcode`** — 100+ symbologies (EAN-13, Code128, PDF417, DataMatrix…). Requires `bwip-js`.
- **`chart`** — embed Vega-Lite specs as crisp vector SVG. Requires `vega` + `vega-lite`.
- **`pretext-pdf/markdown`** — convert any Markdown string to `ContentElement[]` in one call. Requires `marked`.
- **`pretext-pdf/templates`** — zero-dep template helpers: `createInvoice`, `createGstInvoice` (India GST / IGST / CGST+SGST), `createReport`.

See [CHANGELOG.md](CHANGELOG.md) for the full history.

---

## India / GST invoicing

pretext-pdf has built-in support for Indian invoice requirements:

- **₹ symbol** renders correctly (bundled Inter font includes the Rupee glyph)
- **Indian number formatting** — helper for 1,00,000 notation (not 100,000)
- **GST structure** — CGST/SGST (intra-state) and IGST (inter-state) table layouts
- **Amount in words** — Indian numbering system (Lakh/Crore)
- **SAC/HSN codes** — column support in line-item tables

Use the `createGstInvoice` template for a complete GST-compliant invoice in one call:

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
  isInterState: true,            // auto-detected from state fields if omitted
  qrUpiData: 'upi://pay?pa=merchant@hdfc&pn=Antigravity&am=283200',
  bankName: 'HDFC Bank', accountNumber: '501001234567', ifscCode: 'HDFC0001234',
})
const pdf = await render({ content })
```

See [`examples/gst-invoice-india.ts`](examples/gst-invoice-india.ts) for the raw element approach.

---

## Markdown → PDF (`pretext-pdf/markdown`)

Convert any Markdown string to a `pretext-pdf` document in one call. Requires `marked` peer dep.

```typescript
import { markdownToContent } from 'pretext-pdf/markdown'
import { render } from 'pretext-pdf'
import { writeFileSync } from 'fs'

const md = `
# Q1 2026 Report

Revenue grew **18%** year-over-year, driven by:

- Cloud services (+32%)
- Enterprise licenses (+12%)

> All figures are in USD millions.
`

const content = await markdownToContent(md, {
  codeFontFamily: 'Courier New',  // enables fenced code block rendering
})
const pdf = await render({ content })
writeFileSync('report.pdf', pdf)
```

Supported Markdown: headings h1–h4, bold, italic, strikethrough, inline code, links, ordered/unordered lists (2 levels), fenced code blocks, blockquotes, horizontal rules.

---

## Invoice & report templates (`pretext-pdf/templates`)

Pre-built zero-dependency template functions that generate `ContentElement[]` arrays:

```typescript
import { createInvoice, createGstInvoice, createReport } from 'pretext-pdf/templates'
import { render } from 'pretext-pdf'

// Generic invoice (any currency)
const invoiceContent = createInvoice({
  from: { name: 'Acme Corp', address: '123 Main St', email: 'billing@acme.com' },
  to: { name: 'Client Ltd', address: '456 Oak Ave' },
  invoiceNumber: 'INV-2026-001', date: '2026-04-20',
  items: [{ description: 'Consulting', quantity: 10, unitPrice: 150 }],
  currency: '$', taxRate: 10, taxLabel: 'GST',
  qrData: 'upi://pay?pa=acme@bank&am=1650',
})

// Research report with optional TOC
const reportContent = createReport({
  title: 'Annual Performance Report',
  author: 'Finance Team', date: 'April 2026',
  abstract: 'Revenue grew 18% YoY across all segments.',
  includeTableOfContents: true,
  sections: [
    { title: 'Revenue', paragraphs: ['Cloud +32%, Enterprise +12%.'], bullets: ['SaaS: $2.8M', 'Services: $1.1M'] },
  ],
})

const pdf = await render({ content: reportContent })
```

---

## Element type reference

```
paragraph    heading(1-4)   spacer       hr           page-break
table        image          svg          list         code
blockquote   rich-paragraph callout      comment      form-field
toc          qr-code        barcode      chart        footnote-def
```

| Element | What it does |
| --- | --- |
| `paragraph` | Text block — font, size, color, align, background, letterSpacing, smallCaps, tabularNumbers, multi-column (`columns` + `columnGap`), RTL (`dir`) |
| `heading` | H1–H4 with bookmarks, URL links, internal anchors, tabularNumbers, RTL (`dir`) |
| `table` | Fixed/proportional columns, colspan, rowspan, repeating headers across page breaks |
| `image` | PNG/JPG/WebP with sizing, alignment, float left/right with `floatText` or rich `floatSpans` (mixed-format caption) |
| `list` | Ordered/unordered, 2-level nesting, `nestedNumberingStyle: 'restart' \| 'continue'` |
| `code` | Monospace block with background and padding |
| `blockquote` | Left border + background |
| `rich-paragraph` | Mixed bold/italic/color/size/super/subscript spans with inline hyperlinks |
| `svg` | Embedded SVG graphics with auto-sizing from viewBox |
| `toc` | Auto-generated table of contents with accurate page numbers (two-pass) |
| `qr-code` | Scannable QR code — UPI payment links, URLs, vCards. `data`, `size`, `errorCorrectionLevel`, `foreground`/`background` color. Requires `qrcode` peer dep. |
| `barcode` | 100+ symbologies — EAN-13, Code128, PDF417, DataMatrix, and more via `symbology` field. Requires `bwip-js` peer dep. |
| `chart` | Vega-Lite data visualisation — pass any valid Vega-Lite spec to `spec`. Rendered as vector SVG. Requires `vega` + `vega-lite` peer deps. |
| `comment` | PDF sticky-note annotation (visible in Acrobat/Preview sidebar) |
| `hr` | Horizontal rule |
| `spacer` | Fixed-height gap |
| `page-break` | Force new page |

### Document-level features

| Feature | Config key | Notes |
| --- | --- | --- |
| Watermarks | `doc.watermark` | Text or image, opacity, rotation |
| Encryption | `doc.encryption` | Password + granular permissions |
| PDF Bookmarks | `doc.bookmarks` | Auto-generated from headings |
| Hyphenation | `doc.hyphenation` | Liang's algorithm, `language: 'en-us'` |
| Headers/Footers | `doc.header` / `doc.footer` | `{{pageNumber}}`, `{{totalPages}}`, `{{date}}`, `{{author}}` tokens |
| Per-section overrides | `doc.sections` | Different header/footer/margins per page range |
| Metadata | `doc.metadata` | Title, author, subject, keywords, `language` (PDF /Lang), `producer` |
| Hyperlinks | `paragraph.url`, `heading.url`, `heading.anchor`, `span.href` | External, mailto, internal anchors |
| Inline formatting | `span.verticalAlign: 'superscript'\|'subscript'`, `paragraph.letterSpacing`, `heading.smallCaps` | |
| Sticky notes | `{ type: 'comment', contents: '...' }`, `paragraph.annotation` | |
| Document assembly | `merge(pdfs)`, `assemble(parts)` | Combine pre-rendered + freshly rendered |
| Interactive forms | `{ type: 'form-field', fieldType: 'text'\|'checkbox'\|'radio'\|'dropdown'\|'button' }`, `doc.flattenForms` | |
| Cryptographic signing | `doc.signature: { p12, passphrase, signerName, reason, location }` | PKCS#7 via optional `@signpdf/signpdf` |
| Visual signature placeholder | `doc.signature: { signerName, reason, location, x, y, page }` | |
| Callout boxes | `{ type: 'callout', content, style: 'info'\|'warning'\|'tip'\|'note', title }` | |

---

## API reference

### `render(doc): Promise<Uint8Array>`

```typescript
import { render } from 'pretext-pdf'

const pdf = await render({
  pageSize: 'A4',          // 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | [w, h]
  margins: { top: 72, bottom: 72, left: 72, right: 72 },
  defaultFont: 'Inter',    // Inter 400 bundled; load others via doc.fonts
  defaultFontSize: 12,
  metadata: {
    title: 'Document Title',
    author: 'Author Name',
    subject: 'Description',
    keywords: ['pdf', 'report'],
  },
  watermark: { text: 'DRAFT', opacity: 0.15, rotation: -45 },
  encryption: { userPassword: 'open', ownerPassword: 'admin', permissions: { printing: true, copying: false } },
  bookmarks: { minLevel: 1, maxLevel: 3 },
  hyphenation: { language: 'en-us', minWordLength: 6 }, // ⚠️ Use lowercase: 'en-us' not 'en-US' — matches the npm package name hyphenation.en-us
  header: { text: 'My Document — {{pageNumber}} of {{totalPages}}', align: 'right' },
  footer: { text: 'Confidential', align: 'center', color: '#999999' },
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

Mix new document configs with existing PDFs:

```typescript
import { assemble } from 'pretext-pdf'

const report = await assemble([
  { pdf: existingCoverPdf },
  { doc: { content: [...] } },   // rendered fresh
  { pdf: standardTermsPdf },
])
```

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
    { type: 'paragraph', text: 'Uses Roboto font' },
    { type: 'paragraph', text: 'Bold text', fontWeight: 700 },
  ],
})
```

> **Avoid `system-ui`** as a font name on macOS — it triggers a known layout-measurement inaccuracy in Pretext. Always name fonts explicitly.

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

Use `createFootnoteSet()` to generate matched reference/definition pairs with guaranteed unique IDs:

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

Run working examples from the `examples/` directory:

```bash
# v0.8.0 new element examples (install optional deps first)
# npm install qrcode bwip-js vega vega-lite marked

# Phase 7 examples
npm run example                # Basic invoice
npm run example:watermark      # Text/image watermarks
npm run example:bookmarks      # PDF outline/bookmarks
npm run example:toc            # Auto table of contents
npm run example:rtl            # Arabic/Hebrew RTL text
npm run example:encryption     # Password-protected PDF

# Phase 8 examples
npm run example:hyperlinks     # External links, email links, internal anchors
npm run example:annotations    # Sticky notes on elements
npm run example:assembly       # Merge and assemble multiple PDFs
npm run example:inline         # Superscript, subscript, letter-spacing, small-caps
npm run example:forms          # Interactive form fields
npm run example:callout        # Callout boxes (info, warning, tip, note)
npm run example:gst            # India GST-compliant invoice
```

All examples write output to `output/*.pdf`.

---

## Error handling

Every error throws `PretextPdfError` with a typed `code` — designed so an LLM (or a human) can self-correct:

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
      case 'ASSEMBLY_EMPTY':     // merge/assemble called with empty array
      // ... see CHANGELOG.md for full list
    }
  }
}
```

---

## Troubleshooting

### Hyphenation language not found

```
UNSUPPORTED_LANGUAGE: Language 'en-US' not supported
```

Use **lowercase** language codes that match the npm package name:

```typescript
// Wrong — 'en-US' fails on Linux (case-sensitive filesystem)
hyphenation: { language: 'en-US' }

// Correct — matches 'hyphenation.en-us' package name
hyphenation: { language: 'en-us' }
```

### SVG rendering requires optional dependency

Install `@napi-rs/canvas` for SVG / chart / qr-code / barcode support:

```bash
npm install @napi-rs/canvas
```

### PDF is blank or too small

Check margins — if left+right margins exceed page width, content width becomes negative:

```typescript
// For narrow pages, reduce margins:
margins: { top: 36, bottom: 36, left: 36, right: 36 }
```

### Form fields not interactive after `flattenForms`

`flattenForms: true` bakes fields into static content — by design. Remove it to keep them interactive.

---

## Non-goals

What pretext-pdf is **not** trying to be — pick a different tool for these:

- **Editing or parsing existing PDFs** → [`pdf-lib`](https://github.com/Hopding/pdf-lib), [`pdf-parse`](https://www.npmjs.com/package/pdf-parse)
- **Filling existing PDF form templates** → [`pdf-lib`](https://github.com/Hopding/pdf-lib), [`pdftk`](https://www.pdflabs.com/tools/pdftk-server/)
- **Heavily art-directed pages** with CSS grids, SVG illustrations, floats, background images → headless Chrome (Puppeteer) still wins
- **PDF/A archival, PDF/UA accessibility tagging** → not yet
- **Print-shop kerning pairs, OpenType ligatures, variable-font axes beyond weight** → Pretext itself doesn't model these

---

## Runtime requirements

- **Node.js ≥ 18** with `@napi-rs/canvas` peer dep (lazy-loaded — only required when you use SVG/chart/QR/barcode elements)
- **`Intl.Segmenter`** (built-in on Node 18+ and all modern browsers)
- **Browser support** — works directly in modern browsers; bring your own font bytes
- **Cold-start cost** on serverless: `@napi-rs/canvas` adds ~5–10 MB and a few hundred ms on the first request. Subsequent requests in a warm container are sub-second.
- **Fonts must be fully loaded** before `render()` runs — for browser usage, await `document.fonts.ready` first

---

## Performance

Benchmarked on Windows 11 / Node 22 / Intel i7-12th Gen. Numbers are averages over 10 runs, excluding the first cold JIT run.

| Document | Render time | PDF size |
| --- | --- | --- |
| 1 page (heading + paragraph + list) | ~220 ms | ~45 KB |
| 10 pages (40 sections, mixed elements) | ~1,100 ms | ~180 KB |
| Mixed (heading + paragraph + 20-row table + list + hr) | ~290 ms | ~60 KB |

**Font subsetting** is automatic for TTF/OTF fonts. Only the glyphs used in the document are embedded, typically reducing PDF size by 40–60% compared to full font embedding. A typical single-font invoice renders under 65 KB. WOFF2 fonts are embedded without subsetting due to an upstream library limitation.

For large documents (10,000+ elements), set `NODE_OPTIONS=--max-old-space-size=4096` to prevent GC pressure.

---

## Test coverage

598+ tests across all phases with 100% pass rate:

```bash
npm test              # Full suite (unit + e2e + all phases including v0.8.0)
npm run test:unit     # Validation, builder, rich-text unit tests
npm run test:e2e      # End-to-end render tests
npm run test:10a      # QR code + barcode tests
npm run test:10b      # Vega-Lite chart tests
npm run test:10c      # Markdown converter tests
npm run test:10d      # Template function tests
npm run test:phases   # All phase tests (7–11, performance, signatures)
```

**Coverage**: type safety, path validation, error handling, boundary cases, crypto signing, document assembly, all content elements, optional-dep error codes, MCP tool validation.

---

## Security

Comprehensive April 2026 security audit completed — 41 issues identified and fixed across path-traversal protection, async I/O, error sanitization, type-safety, and explicit failure modes. See [SECURITY.md](SECURITY.md) for the disclosure policy and [CHANGELOG.md](CHANGELOG.md) for audit details.

Highlights:
- Zero known path-traversal vulnerabilities; opt-in `allowedFileDirs` lockdown for user-controlled inputs
- All error messages sanitized — no filesystem paths or secrets leak through
- Async file I/O throughout (non-blocking)
- Strict TypeScript with documented `any`-casts only at pdf-lib internal boundaries

---

## Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| 1–6 | Core engine, pagination, typography, rich text, builder, columns | ✅ |
| 7A–G | Bookmarks, watermarks, hyphenation, TOC, SVG, RTL, encryption | ✅ |
| 8A–H | Annotations, forms, assembly, callouts, signatures, metadata, hyperlinks, inline formatting | ✅ |
| 9A–C | Cryptographic signatures (PKCS#7), image floats, font subsetting | ✅ |
| 10A–D | QR codes, barcodes, Vega-Lite charts, Markdown, templates | ✅ |
| 11+ | Variable fonts, OpenType features, PDF/A, PDF/UA accessibility | 🔜 |

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full plan.

---

## Migration from pdfmake

Coming from pdfmake? See the **[Migration Guide](docs/MIGRATION_FROM_PDFMAKE.md)** — every common pdfmake pattern mapped to its pretext-pdf equivalent.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). TDD approach — write tests first.

---

## License

[MIT](LICENSE)

---

## Credits

Built by [Himanshu Jain](https://github.com/Himaan1998Y) on the shoulders of [pretext](https://github.com/chenglou/pretext), [pdf-lib](https://github.com/Hopding/pdf-lib), and [@napi-rs/canvas](https://github.com/napi-rs/canvas).

Questions? [Open an issue](https://github.com/Himaan1998Y/pretext-pdf/issues) — or try it live at the [demo](https://himaan1998y.github.io/pretext-pdf/).
