# pretext-pdf Templates

Production-ready templates for common document types. Copy, customize, and render to PDF.

## Gallery

| Template | Description | Run | Features |
|----------|-------------|-----|----------|
| **GST Invoice (India)** | Compliance-ready invoice with GSTIN, HSN, IGST | `npx tsx templates/invoice-gst.ts` | Tax breakdown, amount in words, bank details |
| **International Invoice** | Multi-currency invoice (USD/EUR) | `npx tsx templates/invoice-intl.ts` | Simple line items, discounts, payment terms |
| **Resume / CV** | One-page professional resume | `npx tsx templates/resume.ts` | Sections, bullet points, skills table, modern layout |
| **Business Report** | Multi-section report with TOC | `npx tsx templates/report.ts` | Cover, chapters, tables, callouts, headers/footers |
| **NDA / Legal** | Non-disclosure agreement template | `npx tsx templates/nda.ts` | Numbered clauses, signature blocks, watermark, encryption |
| **Meeting Minutes** | Meeting notes with action items | `npx tsx templates/meeting-minutes.ts` | Attendees, agenda, decisions, action table |

## How to Use

Each template is a standalone TypeScript file that generates a PDF:

```bash
# Run any template
npx tsx templates/invoice-gst.ts

# Output appears at templates/output/<name>.pdf
```

Edit the template file to customize data, styling, or structure. All templates use `pretext-pdf` API only — no external dependencies.

## Customization Tips

- **Data:** Replace mock data objects with your own
- **Styling:** Adjust colors, fonts, margins in the `render()` call
- **Structure:** Add/remove sections as needed
- **Output path:** Change the `writeFileSync` path at the end

## Requirements

- Node.js ≥18
- `pretext-pdf` (installed in parent directory)
- `highlight.js` (optional, for code blocks)
