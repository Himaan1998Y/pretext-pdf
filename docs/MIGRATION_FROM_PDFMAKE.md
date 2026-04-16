# Migrating from pdfmake to pretext-pdf

If you're using pdfmake and hitting typography bugs (hyphenation, justified text rivers, RTL issues) or
TypeScript friction, this guide maps every common pdfmake pattern to its pretext-pdf equivalent.

> **TL;DR:** The API shape is similar — both are declarative JSON. The main differences are:
>
> - `type` field is required on every element (discriminated union -> full TypeScript autocomplete)
> - No global `styles` dictionary — apply properties inline or via a TypeScript helper
> - No `vfs_fonts` setup — Inter 400/700 is bundled, custom fonts via `fonts` array on the document
> - `alignment` -> `align`, `margin` -> `spaceBefore`/`spaceAfter`, `bold` -> `fontWeight: 700`

---

## Install

```bash
# Remove pdfmake
npm uninstall pdfmake

# Install pretext-pdf
npm install pretext-pdf
```

---

## Setup comparison

### pdfmake (boilerplate required)

```javascript
import pdfMake from 'pdfmake/build/pdfmake.js'
import pdfFonts from 'pdfmake/build/vfs_fonts.js'

pdfMake.vfs = pdfFonts.pdfMake.vfs

const docDefinition = { content: [...] }
pdfMake.createPdf(docDefinition).getBuffer((buf) => {
  writeFileSync('out.pdf', buf)
})
```

### pretext-pdf (zero boilerplate)

```typescript
import { render } from 'pretext-pdf'
import { writeFileSync } from 'fs'

const pdf = await render({ content: [...] })
writeFileSync('out.pdf', pdf)
```

---

## Quick migration checklist

- [ ] Replace boilerplate: `pdfMake.createPdf(def).getBuffer(cb)` -> `await render(def)`
- [ ] Add `type` field to every element (`'paragraph'`, `'heading'`, `'table'`, etc.)
- [ ] Rename `alignment` -> `align`
- [ ] Rename `margin: [L, T, R, B]` -> `spaceBefore` / `spaceAfter`
- [ ] Rename `bold: true` -> `fontWeight: 700`
- [ ] Rename `italics: true` -> `fontStyle: 'italic'`
- [ ] Rename `link` -> `url`
- [ ] Rename `characterSpacing` -> `letterSpacing`
- [ ] Convert table `widths[]` + `body[][]` -> `columns[]` + `rows[].cells[]`
- [ ] Convert `{ text: [...], bold: true }` -> `{ type: 'rich-paragraph', spans: [...] }`
- [ ] Convert header/footer callbacks -> token syntax (`{{pageNumber}}`)
- [ ] Remove VFS font setup; use `fonts` array or rely on bundled Inter
- [ ] Use hex colors only (`'#ff0000'` not `'red'`)
- [ ] Replace `'*'` width -> `'1*'`

---

## Element cheat sheet

### Text / Paragraphs

| pdfmake | pretext-pdf |
| --- | --- |
| `{ text: 'Hello' }` | `{ type: 'paragraph', text: 'Hello' }` |
| `{ text: 'Hello', fontSize: 14 }` | `{ type: 'paragraph', text: 'Hello', fontSize: 14 }` |
| `{ text: 'Hello', color: '#ff0000' }` | `{ type: 'paragraph', text: 'Hello', color: '#ff0000' }` |
| `{ text: 'Hello', alignment: 'center' }` | `{ type: 'paragraph', text: 'Hello', align: 'center' }` |
| `{ text: 'Hello', bold: true }` | `{ type: 'paragraph', text: 'Hello', fontWeight: 700 }` |
| `{ text: 'Hello', margin: [0, 0, 0, 12] }` | `{ type: 'paragraph', text: 'Hello', spaceAfter: 12 }` |
| `{ text: 'Hello', margin: [0, 8, 0, 0] }` | `{ type: 'paragraph', text: 'Hello', spaceBefore: 8 }` |
| `{ text: 'Visit', link: 'https://...' }` | `{ type: 'paragraph', text: 'Visit', url: 'https://...' }` |
| `{ text: 'Hello', characterSpacing: 2 }` | `{ type: 'paragraph', text: 'Hello', letterSpacing: 2 }` |
| `{ text: 'Hello\nWorld' }` | `{ type: 'paragraph', text: 'Hello\nWorld' }` |

### Headings

| pdfmake | pretext-pdf |
| --- | --- |
| `{ text: 'Title', style: 'header' }` + styles dict | `{ type: 'heading', level: 1, text: 'Title' }` |
| `{ text: 'Sub', style: 'subheader' }` | `{ type: 'heading', level: 2, text: 'Sub' }` |
| `{ text: 'Title', fontSize: 20, bold: true }` | `{ type: 'heading', level: 1, text: 'Title', fontSize: 20 }` |

Heading defaults: H1=2x, H2=1.5x, H3=1.25x, H4=1.1x the base font size, all bold (700).

### Rich / Mixed text

```typescript
// pdfmake — inline bold in the middle of a sentence
{ text: [
    'Normal text, ',
    { text: 'bold part', bold: true },
    { text: 'italic part', italics: true },
    ', normal again.'
  ]
}

// pretext-pdf — rich-paragraph with spans
{
  type: 'rich-paragraph',
  spans: [
    { text: 'Normal text, ' },
    { text: 'bold part', fontWeight: 700 },
    { text: 'italic part', fontStyle: 'italic' },
    { text: ', normal again.' }
  ]
}
```

Rich-paragraph spans also support: `color`, `fontSize`, `underline`, `strikethrough`, `url` (inline hyperlink), `verticalAlign: 'superscript' | 'subscript'`, `letterSpacing`, `smallCaps`.

### Tables

```typescript
// pdfmake
{
  table: {
    headerRows: 1,
    widths: ['*', 80, 100],
    body: [
      [{ text: 'Item', bold: true }, { text: 'Qty', bold: true }, { text: 'Price', bold: true }],
      ['Service A', '10', '$1,000'],
      ['Service B', '5',  '$500'],
    ]
  }
}

// pretext-pdf
{
  type: 'table',
  columns: [
    { width: '1*' },
    { width: 80,  align: 'right' },
    { width: 100, align: 'right' },
  ],
  rows: [
    { isHeader: true, cells: [
      { text: 'Item', fontWeight: 700, color: '#ffffff' },
      { text: 'Qty', fontWeight: 700, color: '#ffffff' },
      { text: 'Price', fontWeight: 700, color: '#ffffff' },
    ]},
    { cells: [{ text: 'Service A' }, { text: '10' }, { text: '$1,000' }] },
    { cells: [{ text: 'Service B' }, { text: '5'  }, { text: '$500'   }] },
  ],
  headerBgColor: '#1a1a2e',
  borderColor: '#e0e0e0',
  borderWidth: 0.5,
}
```

**Key differences:**

- Column definitions go in `columns[]` (no `name` field — just `width` and optional `align`)
- Row cells go in `rows[].cells[]`, not flat arrays
- `'*'` width -> `'1*'` (explicit fractional weight)
- Header rows marked with `isHeader: true` on the row (auto-repeated on continuation pages)
- RTL tables: set `dir: 'rtl'` on the table element (propagates to all cells)

### Column widths

| pdfmake | pretext-pdf |
| --- | --- |
| `widths: ['*', '*']` | `columns: [{ width: '1*' }, { width: '1*' }]` |
| `widths: [200, '*']` | `columns: [{ width: 200 }, { width: '1*' }]` |
| `widths: ['auto', '*']` | `columns: [{ width: 'auto' }, { width: '1*' }]` |
| `widths: [100, 200, '*']` | `columns: [{ width: 100 }, { width: 200 }, { width: '1*' }]` |

### Column span

```typescript
// pdfmake
{ text: 'Spanning cell', colSpan: 2 }

// pretext-pdf — on the cell object
{ cells: [{ text: 'Spanning cell', colspan: 2 }, {}] }
// Note: you still need a placeholder cell {} for the spanned column
```

### Lists

```typescript
// pdfmake
{ ul: ['Apple', 'Banana', 'Cherry'] }
{ ol: ['First', 'Second', 'Third'] }

// pretext-pdf
{ type: 'list', style: 'unordered', items: [{ text: 'Apple' }, { text: 'Banana' }, { text: 'Cherry' }] }
{ type: 'list', style: 'ordered',   items: [{ text: 'First' }, { text: 'Second' }, { text: 'Third' }] }
```

Additional list options: `marker` (custom bullet), `indent`, `markerWidth`, `itemSpaceAfter`, nested items via `items[].items[]`.

### Images

```typescript
// pdfmake — using virtual filesystem key
{ image: 'logo', width: 120 }

// pdfmake — inline base64
{ image: 'data:image/png;base64,iVBO...', width: 120 }

// pretext-pdf — file path or URL
{ type: 'image', src: './logo.png', width: 120 }

// pretext-pdf — bytes (Uint8Array or Buffer)
{ type: 'image', src: readFileSync('./logo.png'), width: 120 }

// pretext-pdf — URL
{ type: 'image', src: 'https://example.com/logo.png', width: 120 }
```

Supports PNG, JPG, WebP. Format auto-detected from magic bytes. Optional `format: 'png' | 'jpg'` for explicit control.

### Horizontal rule / separator

```typescript
// pdfmake — canvas API
{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }] }

// pretext-pdf
{ type: 'hr', color: '#cccccc', thickness: 1, spaceBelow: 8 }
```

### Vertical space

```typescript
// pdfmake
{ text: '', margin: [0, 12, 0, 0] }

// pretext-pdf
{ type: 'spacer', height: 12 }
```

### Page break

```typescript
// pdfmake
{ text: '', pageBreak: 'before' }

// pretext-pdf
{ type: 'page-break' }
```

### Code blocks

```typescript
// pdfmake — no native support, workaround with background + font
{ text: 'npm install pretext-pdf', font: 'Courier', background: '#f5f5f5' }

// pretext-pdf — native element (fontFamily required — must be a monospace font in doc.fonts)
{
  type: 'code',
  text: 'npm install pretext-pdf',
  fontFamily: 'JetBrains Mono',
  bgColor: '#f6f8fa',
  padding: 8,
}
```

### Blockquote

```typescript
// pdfmake — no native support

// pretext-pdf
{
  type: 'blockquote',
  text: 'To be or not to be.',
  borderColor: '#0070f3',
  bgColor: '#f8f9fa',
}
```

---

## Document-level config

### Page size and margins

```typescript
// pdfmake
{ pageSize: 'A4', pageMargins: [72, 60, 72, 60] }

// pretext-pdf
{ pageSize: 'A4', margins: { top: 60, bottom: 60, left: 72, right: 72 } }
```

Supported: A3, A4, A5, Letter, Legal, or custom `[width, height]` in pt.

### Header and footer

```typescript
// pdfmake — function callback
{
  header: (currentPage, pageCount) => ({
    text: `Page ${currentPage} of ${pageCount}`,
    alignment: 'right', fontSize: 9
  })
}

// pretext-pdf — config object with token interpolation
{
  header: {
    text: 'Page {{pageNumber}} of {{totalPages}}',
    align: 'right', fontSize: 9
  }
}
```

Per-section header/footer overrides:

```typescript
{
  sections: [
    { fromPage: 1, toPage: 1, header: { text: 'Cover' } },
    { fromPage: 2, header: { text: 'Chapter 1' } },
  ]
}
```

### Custom fonts

```typescript
// pdfmake — virtual filesystem
import pdfFonts from 'pdfmake/build/vfs_fonts.js'
pdfMake.vfs = pdfFonts.pdfMake.vfs
const docDefinition = {
  content: [...],
  defaultStyle: { font: 'Helvetica' }
}

// pretext-pdf — fonts array on document
{
  fonts: [
    { family: 'Roboto', weight: 400, style: 'normal', src: './Roboto-Regular.ttf' },
    { family: 'Roboto', weight: 700, style: 'normal', src: './Roboto-Bold.ttf' },
  ],
  defaultFont: 'Roboto',
  content: [...]
}
// Note: Inter 400/700 is bundled — no setup needed for Inter
```

### Watermarks

```typescript
// pdfmake
{ watermark: { text: 'DRAFT', color: 'red', opacity: 0.5 } }

// pretext-pdf (text or image)
{ watermark: { text: 'DRAFT', color: '#ff0000', opacity: 0.15, rotation: -45 } }
// or image watermark:
{ watermark: { image: './watermark.png', opacity: 0.1 } }
```

### Metadata

```typescript
// pdfmake
{ info: { title: 'My Doc', author: 'Author' } }

// pretext-pdf
{ metadata: { title: 'My Doc', author: 'Author', language: 'en-US', subject: 'Invoice' } }
```

### Styles (pdfmake style dictionary)

pdfmake lets you define named styles globally and reference them with `style: 'myStyle'`.
pretext-pdf has no global style dictionary — apply properties directly or use TypeScript helpers.

```typescript
// pdfmake
{
  styles: {
    header: { fontSize: 18, bold: true, color: '#1a1a2e' },
    subheader: { fontSize: 14, color: '#333333' },
    label: { fontSize: 9, color: '#888888' },
  },
  content: [
    { text: 'Invoice', style: 'header' },
    { text: 'Details', style: 'subheader' },
    { text: 'Date', style: 'label' },
  ]
}

// pretext-pdf — use TypeScript helpers for reuse
const H1 = (text: string) => ({ type: 'heading' as const, level: 1 as const, text, fontSize: 18, color: '#1a1a2e' })
const H2 = (text: string) => ({ type: 'heading' as const, level: 2 as const, text, fontSize: 14, color: '#333333' })
const Label = (text: string) => ({ type: 'paragraph' as const, text, fontSize: 9, color: '#888888' })

{
  content: [
    H1('Invoice'),
    H2('Details'),
    Label('Date'),
  ]
}
```

Or use `defaultParagraphStyle` for document-wide defaults:

```typescript
{
  defaultParagraphStyle: { fontSize: 11, lineHeight: 16, color: '#333333' },
  content: [...]
}
```

---

## Features only in pretext-pdf

These have no pdfmake equivalent:

| Feature | pretext-pdf API |
| --- | --- |
| **Hyphenation** | `hyphenation: { language: 'en-us' }` |
| **RTL text** | `dir: 'rtl'` on paragraphs, headings, tables, cells |
| **Encryption** | `encryption: { userPassword: '...', ownerPassword: '...' }` |
| **Bookmarks / outline** | `bookmarks: { minLevel: 1, maxLevel: 3 }` (auto-generated from headings) |
| **Auto-generated TOC** | `{ type: 'toc', title: 'Contents', leader: '.' }` |
| **Callout boxes** | `{ type: 'callout', style: 'info', content: '...' }` |
| **Blockquotes** | `{ type: 'blockquote', text: '...' }` |
| **Interactive forms** | `{ type: 'form-field', fieldType: 'text', name: 'email' }` |
| **Document assembly** | `merge([pdf1, pdf2])` or `assemble([{ doc }, { pdf }])` |
| **Sticky annotations** | `{ type: 'comment', contents: '...', author: '...' }` |
| **Digital signatures** | `signature: { p12: './cert.p12', passphrase: '...' }` |
| **Visual signature** | `signature: { signerName: '...', x: 100, y: 200 }` |
| **Footnotes** | `{ type: 'footnote-def', id: 'n1', text: '...' }` + inline `footnoteRef` spans |
| **Image floats** | `{ type: 'float-group', float: 'left', image: {...}, content: [...] }` |
| **SVG embedding** | `{ type: 'svg', svg: '<svg>...</svg>' }` or `{ type: 'svg', src: './chart.svg' }` |
| **Small caps** | `smallCaps: true` on paragraphs and headings |
| **Tabular numbers** | `tabularNumbers: true` on paragraphs, headings, table cells |
| **Multi-column text** | `columns: 2, columnGap: 24` on paragraphs and rich-paragraphs |
| **Custom metadata** | `metadata: { title, author, language: 'en-US', producer }` |
| **Section headers** | `sections: [{ fromPage: 2, header: {...} }]` |
| **Image error callback** | `onImageLoadError: (src, err) => 'skip' \| 'throw'` |

---

## Things pdfmake has that pretext-pdf doesn't (yet)

| pdfmake capability | Status in pretext-pdf |
| --- | --- |
| **Browser-side generation** | Node.js only (Cloud API planned) |
| **QR code generation** | Not built-in; generate as SVG/PNG and embed as image |
| **Canvas drawing API** (lines, rects, circles) | Not built-in; use SVG element instead |
| **Global styles dictionary** | Not available; use TypeScript helpers or `defaultParagraphStyle` |
| **Deep nesting** (tables inside tables) | Table cells are text-only; use separate tables |
| **Nested lists > 1 level** | One level of nesting supported |

---

## Common gotchas

1. **No `'*'` width** — use `'1*'` instead (explicit fractional syntax)
2. **Hex colors only** — `'#ff0000'`, not `'red'` or `'rgb(255,0,0)'`
3. **Code blocks require `fontFamily`** — must be a monospace font registered in `doc.fonts`
4. **No `pageOrientation`** — for landscape, use custom `pageSize: [842, 595]`
5. **Lists nest 1 level max** — `items[].items[]` works, but no deeper
6. **Table cells are text-only** — no nested elements inside cells (use separate tables for complex layouts)
7. **`fontWeight` is `400 | 700`** — not `bold: true` / `normal`
8. **`fontStyle` is `'normal' | 'italic'`** — not `italics: true`
9. **Colspan placeholder cells required** — `{ cells: [{ text: 'Span', colspan: 2 }, {}] }` — empty `{}` for each spanned column
10. **No callback-based headers/footers** — use `{{pageNumber}}` / `{{totalPages}}` tokens

---

## Complete example — invoice migration

### Before (pdfmake)

```javascript
import pdfMake from 'pdfmake/build/pdfmake.js'
import pdfFonts from 'pdfmake/build/vfs_fonts.js'
pdfMake.vfs = pdfFonts.pdfMake.vfs

pdfMake.createPdf({
  pageSize: 'A4',
  pageMargins: [72, 60, 72, 60],
  content: [
    { text: 'INVOICE', style: 'title' },
    { text: '#INV-001 · April 2026', style: 'subtitle' },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 451, y2: 0, lineWidth: 2 }] },
    { text: '', margin: [0, 8, 0, 0] },
    {
      table: {
        headerRows: 1,
        widths: ['*', 60, 80],
        body: [
          [{ text: 'Description', bold: true }, { text: 'Qty', bold: true }, { text: 'Amount', bold: true }],
          ['Consulting Services', '10 hrs', '$1,000'],
          ['Hosting (annual)', '1', '$500'],
        ]
      }
    },
    { text: 'Total: $1,500', alignment: 'right', bold: true, margin: [0, 8, 0, 0] },
  ],
  styles: {
    title: { fontSize: 22, bold: true, color: '#1a1a2e' },
    subtitle: { fontSize: 10, color: '#666666', margin: [0, 0, 0, 8] },
  }
}).getBuffer((buf) => writeFileSync('invoice.pdf', buf))
```

### After (pretext-pdf)

```typescript
import { render } from 'pretext-pdf'
import { writeFileSync } from 'fs'

const pdf = await render({
  pageSize: 'A4',
  margins: { top: 60, bottom: 60, left: 72, right: 72 },
  hyphenation: { language: 'en-us' },
  content: [
    { type: 'heading', level: 1, text: 'INVOICE', fontSize: 22, color: '#1a1a2e' },
    { type: 'paragraph', text: '#INV-001 · April 2026', fontSize: 10, color: '#666666', spaceAfter: 8 },
    { type: 'hr', thickness: 2, spaceBelow: 8 },
    {
      type: 'table',
      columns: [
        { width: '1*' },
        { width: 60, align: 'right' },
        { width: 80, align: 'right' },
      ],
      rows: [
        { isHeader: true, cells: [
          { text: 'Description', fontWeight: 700, color: '#ffffff' },
          { text: 'Qty', fontWeight: 700, color: '#ffffff' },
          { text: 'Amount', fontWeight: 700, color: '#ffffff' },
        ]},
        { cells: [{ text: 'Consulting Services' }, { text: '10 hrs' }, { text: '$1,000' }] },
        { cells: [{ text: 'Hosting (annual)' },    { text: '1' },      { text: '$500' }] },
      ],
      headerBgColor: '#1a1a2e',
      borderColor: '#e0e0e0',
      borderWidth: 0.5,
    },
    { type: 'paragraph', text: 'Total: $1,500', align: 'right', fontWeight: 700, spaceBefore: 8 },
  ],
})

writeFileSync('invoice.pdf', pdf)
```

---

## Need help?

- [Open an issue](https://github.com/Himaan1998Y/pretext-pdf/issues) for migration questions
- [Full API reference](../README.md)
- [Live demo](https://stackblitz.com/github/Himaan1998Y/pretext-pdf/tree/master/demo/stackblitz)
- [GST invoice example](../examples/gst-invoice-india.ts)
