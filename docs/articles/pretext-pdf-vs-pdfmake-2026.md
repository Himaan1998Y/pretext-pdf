---
title: "pretext-pdf vs pdfmake in 2026: An Honest Comparison"
published: false
description: "Side-by-side comparison of pretext-pdf and pdfmake for Node.js PDF generation — typography quality, API ergonomics, features, and benchmarks."
tags: pdf, nodejs, typescript, javascript
canonical_url: ""
cover_image: ""
---

# pretext-pdf vs pdfmake in 2026: An Honest Comparison

If you're generating PDFs in Node.js today, pdfmake is the name you've heard most. It's been the standard declarative choice for a decade — JSON-in, PDF-out, browser support included. It works.

But typography quality expectations have risen. TypeScript is everywhere. And pdfmake's line-breaking algorithm still produces the same rivers and uneven word gaps it always has.

**pretext-pdf** starts from a different premise: what if PDF generation used the same paragraph-level line-breaking algorithm that TeX has used since 1984?

This is an honest comparison. Both libraries work. Both have real tradeoffs. Read to the end before deciding.

---

## TL;DR — Feature Matrix

| Feature | pdfmake | pretext-pdf |
|---|:---:|:---:|
| Line-breaking algorithm | Greedy | Knuth-Plass |
| Hyphenation | ❌ | ✅ (multi-language) |
| RTL / BiDi text | Partial | ✅ Full |
| TypeScript (strict) | Types only | ✅ Discriminated union |
| Browser support | ✅ Native | ❌ Node.js only |
| Encryption (permissions) | ❌ | ✅ |
| PDF bookmarks / outline | Partial | ✅ Auto-generated |
| Auto Table of Contents | ❌ | ✅ |
| Interactive forms | ❌ | ✅ |
| Digital signatures (PKCS#7) | ❌ | ✅ |
| Document assembly / merge | ❌ | ✅ |
| Sticky annotations | ❌ | ✅ |
| Callout boxes | ❌ | ✅ |
| Footnotes | ❌ | ✅ |
| Image floats | ❌ | ✅ |
| SVG native embed | ❌ | ✅ |
| Syntax-highlighted code blocks | ❌ | ✅ (via highlight.js) |
| Font subsetting | ✅ | ✅ |
| Custom fonts | ✅ | ✅ |
| QR codes (built-in) | ✅ | ❌ |
| Canvas drawing API | ✅ | ❌ (use SVG) |
| Global named styles | ✅ | ❌ (TypeScript helpers) |
| Zero setup / boilerplate | ❌ | ✅ |

---

## 1. Setup and Boilerplate

This is the most immediate difference.

**pdfmake — requires VFS initialization:**

```javascript
import pdfMake from 'pdfmake/build/pdfmake.js'
import pdfFonts from 'pdfmake/build/vfs_fonts.js'

pdfMake.vfs = pdfFonts.pdfMake.vfs

pdfMake.createPdf({ content: [...] }).getBuffer((buffer) => {
  writeFileSync('output.pdf', buffer)
})
```

**pretext-pdf — one async call:**

```typescript
import { render } from 'pretext-pdf'

const pdf = await render({ content: [...] })
writeFileSync('output.pdf', pdf)
```

Inter 400 and 700 are bundled. No VFS setup. No callback hell — `render()` returns a plain `Promise<Uint8Array>`.

For custom fonts, pass a `fonts` array:

```typescript
const pdf = await render({
  fonts: [{ family: 'Roboto', weight: 400, src: './Roboto-Regular.ttf' }],
  defaultFont: 'Roboto',
  content: [...],
})
```

---

## 2. Typography Quality

This is the biggest technical difference between the two libraries.

### Line-Breaking: Greedy vs. Knuth-Plass

pdfmake uses a **greedy algorithm**: fill each line as much as possible, then move to the next. It's fast, but it optimises line-by-line with no knowledge of what comes later. In justified text, this produces uneven word spacing — some lines pack tight, others stretch wide. The visual symptom is "rivers": vertical paths of white space that flow through paragraphs and draw the eye away from the text.

pretext-pdf uses the **Knuth-Plass algorithm** — the same one in TeX, LaTeX, and Adobe InDesign. It evaluates the entire paragraph as a unit, assigning a "badness" penalty to each possible line-break point and finding the globally optimal set of breaks that minimises total badness across all lines. The result is paragraphs where no single line is noticeably tighter or looser than its neighbours.

The difference is subtle on short paragraphs. It becomes obvious on:
- **Justified text** in columns — Knuth-Plass eliminates rivers almost entirely
- **Narrow columns** — greedy algorithms are most exposed in tight widths
- **Long documents** — the cumulative quality difference becomes clearly visible

### Hyphenation

pdfmake does not hyphenate. Long words at line ends can create large white-space gaps before them, and narrow columns become very difficult to justify well.

pretext-pdf ships with Liang's algorithm (the same method TeX uses) and language-specific pattern files:

```typescript
{
  hyphenation: { language: 'en-us' },
  content: [
    { type: 'paragraph', align: 'justify', text: 'Internationalization and...' }
  ],
}
```

Pattern packages are available for English, German, French, Spanish, Dutch, and a dozen others via `npm install hyphenation.XX`.

### RTL and BiDi Text

pdfmake has partial right-to-left support but known rendering bugs in mixed-direction text (Arabic inside an English sentence).

pretext-pdf uses the full Unicode BiDi algorithm via `bidi-js`, with explicit `dir: 'rtl'` support at the document, section, paragraph, table, and cell level:

```typescript
{ type: 'paragraph', text: 'مرحبا بالعالم', dir: 'rtl' }

{ type: 'table', dir: 'rtl', columns: [...], rows: [...] }
```

---

## 3. API Design

Both libraries use declarative JSON. The structural difference is the `type` discriminant.

pdfmake **infers** element type from object shape — `{ text: '...' }` is a paragraph, `{ ul: [...] }` is a bulleted list. This is concise but ambiguous for TypeScript.

pretext-pdf uses an **explicit `type` field** — every element is a discriminated union member. Your editor knows exactly which fields are valid, and TypeScript catches typos at compile time.

### Paragraphs

```typescript
// pdfmake
{ text: 'Hello', bold: true, alignment: 'center', characterSpacing: 1 }

// pretext-pdf
{ type: 'paragraph', text: 'Hello', fontWeight: 700, align: 'center', letterSpacing: 1 }
```

### Rich / Mixed-Format Text

```typescript
// pdfmake — heterogeneous text array
{ text: ['Normal, ', { text: 'bold', bold: true }, { text: ' italic', italics: true }] }

// pretext-pdf — explicit spans array
{ type: 'rich-paragraph', spans: [
  { text: 'Normal, ' },
  { text: 'bold', fontWeight: 700 },
  { text: ' italic', fontStyle: 'italic' },
]}
```

Spans also support: `color`, `fontSize`, `underline`, `strikethrough`, `url` (inline hyperlink), `verticalAlign: 'superscript' | 'subscript'`, `letterSpacing`, `smallCaps`.

### Tables

```typescript
// pdfmake — widths[] and body[][] (flat arrays)
{
  table: {
    headerRows: 1,
    widths: ['*', 80, 100],
    body: [
      [{ text: 'Item', bold: true }, { text: 'Qty', bold: true }, { text: 'Total', bold: true }],
      ['Consulting', '10 hrs', '$1,000'],
    ]
  }
}

// pretext-pdf — explicit columns and rows.cells
{
  type: 'table',
  columns: [{ width: '1*' }, { width: 80 }, { width: 100 }],
  rows: [
    { isHeader: true, cells: [
      { text: 'Item', fontWeight: 700 },
      { text: 'Qty', fontWeight: 700 },
      { text: 'Total', fontWeight: 700 },
    ]},
    { cells: [{ text: 'Consulting' }, { text: '10 hrs' }, { text: '$1,000' }] },
  ],
  headerBgColor: '#1a1a2e',
  borderColor: '#e0e0e0',
  borderWidth: 0.5,
}
```

pretext-pdf's table API is more verbose but also more explicit: `isHeader: true` rows auto-repeat on page overflow, fractional widths use `'1*'` instead of `'*'`, and column alignment lives on the column definition rather than each cell.

---

## 4. Features Only in pretext-pdf

### Encryption and Permissions

```typescript
{
  encryption: {
    userPassword: 'view-only',
    ownerPassword: 'admin',
    permissions: { printing: true, copying: false, modifying: false },
  },
  content: [...],
}
```

pdfmake has no encryption API.

### Auto-Generated Table of Contents

```typescript
{
  bookmarks: { minLevel: 1, maxLevel: 3 },
  content: [
    { type: 'toc', title: 'Contents', leader: '.' },
    { type: 'heading', level: 1, text: 'Introduction', anchor: 'intro' },
    { type: 'heading', level: 2, text: 'Background', anchor: 'bg' },
  ],
}
```

Two-pass rendering builds the TOC from heading anchors with correct page numbers automatically.

### Interactive PDF Forms

```typescript
{ type: 'form-field', fieldType: 'text',     name: 'email',   label: 'Email Address' }
{ type: 'form-field', fieldType: 'checkbox', name: 'agree',   label: 'I agree to the terms' }
{ type: 'form-field', fieldType: 'dropdown', name: 'country', options: ['India', 'USA', 'UK'] }
```

pdfmake has no form API.

### Digital Signatures

```typescript
{
  signature: {
    p12: readFileSync('./certificate.p12'),
    passphrase: process.env.CERT_PASS,
    reason: 'Approved by legal',
  },
  content: [...],
}
```

### Document Assembly

```typescript
import { merge, assemble } from 'pretext-pdf'

// Merge existing PDFs
const combined = await merge([pdf1Bytes, pdf2Bytes])

// Assemble from document definitions + existing PDFs
const report = await assemble([
  { doc: coverPageDefinition },
  { pdf: existingContractBytes },
  { doc: appendixDefinition },
])
```

---

## 5. Features Only in pdfmake

### Browser Support

pdfmake generates PDFs in the browser without a server. pretext-pdf is Node.js only.

If you need client-side generation — a "Download PDF" button that works without hitting an API — pdfmake is currently the only option of the two. A Cloud API endpoint for pretext-pdf is on the roadmap but not yet available.

### QR Codes

pdfmake has built-in QR code generation. In pretext-pdf, generate the QR code as SVG first:

```typescript
import QRCode from 'qrcode'
const svgStr = await QRCode.toString('https://example.com', { type: 'svg' })
{ type: 'svg', src: Buffer.from(svgStr), width: 100 }
```

One extra step, but you also get full control over the SVG.

### Canvas Drawing API

pdfmake lets you draw lines, rectangles, circles, and bezier curves directly:

```javascript
{ canvas: [
  { type: 'rect', x: 0, y: 0, w: 515, h: 60, color: '#f0f0f0' },
  { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#cccccc' },
]}
```

pretext-pdf has no canvas API. Use an SVG element instead — it's more expressive, infinitely scalable, and you can generate it programmatically with any SVG library.

### Global Named Styles

pdfmake's `styles` property lets you define named styles and apply them by reference. pretext-pdf has no style dictionary — use TypeScript helper functions, which give you the same reuse with full type safety:

```typescript
const Header = (text: string) => ({ type: 'heading' as const, level: 1 as const, text, color: '#1a1a2e' })
const Label  = (text: string) => ({ type: 'paragraph' as const, text, fontSize: 9, color: '#888888' })

{ content: [Header('Invoice'), Label('Date')] }
```

Or use `defaultParagraphStyle` for document-wide defaults without a helper:

```typescript
{ defaultParagraphStyle: { fontSize: 11, lineHeight: 16 }, content: [...] }
```

---

## 6. Performance Benchmarks

> **Methodology:** pretext-pdf numbers are measured averages (10 runs, first run excluded) on Windows 11 / Node 22 / Intel i7-12th Gen. pdfmake comparison numbers are from community benchmarks; a direct head-to-head measurement script is in `benchmarks/vs-pdfmake.ts` (requires `npm install pdfmake`).

| Document | pretext-pdf | Note |
|---|---|---|
| 1 page (heading + paragraph + list) | ~180 ms | Excludes cold JIT startup |
| 5 pages (mixed elements) | ~400 ms | |
| 10 pages (40 sections) | ~600 ms | |
| 50-page equivalent (400 elements) | ~5,800 ms | Stress test |

**pdfmake** typically renders a 1-page document in 50–100 ms. Its greedy algorithm skips the paragraph-level optimization that Knuth-Plass performs, so it's naturally faster for simple documents. For complex documents (many tables, RTL text, footnotes, TOC), the gap narrows because features pdfmake lacks entirely aren't being benchmarked.

**File sizes** are comparable for simple documents. pretext-pdf's font subsetting embeds only the glyphs actually used in the document, keeping PDFs small (a typical invoice comes in under 65 KB with Inter 400/700).

---

## 7. When to Use Which

### Choose pdfmake when:

- You need **browser-side PDF generation** without a server round-trip
- **QR codes** are a hard requirement and you don't want an SVG conversion step
- You're **maintaining an existing pdfmake codebase** and the migration ROI isn't there yet
- Typography quality is secondary — internal reports, quick exports, tooling output

### Choose pretext-pdf when:

- **Typography quality matters** — client-facing invoices, contracts, formal reports, anything you're proud to send
- You're on **TypeScript** and want strict autocomplete (the discriminated union catches typos at compile time)
- You need **RTL or BiDi text** — Arabic, Hebrew, mixed-direction documents
- You need features pdfmake doesn't have: **encryption, interactive forms, digital signatures, TOC, bookmarks, document assembly, annotations, callout boxes, footnotes, SVG**
- You're building on **Node.js** and browser support isn't a requirement

---

## 8. Migration Quick-Start

Most pdfmake documents migrate in under an hour. The key mechanical changes:

```bash
npm uninstall pdfmake
npm install pretext-pdf
```

Then:

1. Replace `pdfMake.createPdf(def).getBuffer(cb)` → `const pdf = await render(def)`
2. Add `type` to every element: `{ text: '...' }` → `{ type: 'paragraph', text: '...' }`
3. Rename properties: `alignment` → `align`, `bold: true` → `fontWeight: 700`, `margin` → `spaceBefore`/`spaceAfter`, `characterSpacing` → `letterSpacing`, `link` → `url`
4. Convert tables: `widths[] + body[][]` → `columns[] + rows[].cells[]`
5. Replace `'*'` widths → `'1*'`
6. Hex colors only: `'red'` → `'#ff0000'`
7. Remove VFS setup and `pdfMake.vfs = ...`

See the full **[Migration Guide](../MIGRATION_FROM_PDFMAKE.md)** for a complete cheat sheet covering every pdfmake feature.

---

## Summary

pdfmake and pretext-pdf are solving the same problem with different priorities.

pdfmake prioritises **reach** — it runs anywhere JavaScript runs, including the browser, and has a decade of community adoption.

pretext-pdf prioritises **quality** — it produces professionally typeset output, gives TypeScript users a first-class experience, and ships features that pdfmake simply doesn't have (encryption, forms, signatures, TOC, RTL, document assembly).

If you're shipping PDFs to clients who judge your professionalism by the document quality, pretext-pdf is worth the switch. If you need browser-side generation today, pdfmake is still the answer.

---

*pretext-pdf is MIT licensed. [GitHub](https://github.com/Himaan1998Y/pretext-pdf) · [npm](https://www.npmjs.com/package/pretext-pdf) · [Migration Guide](../MIGRATION_FROM_PDFMAKE.md)*
