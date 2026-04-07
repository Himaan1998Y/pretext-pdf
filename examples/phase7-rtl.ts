/**
 * Example: Phase 7F — Right-to-Left (RTL) Text Support
 * Demonstrates Hebrew, Arabic, and mixed LTR/RTL content.
 * Run: npm run example:rtl
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
      type: 'heading',
      level: 1,
      text: 'RTL Text Support Example',
      spaceAfter: 12,
    },
    {
      type: 'paragraph',
      text: 'This document demonstrates Phase 7F right-to-left (RTL) text support for Hebrew, Arabic, and other RTL languages.',
      spaceAfter: 16,
    },
    {
      type: 'heading',
      level: 2,
      text: 'English (LTR)',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'This is left-to-right English text. The text flows from left to right as normal.',
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 2,
      text: 'Hebrew (RTL Auto-Detection)',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'שלום עולם! זה דוגמה של טקסט עברי. הטקסט זורם מימין לשמאל באופן אוטומטי.',
      dir: 'auto',
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 2,
      text: 'Arabic (RTL Manual Override)',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'مرحبا بالعالم! هذا مثال على النص العربي. النص يتدفق من اليمين إلى اليسار.',
      dir: 'rtl',
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 2,
      text: 'Mixed Content (LTR with RTL)',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'This sentence contains Hebrew: שלום עולם and continues in English. The library handles both directions intelligently.',
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 2,
      text: 'RTL Configuration Options',
      spaceAfter: 8,
    },
    {
      type: 'list',
      style: 'unordered',
      items: [
        { text: 'dir: "ltr" — Force left-to-right text flow' },
        { text: 'dir: "rtl" — Force right-to-left text flow' },
        { text: 'dir: "auto" — Auto-detect based on content (Unicode bidirectional algorithm)' },
      ],
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 2,
      text: 'עברית - RTL Heading Example',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'כל הכותרות, הפסקאות והרשימות תומכות בטקסט דו-כיווני.',
      spaceAfter: 12,
    },
    {
      type: 'paragraph',
      text: 'RTL text support works seamlessly with other Phase 7 features like hyphenation, watermarks, bookmarks, and encryption.',
    },
  ],
})

const outPath = path.join(__dirname, '..', 'output', 'phase7-rtl.pdf')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, pdf)

console.log(`✓ Phase 7F RTL example: ${outPath}`)
console.log(`   Size: ${(pdf.byteLength / 1024).toFixed(1)} KB`)
console.log('   Includes Hebrew and Arabic text with automatic RTL handling')
