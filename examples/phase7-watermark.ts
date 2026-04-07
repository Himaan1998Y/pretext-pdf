/**
 * Example: Phase 7B — Watermarks
 * Demonstrates text and image watermarks with customization options.
 * Run: npm run example:watermark
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
  watermark: {
    text: 'DRAFT',
    opacity: 0.2,
    rotation: 45,
    color: '#CCCCCC',
    fontSize: 60,
    fontWeight: 400,
  },
  content: [
    {
      type: 'heading',
      level: 1,
      text: 'Watermark Example',
      spaceAfter: 16,
    },
    {
      type: 'paragraph',
      text: 'This document demonstrates Phase 7B watermarks. The watermark is rendered behind the content on every page.',
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 2,
      text: 'Watermark Options',
      spaceAfter: 8,
    },
    {
      type: 'list',
      style: 'unordered',
      items: [
        { text: 'text: "DRAFT" — The watermark text' },
        { text: 'opacity: 0.2 — Transparency (0 = invisible, 1 = opaque)' },
        { text: 'rotation: 45 — Angle in degrees (-360 to 360)' },
        { text: 'color: "#CCCCCC" — Hex color code' },
        { text: 'fontSize: 60 — Size in points' },
        { text: 'fontWeight: 400 — 400 (normal) or 700 (bold)' },
      ],
      spaceAfter: 16,
    },
    {
      type: 'paragraph',
      text: 'All watermark options are optional. If both text and image are omitted, validation will fail. The rotation parameter is constrained to -360 to 360 degrees.',
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 2,
      text: 'Image Watermark (Optional)',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'You can also use an image watermark instead of text. Provide a PNG or JPG image as Uint8Array bytes. Image watermarks support opacity and rotation just like text watermarks.',
      spaceAfter: 12,
    },
    {
      type: 'paragraph',
      text: 'The watermark appears behind all content on every page, making it ideal for marking documents as DRAFT, CONFIDENTIAL, or COPY.',
    },
  ],
})

const outPath = path.join(__dirname, '..', 'output', 'phase7-watermark.pdf')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, pdf)

console.log(`✓ Phase 7B Watermark example: ${outPath}`)
console.log(`   Size: ${(pdf.byteLength / 1024).toFixed(1)} KB`)
