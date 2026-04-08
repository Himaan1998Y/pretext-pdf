# Migrating from pdfmake to pretext-pdf

If you're using pdfmake and hitting typography bugs (hyphenation, justified text rivers, RTL issues) or
TypeScript friction, this guide maps every common pdfmake pattern to its pretext-pdf equivalent.

> **TL;DR:** The API shape is similar — both are declarative JSON. The main differences are:
> - `type` field is required on every element (discriminated union → TypeScript autocomplete)
> - No global `styles` dictionary — apply properties inline or via a TypeScript helper
> - No `vfs_fonts` setup — Inter 400/700 is bundled, custom fonts via `fonts` array on the document

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

## Element cheat sheet

### Text / Paragraphs

| pdfmake | pretext-pdf |
|---|---|
| `{ text: 'Hello' }` | `{ type: 'paragraph', text: 'Hello' }` |
| `{ text: 'Hello', fontSize: 14 }` | `{ type: 'paragraph', text: 'Hello', fontSize: 14 }` |
| `{ text: 'Hello', color: '#ff0000' }` | `{ type: 'paragraph', text: 'Hello', color: '#ff0000' }` |
| `{ text: 'Hello', alignment: 'center' }` | `{ type: 'paragraph', text: 'Hello', align: 'center' }` |
| `{ text: 'Hello', bold: true }` | `{ type: 'rich-paragraph', spans: [{ text: 'Hello', bold: true }] }` |
| `{ text: 'Hello', italics: true }` | `{ type: 'rich-paragraph', spans: [{ text: 'Hello', italic: true }] }` |
| `{ text: 'Hello', margin: [0, 0, 0, 12] }` | `{ type: 'paragraph', text: 'Hello', spaceAfter: 12 }` |
| `{ text: 'Hello', margin: [0, 8, 0, 0] }` | `{ type: 'paragraph', text: 'Hello', spaceBefore: 8 }` |
| `{ text: 'Visit', link: 'https://...' }` | `{ type: 'paragraph', text: 'Visit', url: 'https://...' }` |
| `{ text: 'Hello\nWorld' }` | `{ type: 'paragraph', text: 'Hello\nWorld' }` |

### Headings

| pdfmake | pretext-pdf |
|---|---|
| `{ text: 'Title', style: 'header' }` + `styles: { header: { fontSize: 20, bold: true } }` | `{ type: 'heading', level: 1, text: 'Title' }` |
| `{ text: 'Sub', style: 'subheader' }` | `{ type: 'heading', level: 2, text: 'Sub' }` |
| `{ text: 'Title', fontSize: 20, bold: true }` | `{ type: 'heading', level: 1, text: 'Title', fontSize: 20 }` |

### Rich / Mixed text

```typescript
// pdfmake — inline bold in the middle of a sentence
{ text: [
    'Normal text, ',
    { text: 'bold part', bold: true },
    ', normal again.'
  ]
}

// pretext-pdf — rich-paragraph with spans
{
  type: 'rich-paragraph',
  spans: [
    { text: 'Normal text, ' },
    { text: 'bold part', bold: true },
    { text: ', normal again.' }
  ]
}
```

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
  headerRows: 1,
  columns: [
    { name: 'Item',  width: '1*' },
    { name: 'Qty',   width: 80,  align: 'right' },
    { name: 'Price', width: 100, align: 'right' },
  ],
  rows: [
    { cells: [{ text: 'Service A' }, { text: '10' }, { text: '$1,000' }] },
    { cells: [{ text: 'Service B' }, { text: '5'  }, { text: '$500'   }] },
  ]
}
```

**Key differences:**
- Column definitions go in `columns[]`, not `widths[]`
- Row cells go in `rows[].cells[]`, not flat arrays
- `'*'` width → `'1*'` (explicit fractional weight)
- `headerRows` stays in the same place

### Column widths

| pdfmake | pretext-pdf |
|---|---|
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
```

### Horizontal rule / separator

```typescript
// pdfmake — canvas API
{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }] }

// pretext-pdf
{ type: 'hr', color: '#cccccc', thickness: 1 }
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

// pretext-pdf — native element
{ type: 'code', text: 'npm install pretext-pdf' }
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

### Styles (pdfmake style dictionary)

pdfmake lets you define named styles globally and reference them with `style: 'myStyle'`.
pretext-pdf has no global style dictionary — apply properties directly on each element.

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

// pretext-pdf — use a TypeScript helper for reuse
const H1 = (text: string) => ({ type: 'heading' as const, level: 1, text, fontSize: 18, color: '#1a1a2e' })
const H2 = (text: string) => ({ type: 'heading' as const, level: 2, text, fontSize: 14, color: '#333333' })
const Label = (text: string) => ({ type: 'paragraph' as const, text, fontSize: 9, color: '#888888' })

{
  content: [
    H1('Invoice'),
    H2('Details'),
    Label('Date'),
  ]
}
```

---

## Features only in pretext-pdf

These have no pdfmake equivalent:

| Feature | pretext-pdf API |
|---|---|
| **Hyphenation** | `doc.hyphenation: { language: 'en-us' }` |
| **RTL text** | `{ type: 'paragraph', text: 'مرحبا', direction: 'rtl' }` |
| **Encryption** | `doc.encryption: { userPassword: '...', ownerPassword: '...' }` |
| **Watermarks** | `doc.watermark: { text: 'CONFIDENTIAL', opacity: 0.15 }` |
| **Auto-generated TOC** | `{ type: 'toc' }` element in content |
| **Callout boxes** | `{ type: 'callout', style: 'info', content: '...' }` |
| **Interactive forms** | `{ type: 'form-field', fieldType: 'text', name: 'email' }` |
| **Document assembly** | `merge([pdf1, pdf2])` or `assemble([{ doc }, { pdf }])` |
| **Sticky annotations** | `{ type: 'comment', text: '...', author: '...' }` |
| **Visual signature** | `doc.signature: { signerName: '...', x: 100, y: 200 }` |
| **Custom metadata** | `doc.metadata: { title, author, language: 'en', producer }` |
| **SVG embedding** | `{ type: 'svg', markup: '<svg>...</svg>' }` |

---

## Things pdfmake has that pretext-pdf doesn't (yet)

| pdfmake capability | Status in pretext-pdf |
|---|---|
| **Browser-side generation** | ❌ Node.js only (v0.4.0) |
| **Multiple hyphenation languages bundled** | Only `en-us` bundled; others installable via npm |
| **QR code generation** | Not built-in; embed as SVG or image |
| **Charts / graphs** | Not built-in; embed chart as SVG or image |
| **Encrypted ZIP output** | Not available |

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
  hyphenation: { language: 'en-us' },  // bonus: now you have proper hyphenation
  content: [
    { type: 'heading', level: 1, text: 'INVOICE', fontSize: 22, color: '#1a1a2e' },
    { type: 'paragraph', text: '#INV-001 · April 2026', fontSize: 10, color: '#666666', spaceAfter: 8 },
    { type: 'hr', thickness: 2, spaceBelow: 8 },
    {
      type: 'table',
      headerRows: 1,
      columns: [
        { name: 'Description', width: '1*' },
        { name: 'Qty',    width: 60, align: 'right' },
        { name: 'Amount', width: 80, align: 'right' },
      ],
      rows: [
        { cells: [{ text: 'Consulting Services' }, { text: '10 hrs' }, { text: '$1,000' }] },
        { cells: [{ text: 'Hosting (annual)' },    { text: '1' },      { text: '$500' }] },
      ]
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
- [GST invoice example](../examples/gst-invoice-india.ts)
