# pretext-pdf

> **Declarative JSON → PDF generation with professional typography.**
>
> Build sophisticated, multi-page documents with precise text layout, international support, and zero browser overhead.

[![npm version](https://img.shields.io/npm/v/pretext-pdf)](https://www.npmjs.com/package/pretext-pdf)
[![npm downloads](https://img.shields.io/npm/dw/pretext-pdf)](https://www.npmjs.com/package/pretext-pdf)
[![CI](https://github.com/Himaan1998Y/pretext-pdf/actions/workflows/ci.yml/badge.svg)](https://github.com/Himaan1998Y/pretext-pdf/actions)
[![TypeScript](https://img.shields.io/badge/typescript-strict-blue)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-146%2B-brightgreen)](#test-coverage)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

---

## Why pretext-pdf?

| | pdfmake | Puppeteer | **pretext-pdf** |
|---|---|---|---|
| Easy declarative API | ✅ | ❌ | ✅ |
| Professional typography | ❌ | ✅ | ✅ |
| Lightweight (no browser) | ✅ | ❌ | ✅ |
| International text (RTL/CJK) | ❌ | ✅ | ✅ |
| Pure Node.js | ✅ | ❌ | ✅ |
| Hyperlinks + annotations | ❌ | ✅ | ✅ |
| Document assembly | ❌ | ❌ | ✅ |

### Powered by [pretext](https://github.com/chenglou/pretext)

Pretext is a precision text layout engine by [Cheng Lou](https://github.com/chenglou) (React core team, Midjourney).

```
JSON descriptor  →  pretext layout  →  pdf-lib renderer  →  PDF bytes
                     (kerning,           (annotations,
                      hyphenation,        encryption,
                      RTL, CJK)           hyperlinks)
```

---

## Output Samples

Real documents generated with pretext-pdf:

| Invoice | Market Report | Resume / CV |
|---------|--------------|-------------|
| [![Invoice](docs/screenshots/showcase-invoice.png)](examples/showcase-invoice.ts) | [![Report](docs/screenshots/showcase-report.png)](examples/showcase-report.ts) | [![Resume](docs/screenshots/showcase-resume.png)](examples/showcase-resume.ts) |
| [View source](examples/showcase-invoice.ts) | [View source](examples/showcase-report.ts) | [View source](examples/showcase-resume.ts) |

---

## Install

```bash
npm install pretext-pdf
```

Optional peer dependencies:
```bash
npm install @cantoo/pdf-lib    # Required for encryption
npm install @napi-rs/canvas    # Required for SVG support (auto-installed in most setups)
```

---

## Quick Start

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

### Builder API

```typescript
import { createPdf } from 'pretext-pdf'

const pdf = await createPdf({ pageSize: 'A4' })
  .addHeading('My Report', 1)
  .addText('Fluent chainable API.')
  .addTable({ columns: [{ name: 'Col A' }, { name: 'Col B' }], rows: [{ 'Col A': 'x', 'Col B': 'y' }] })
  .build()
```

---

## Agent / AI Integration

pretext-pdf works great as a tool for AI agents generating PDFs on demand.

### Quick pattern for LLMs

```typescript
import { render } from 'pretext-pdf'

// Every PdfDocument is a plain JSON object — perfect for AI generation
const pdf = await render({
  metadata: { title: 'AI-Generated Report' },
  content: [
    { type: 'heading', level: 1, text: 'Summary' },
    { type: 'paragraph', text: 'Generated content here.' },
    // ... AI fills this array
  ]
})
```

### Key facts for AI agents

- `content` is an array of typed elements — each has a `type` field
- All fields are optional except `type` and element-specific required fields (e.g. `text`, `level`)
- Errors are typed: `err.code` tells you exactly what went wrong
- `render()` is fully async, safe to `await` in any context
- Works in Node.js 18+ and modern browsers (with `@napi-rs/canvas` for SVG)

### Element type reference (quick)

```
paragraph    heading(1-4)   spacer       hr           page-break
table        image          svg          list         code
blockquote   rich-paragraph callout      comment      form-field
toc
```

---

## Features

### Element Types

| Element | What it does |
|---------|-------------|
| `paragraph` | Text block — font, size, color, align, background, letterSpacing, smallCaps |
| `heading` | H1–H4 with bookmarks, URL links, internal anchors |
| `table` | Fixed/proportional columns, colspan, repeating headers across page breaks |
| `image` | PNG/JPG/WebP with sizing, alignment, auto-format detection |
| `list` | Ordered/unordered, nested, custom markers |
| `code` | Monospace block with background and padding |
| `blockquote` | Left border + background |
| `rich-paragraph` | Mixed bold/italic/color/size/super/subscript spans with inline hyperlinks |
| `svg` | Embedded SVG graphics with auto-sizing from viewBox |
| `toc` | Auto-generated table of contents with accurate page numbers (two-pass) |
| `comment` | PDF sticky-note annotation (visible in Acrobat/Preview sidebar) |
| `hr` | Horizontal rule |
| `spacer` | Fixed-height gap |
| `page-break` | Force new page |

### Document Features

| Feature | Config key | Notes |
|---------|-----------|-------|
| Watermarks | `doc.watermark` | Text or image, opacity, rotation |
| Encryption | `doc.encryption` | Password + granular permissions |
| PDF Bookmarks | `doc.bookmarks` | Auto-generated from headings |
| Hyphenation | `doc.hyphenation` | Liang's algorithm, `language: 'en-us'` |
| Headers/Footers | `doc.header` / `doc.footer` | `{{pageNumber}}` / `{{totalPages}}` tokens |
| Metadata | `doc.metadata` | Title, author, subject, keywords, `language` (PDF /Lang), `producer` |

### Phase 8 Features

| Feature | API |
|---------|-----|
| **Hyperlinks** | `paragraph.url`, `heading.url`, `heading.anchor`, `span.href` |
| **Inline formatting** | `span.verticalAlign: 'superscript'\|'subscript'`, `paragraph.letterSpacing`, `heading.smallCaps` |
| **Sticky notes** | `{ type: 'comment', contents: '...' }`, `paragraph.annotation` |
| **Document assembly** | `merge(pdfs)`, `assemble(parts)` |
| **Interactive forms** | `{ type: 'form-field', fieldType: 'text'\|'checkbox'\|'radio'\|'dropdown'\|'button' }`, `doc.flattenForms` |
| **Signature placeholder** | `doc.signature: { signerName, reason, location, x, y, page }` |
| **Callout boxes** | `{ type: 'callout', content, style: 'info'\|'warning'\|'tip'\|'note', title }` |

---

## Examples

Run working examples from the `examples/` directory:

```bash
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
npm run example:forms          # Interactive form fields (text, checkbox, radio, dropdown)
npm run example:callout        # Callout boxes (info, warning, tip, note presets)
```

All examples write output to `output/*.pdf`.

---

## API Reference

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

## Error Handling

Every error throws `PretextPdfError` with a typed code:

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
      case 'ENCRYPTION_NOT_AVAILABLE':  // @cantoo/pdf-lib not installed
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

### Encryption requires optional dependency

Install `@cantoo/pdf-lib` separately before using `doc.encryption`:

```bash
npm install @cantoo/pdf-lib
```

### SVG rendering requires optional dependency

Install `@napi-rs/canvas` for SVG support:

```bash
npm install @napi-rs/canvas
```

### PDF is blank or too small

Check margins — if left+right margins exceed page width, content width becomes negative:

```typescript
// For narrow pages, reduce margins:
margins: { top: 36, bottom: 36, left: 36, right: 36 }
```

### Form fields not interactive after flattenForms

`flattenForms: true` bakes fields into static content — by design. Remove it to keep interactive.

---

## Test Coverage

146 tests across all phases:

```bash
npm test              # All 146 tests
npm run test:unit     # Validation, builder, rich-text unit tests
npm run test:e2e      # End-to-end render tests
npm run test:phase-7  # Phase 7A-7G feature tests
npm run test:phase-8  # Phase 8A-8H feature tests
```

---

## Custom Fonts

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

---

## Rich Text

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

## Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| 1–4 | Core engine, pagination, typography | ✅ |
| 5 | Rich text / builder API | ✅ |
| 6 | Headers/footers, columns, decoration | ✅ |
| 7A | PDF Bookmarks / Outline | ✅ |
| 7B | Watermarks | ✅ |
| 7C | Hyphenation | ✅ |
| 7D | Table of Contents | ✅ |
| 7E | SVG support | ✅ |
| 7F | RTL text (Arabic/Hebrew) | ✅ |
| 7G | Encryption | ✅ |
| 8A | Sticky note annotations | ✅ |
| 8B | Interactive forms (text/checkbox/radio/dropdown/button) | ✅ |
| 8C | Document assembly (merge + assemble) | ✅ |
| 8D | Callout boxes (info/warning/tip/note) | ✅ |
| 8E | Signature placeholder | ✅ |
| 8F | Document metadata (language, producer) | ✅ |
| 8G | Hyperlinks | ✅ |
| 8H | Inline formatting (super/subscript, letterSpacing, smallCaps) | ✅ |
| 9A | Digital signatures (cryptographic, PKCS#7) | 🔜 |
| 9B | Image floats (text flowing around images) | 🔜 |
| 9C | Font subsetting pre-computation | 🔜 |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). TDD approach — write tests first.

---

## License

[MIT](LICENSE)

---

## Credits

Built by [Himanshu Jain](https://github.com/Himaan1998Y) on top of:
- **[pretext](https://github.com/chenglou/pretext)** — Text layout engine (Cheng Lou)
- **[pdf-lib](https://github.com/Hopding/pdf-lib)** — PDF manipulation
- **[@napi-rs/canvas](https://github.com/napi-rs/canvas)** — Server-side Canvas API for Node.js

Questions? [Open an issue](https://github.com/Himaan1998Y/pretext-pdf/issues)
