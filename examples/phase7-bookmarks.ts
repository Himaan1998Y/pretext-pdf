/**
 * Example: Phase 7A — Bookmarks / PDF Outline
 * Demonstrates automatic bookmark generation from heading hierarchy.
 * Open the PDF in Adobe Reader or any viewer to see the bookmarks panel.
 * Run: npm run example:bookmarks
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const { render } = await import('../dist/index.js')

const pdf = await render({
  pageSize: 'A4',
  margins: { top: 40, bottom: 40, left: 40, right: 40 },
  defaultFont: 'Inter',
  defaultFontSize: 12,
  bookmarks: { minLevel: 1, maxLevel: 3 },
  content: [
    {
      type: 'heading',
      level: 1,
      text: 'Bookmarks Example',
      spaceAfter: 12,
    },
    {
      type: 'paragraph',
      text: 'This document demonstrates Phase 7A bookmarks. Open in Adobe Reader, Preview, or any PDF viewer to see the bookmarks sidebar on the left.',
      spaceAfter: 16,
    },
    {
      type: 'heading',
      level: 2,
      text: 'Chapter 1: Introduction',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'This is the introduction section.',
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 3,
      text: 'Section 1.1: Background',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'Background information goes here. Bookmarks are automatically generated from headings (H1, H2, H3, etc.).',
      spaceAfter: 16,
    },
    {
      type: 'heading',
      level: 3,
      text: 'Section 1.2: Scope',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'The scope of this document is defined here.',
      spaceAfter: 16,
    },
    {
      type: 'heading',
      level: 2,
      text: 'Chapter 2: Main Content',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'This is the main chapter with detailed content.',
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 3,
      text: 'Section 2.1: Details',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'Detailed information about section 2.1.',
      spaceAfter: 8,
    },
    {
      type: 'heading',
      level: 3,
      text: 'Section 2.2: Advanced Topics',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'Advanced topics are discussed here.',
      spaceAfter: 16,
    },
    {
      type: 'heading',
      level: 2,
      text: 'Chapter 3: Conclusion',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'The document concludes with a summary.',
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 3,
      text: 'Section 3.1: Summary',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'Summary of all key points.',
      spaceAfter: 8,
    },
    {
      type: 'heading',
      level: 3,
      text: 'Section 3.2: Next Steps',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'Recommended next steps for the reader.',
      spaceAfter: 12,
    },
    {
      type: 'paragraph',
      text: 'Bookmarks configuration: minLevel: 1 (include H1) and maxLevel: 3 (include up to H3). Headings with bookmark: false are excluded from the outline.',
    },
  ],
})

const outPath = path.join(__dirname, '..', 'output', 'phase7-bookmarks.pdf')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, pdf)

console.log(`✓ Phase 7A Bookmarks example: ${outPath}`)
console.log(`   Size: ${(pdf.byteLength / 1024).toFixed(1)} KB`)
console.log('   Open in PDF reader to see bookmarks sidebar')
