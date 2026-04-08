/**
 * Phase 8D — Callout Boxes Example
 *
 * Demonstrates all four preset callout styles plus a fully custom callout.
 * Callouts are like styled blockquotes with optional titles and colored borders.
 *
 * Run: npm run example:callout
 * Output: output/phase8-callout.pdf
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { render } from '../dist/index.js'
import type { PdfDocument } from '../dist/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const doc: PdfDocument = {
  metadata: {
    title: 'Callout Boxes Demo',
    author: 'pretext-pdf',
  },
  content: [
    { type: 'heading', level: 1, text: 'Callout Box Styles' },
    { type: 'paragraph', text: 'pretext-pdf supports four preset callout styles plus fully custom styling.' },
    { type: 'spacer', height: 12 },

    // Info
    {
      type: 'callout',
      style: 'info',
      title: 'Info',
      content: 'Use info callouts to highlight helpful context or background knowledge. Great for supplementary details that enhance but don\'t block comprehension.',
    },
    { type: 'spacer', height: 8 },

    // Warning
    {
      type: 'callout',
      style: 'warning',
      title: 'Warning',
      content: 'Use warning callouts to alert readers to potential pitfalls, common mistakes, or actions that could have unintended consequences.',
    },
    { type: 'spacer', height: 8 },

    // Tip
    {
      type: 'callout',
      style: 'tip',
      title: 'Tip',
      content: 'Use tip callouts to share best practices, shortcuts, or pro-level advice. These are positive and encouraging in tone.',
    },
    { type: 'spacer', height: 8 },

    // Note
    {
      type: 'callout',
      style: 'note',
      title: 'Note',
      content: 'Use note callouts for minor asides, caveats, or version-specific information. Less urgent than warnings, more formal than tips.',
    },
    { type: 'spacer', height: 16 },

    { type: 'heading', level: 2, text: 'Custom Styling' },
    { type: 'paragraph', text: 'Override any color to match your brand or document theme:' },
    { type: 'spacer', height: 8 },

    // Custom
    {
      type: 'callout',
      title: 'Security Notice',
      content: 'This document contains confidential information. Do not share outside your organization without written approval from the legal team.',
      backgroundColor: '#FFF1F2',
      borderColor: '#E11D48',
      color: '#1F2937',
      titleColor: '#E11D48',
      paddingH: 20,
      paddingV: 14,
    },
    { type: 'spacer', height: 8 },

    // Without title
    {
      type: 'callout',
      style: 'info',
      content: 'Callouts also work without a title — just plain highlighted text in the document body.',
    },
  ],
}

const outputDir = path.join(__dirname, '..', 'output')
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir)

const pdf = await render(doc)
const outputPath = path.join(outputDir, 'phase8-callout.pdf')
fs.writeFileSync(outputPath, pdf)
console.log(`Written: ${outputPath} (${(pdf.length / 1024).toFixed(1)} KB)`)
