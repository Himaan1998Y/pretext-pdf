/**
 * Template: Business Report with TOC
 *
 * Multi-section report with cover page, auto-generated table of contents,
 * executive summary, chapters with tables/callouts, headers/footers.
 *
 * Usage: npx tsx templates/report.ts
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const { render } = await import('../dist/index.js')

const pdf = await render({
  pageSize: 'A4',
  margins: { top: 60, bottom: 60, left: 64, right: 64 },
  defaultFontSize: 11,
  bookmarks: { minLevel: 1, maxLevel: 2 },
  hyphenation: { language: 'en-us' },
  watermark: { text: 'CONFIDENTIAL', opacity: 0.04, rotation: -45, fontSize: 72 },
  header: {
    text: 'Market Analysis Report Q2 2026',
    fontSize: 8,
    color: '#999999',
    align: 'right',
  },
  footer: {
    text: 'Page {{pageNumber}} of {{totalPages}}  ·  Research Team  ·  Confidential',
    fontSize: 8,
    color: '#999999',
    align: 'center',
  },
  metadata: {
    title: 'Market Analysis Report Q2 2026',
    author: 'Research Team',
    subject: 'Technology Market Trends and Forecasts',
  },
  content: [
    // Cover
    { type: 'spacer', height: 50 },
    {
      type: 'paragraph',
      text: 'MARKET RESEARCH',
      fontSize: 9,
      color: '#888888',
      letterSpacing: 3,
      smallCaps: true,
      align: 'center',
      spaceAfter: 12,
    },
    {
      type: 'heading',
      level: 1,
      text: 'Technology Market\nAnalysis & Trends',
      fontSize: 32,
      color: '#1a1a2e',
      align: 'center',
      spaceAfter: 8,
      bookmark: false,
    },
    {
      type: 'paragraph',
      text: 'Q2 2026  ·  Enterprise & Cloud  ·  Global Perspective',
      fontSize: 12,
      color: '#555555',
      align: 'center',
      spaceAfter: 6,
    },
    {
      type: 'hr',
      color: '#1a1a2e',
      thickness: 2,
      spaceBelow: 12,
    },
    {
      type: 'paragraph',
      text: 'Published April 2026  ·  Not for public distribution',
      fontSize: 9,
      color: '#999999',
      align: 'center',
      spaceAfter: 60,
      bookmark: false,
    },

    // TOC
    { type: 'page-break' },
    {
      type: 'toc',
      title: 'Contents',
      showTitle: true,
      leader: '.',
      minLevel: 1,
      maxLevel: 2,
      fontSize: 11,
      spaceAfter: 20,
    },

    // Executive Summary
    { type: 'page-break' },
    {
      type: 'heading',
      level: 1,
      text: 'Executive Summary',
      anchor: 'exec-summary',
      spaceAfter: 10,
    },
    {
      type: 'paragraph',
      text: 'The global technology market is entering a phase of consolidation and maturation in 2026. Cloud infrastructure spending continues to lead growth at 18% year-on-year, while AI/ML services emerge as a new high-growth category at 45% CAGR. Enterprise adoption of cloud-native architectures and DevOps practices is accelerating, particularly in regulated industries.',
      spaceAfter: 8,
    },

    {
      type: 'heading',
      level: 4,
      text: 'KEY FINDINGS',
      fontSize: 9,
      color: '#0070f3',
      spaceAfter: 4,
    },
    {
      type: 'list',
      style: 'unordered',
      fontSize: 10.5,
      items: [
        { text: 'Cloud market expected to reach $650B by end of 2026' },
        { text: 'AI integration becoming baseline requirement for enterprise software' },
        { text: 'Cybersecurity spending accelerating due to regulatory requirements' },
      ],
      spaceAfter: 12,
    },

    // Chapter 1: Market Overview
    {
      type: 'heading',
      level: 1,
      text: 'Market Overview',
      anchor: 'market-overview',
      spaceAfter: 8,
    },

    {
      type: 'heading',
      level: 2,
      text: 'Market Size & Growth',
      anchor: 'market-size',
      spaceAfter: 6,
    },

    {
      type: 'paragraph',
      text: 'The total addressable market for enterprise technology services stands at approximately $1.2 trillion. This represents growth of 12% year-on-year across all segments. Regional variations show strong growth in Asia-Pacific (16% YoY) and moderate growth in North America (9% YoY).',
      spaceAfter: 8,
    },

    {
      type: 'table',
      columns: [
        { width: '2*', align: 'left' },
        { width: 100, align: 'right' },
        { width: 100, align: 'right' },
        { width: 90, align: 'right' },
      ],
      rows: [
        {
          isHeader: true,
          cells: [
            { text: 'Segment', fontWeight: 700 },
            { text: '2026 Size ($B)', fontWeight: 700 },
            { text: 'YoY Growth', fontWeight: 700 },
            { text: 'Market Share', fontWeight: 700 },
          ],
        },
        {
          cells: [
            { text: 'Cloud Infrastructure' },
            { text: '425' },
            { text: '+18%' },
            { text: '35.4%' },
          ],
        },
        {
          cells: [
            { text: 'Software & SaaS' },
            { text: '380' },
            { text: '+14%' },
            { text: '31.7%' },
          ],
        },
        {
          cells: [
            { text: 'AI/ML Services' },
            { text: '210' },
            { text: '+45%' },
            { text: '17.5%' },
          ],
        },
        {
          cells: [
            { text: 'Cybersecurity' },
            { text: '185' },
            { text: '+22%' },
            { text: '15.4%' },
          ],
        },
      ],
      headerBgColor: '#1a1a2e',
      borderColor: '#dddddd',
      borderWidth: 0.5,
      cellPaddingH: 8,
      cellPaddingV: 8,
      spaceAfter: 12,
    },

    // Chapter 2: Competitive Landscape
    {
      type: 'heading',
      level: 1,
      text: 'Competitive Landscape',
      anchor: 'competition',
      spaceAfter: 8,
    },

    {
      type: 'heading',
      level: 2,
      text: 'Market Leaders',
      anchor: 'leaders',
      spaceAfter: 6,
    },

    {
      type: 'paragraph',
      text: 'The market remains fragmented with the top 10 vendors controlling approximately 32% of total revenue. Market consolidation through M&A continues as larger players acquire specialized vendors to expand capability portfolios.',
      spaceAfter: 10,
    },

    {
      type: 'heading',
      level: 4,
      text: 'COMPETITIVE PRESSURE',
      fontSize: 9,
      color: '#d73a49',
      spaceAfter: 4,
    },
    {
      type: 'paragraph',
      text: 'New entrants with AI-first approaches are capturing market share from traditional vendors. Expect continued pricing pressure and feature convergence in mature segments.',
      fontSize: 10.5,
      spaceAfter: 12,
    },

    // Chapter 3: Future Outlook
    {
      type: 'heading',
      level: 1,
      text: 'Future Outlook & Recommendations',
      anchor: 'outlook',
      spaceAfter: 8,
    },

    {
      type: 'heading',
      level: 2,
      text: '2027 Predictions',
      anchor: 'predictions',
      spaceAfter: 6,
    },

    {
      type: 'list',
      style: 'unordered',
      items: [
        { text: 'AI integration will become table-stakes across all software categories' },
        { text: 'Kubernetes and container orchestration will reach critical mass (>60% adoption)' },
        { text: 'Edge computing will emerge as a significant new market segment' },
        { text: 'Data privacy regulations will drive significant investment in compliance tools' },
      ],
      spaceAfter: 10,
    },

    {
      type: 'heading',
      level: 2,
      text: 'Recommended Strategies',
      anchor: 'strategies',
      spaceAfter: 6,
    },

    {
      type: 'list',
      style: 'ordered',
      items: [
        { text: 'Invest heavily in AI/ML capabilities to remain competitive' },
        { text: 'Focus on platform consolidation rather than point solutions' },
        { text: 'Build strong partnerships with cloud providers (AWS, Azure, GCP)' },
        { text: 'Prioritize customer success and retention over new customer acquisition' },
      ],
      spaceAfter: 12,
    },

    // Closing
    {
      type: 'hr',
      color: '#e8e8e8',
      thickness: 0.5,
      spaceAbove: 20,
      spaceBelow: 12,
    },

    {
      type: 'paragraph',
      text: 'This report is based on analysis of market data through Q1 2026. Projections are subject to change based on macroeconomic conditions and technology adoption rates.',
      fontSize: 9,
      color: '#888888',
    },
  ],
})

const outPath = path.join(__dirname, 'output', 'report.pdf')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, pdf)

console.log(`✓ Report PDF: ${outPath} (${(pdf.byteLength / 1024).toFixed(1)} KB)`)
