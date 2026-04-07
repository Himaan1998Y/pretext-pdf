/**
 * Example: Phase 7D — Table of Contents
 * Demonstrates automatic TOC generation with accurate page numbers.
 * Run: npm run example:toc
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
  content: [
    {
      type: 'toc',
      title: 'Table of Contents',
      minLevel: 1,
      maxLevel: 2,
      showTitle: true,
      spaceAfter: 20,
    },
    {
      type: 'heading',
      level: 1,
      text: 'Part I: Foundations',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'This is the first part with foundational content. The TOC at the beginning shows accurate page numbers for all headings.',
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 2,
      text: 'Chapter 1: Basics',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(5),
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 2,
      text: 'Chapter 2: Getting Started',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. '.repeat(6),
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 1,
      text: 'Part II: Advanced Topics',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'The second part covers more advanced material.',
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 2,
      text: 'Chapter 3: Deep Dive',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris. '.repeat(6),
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 2,
      text: 'Chapter 4: Best Practices',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'Duis aute irure dolor in reprehenderit in voluptate velit esse. '.repeat(6),
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 1,
      text: 'Part III: Reference',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'Reference materials and appendices.',
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 2,
      text: 'Chapter 5: API Reference',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'Excepteur sint occaecat cupidatat non proident, sunt in culpa. '.repeat(6),
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 2,
      text: 'Chapter 6: Examples',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'Qui officia deserunt mollit anim id est laborum. '.repeat(8),
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 2,
      text: 'Chapter 7: Troubleshooting',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'Common issues and their solutions are documented here. '.repeat(6),
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 2,
      text: 'Chapter 8: Appendix',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'Additional reference material. '.repeat(10),
    },
  ],
})

const outPath = path.join(__dirname, '..', 'output', 'phase7-toc.pdf')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, pdf)

console.log(`✓ Phase 7D TOC example: ${outPath}`)
console.log(`   Size: ${(pdf.byteLength / 1024).toFixed(1)} KB`)
console.log('   Page numbers in TOC are accurate despite multi-pass rendering')
