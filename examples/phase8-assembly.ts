/**
 * Phase 8C — Document Assembly Example
 * Demonstrates merging multiple PDFs and assembling from mixed parts
 */
import { render, merge, assemble } from '../dist/index.js'
import { writeFileSync, mkdirSync } from 'fs'

mkdirSync('output', { recursive: true })

// Part 1: Cover page
const coverPage = await render({
  pageSize: 'A4',
  margins: { top: 100, bottom: 100, left: 80, right: 80 },
  content: [
    { type: 'spacer', height: 80 },
    {
      type: 'heading',
      level: 1,
      text: 'Annual Report 2025',
      fontSize: 32,
      align: 'center',
    },
    {
      type: 'paragraph',
      text: 'Antigravity Technologies',
      fontSize: 18,
      align: 'center',
      color: '#666666',
    },
    {
      type: 'paragraph',
      text: 'Confidential — Internal Use Only',
      fontSize: 10,
      align: 'center',
      color: '#999999',
    },
  ],
})

// Part 2: Financial section
const financialSection = await render({
  pageSize: 'A4',
  margins: { top: 60, bottom: 60, left: 60, right: 60 },
  header: { text: 'Annual Report 2025 — Financial Section', align: 'right', fontSize: 9, color: '#999999' },
  footer: { text: 'Page {{pageNumber}} of {{totalPages}}', align: 'center', fontSize: 9 },
  content: [
    { type: 'heading', level: 1, text: 'Financial Summary' },
    { type: 'paragraph', text: 'Total revenue for fiscal year 2025 reached $8M, driven by strong Q3 and Q4 performance.' },
    {
      type: 'table',
      columns: [
        { width: 100 },
        { width: 120 },
        { width: 120 },
        { width: 100 },
      ],
      rows: [
        { isHeader: true, cells: [{ text: 'Quarter', fontWeight: 700 }, { text: 'Revenue', fontWeight: 700 }, { text: 'Expenses', fontWeight: 700 }, { text: 'Net', fontWeight: 700 }] },
        { cells: [{ text: 'Q1' }, { text: '$1.6M' }, { text: '$1.1M' }, { text: '$0.5M' }] },
        { cells: [{ text: 'Q2' }, { text: '$1.9M' }, { text: '$1.3M' }, { text: '$0.6M' }] },
        { cells: [{ text: 'Q3' }, { text: '$2.1M' }, { text: '$1.4M' }, { text: '$0.7M' }] },
        { cells: [{ text: 'Q4' }, { text: '$2.4M' }, { text: '$1.5M' }, { text: '$0.9M' }] },
      ],
    },
  ],
})

// Part 3: Operations section
const opsSection = await render({
  pageSize: 'A4',
  margins: { top: 60, bottom: 60, left: 60, right: 60 },
  header: { text: 'Annual Report 2025 — Operations', align: 'right', fontSize: 9, color: '#999999' },
  footer: { text: 'Page {{pageNumber}} of {{totalPages}}', align: 'center', fontSize: 9 },
  content: [
    { type: 'heading', level: 1, text: 'Operations Overview' },
    { type: 'paragraph', text: 'Headcount grew from 12 to 31 employees. Three new offices opened in Bangalore, Dubai, and Singapore.' },
    { type: 'heading', level: 2, text: 'Key Milestones' },
    {
      type: 'list',
      style: 'unordered',
      items: [
        { text: 'Launched v2 product platform in March' },
        { text: 'Achieved SOC 2 Type II compliance in June' },
        { text: 'Signed enterprise contract with Tata Group in September' },
        { text: 'Closed Series A ($12M) in December' },
      ],
    },
  ],
})

// Approach 1: merge() — simplest way to combine pre-rendered PDFs
const mergedReport = await merge([coverPage, financialSection, opsSection])
writeFileSync('output/phase8-assembly-merged.pdf', mergedReport)
console.log('Written: output/phase8-assembly-merged.pdf (merge approach)')

// Approach 2: assemble() — mix doc configs and pre-rendered PDFs
const assembled = await assemble([
  { pdf: coverPage },  // pre-rendered cover
  {
    doc: {             // render a new appendix on the fly
      pageSize: 'A4',
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
      content: [
        { type: 'heading', level: 1, text: 'Appendix A: Glossary' },
        { type: 'paragraph', text: 'ARR — Annual Recurring Revenue. Total revenue normalized to a 12-month period.' },
        { type: 'paragraph', text: 'NPS — Net Promoter Score. Customer satisfaction metric from -100 to +100.' },
        { type: 'paragraph', text: 'SOC 2 — Service Organization Control 2. Security compliance framework.' },
      ],
    },
  },
])
writeFileSync('output/phase8-assembly-assembled.pdf', assembled)
console.log('Written: output/phase8-assembly-assembled.pdf (assemble approach)')
