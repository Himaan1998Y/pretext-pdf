/**
 * Phase 8A — Annotations/Comments Example
 * Demonstrates sticky note annotations on elements and standalone comment elements
 */
import { render } from '../dist/index.js'
import { writeFileSync, mkdirSync } from 'fs'

mkdirSync('output', { recursive: true })

const pdf = await render({
  pageSize: 'A4',
  margins: { top: 60, bottom: 60, left: 60, right: 60 },
  metadata: { title: 'pretext-pdf Annotations Demo' },
  content: [
    {
      type: 'heading',
      level: 1,
      text: 'Document Review',
      annotation: {
        contents: 'This document demonstrates PDF sticky note annotations.',
        author: 'Himanshu',
        color: '#FFFF00',
      },
    },
    {
      type: 'paragraph',
      text: 'Annotations are sticky notes attached to elements. Open this PDF in Acrobat or Preview to see the notes in the sidebar.',
    },
    {
      type: 'heading',
      level: 2,
      text: 'Section 1: Financial Summary',
      annotation: {
        contents: 'Please verify these numbers with the accountant before publishing.',
        author: 'Reviewer',
        color: '#FF9900',
        open: true,
      },
    },
    {
      type: 'paragraph',
      text: 'Revenue for Q4 2025 was $2.4M, up 32% year-over-year.',
      annotation: {
        contents: 'Source: Finance team spreadsheet (link in Notion)',
        author: 'Himanshu',
        color: '#00FF00',
      },
    },
    {
      type: 'table',
      columns: [
        { width: 100 },
        { width: 120 },
        { width: 80 },
      ],
      rows: [
        { isHeader: true, cells: [{ text: 'Quarter', fontWeight: 700 }, { text: 'Revenue', fontWeight: 700 }, { text: 'Growth', fontWeight: 700 }] },
        { cells: [{ text: 'Q1 2025' }, { text: '$1.6M' }, { text: '+18%' }] },
        { cells: [{ text: 'Q2 2025' }, { text: '$1.9M' }, { text: '+19%' }] },
        { cells: [{ text: 'Q3 2025' }, { text: '$2.1M' }, { text: '+11%' }] },
        { cells: [{ text: 'Q4 2025' }, { text: '$2.4M' }, { text: '+14%' }] },
      ],
    },
    {
      type: 'comment',
      contents: 'TODO: Add chart visualization here in the final version.',
      author: 'Design Team',
      color: '#FF6B6B',
      open: false,
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 2,
      text: 'Section 2: Key Findings',
    },
    {
      type: 'paragraph',
      text: 'Customer acquisition costs decreased by 15% due to improved targeting algorithms.',
      annotation: {
        contents: 'Great result! Highlight this in the executive summary.',
        author: 'CEO',
        color: '#90EE90',
      },
    },
    {
      type: 'paragraph',
      text: 'Net Promoter Score increased from 42 to 61, putting us in the excellent range.',
    },
    {
      type: 'comment',
      contents: 'This section needs expansion. Add customer testimonials.',
      author: 'Marketing',
      color: '#ADD8E6',
    },
  ],
})

writeFileSync('output/phase8-annotations.pdf', pdf)
console.log('Written: output/phase8-annotations.pdf')
