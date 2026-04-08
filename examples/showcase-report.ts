/**
 * Showcase: Market Research Report
 * Real-world business report with TOC, bookmarks, watermark, sections, data tables
 */
import { render } from '../dist/index.js'
import { writeFileSync, mkdirSync } from 'fs'
mkdirSync('output', { recursive: true })

const pdf = await render({
  pageSize: 'A4',
  margins: { top: 60, bottom: 60, left: 64, right: 64 },
  defaultFontSize: 11,
  bookmarks: { minLevel: 1, maxLevel: 3 },
  hyphenation: { language: 'en-us' },
  watermark: { text: 'CONFIDENTIAL', opacity: 0.04, rotation: -45, fontSize: 72 },
  header: { text: 'Haryana Real Estate Market Report Q1 2026', fontSize: 8, color: '#999999', align: 'right' },
  footer: { text: 'Page {{pageNumber}} of {{totalPages}}  ·  Antigravity Research  ·  Confidential', fontSize: 8, color: '#999999', align: 'center' },
  metadata: { title: 'Haryana Real Estate Market Report Q1 2026', author: 'Antigravity Research', subject: 'Residential & Commercial Real Estate Analysis' },
  content: [
    // Cover
    { type: 'spacer', height: 40 },
    { type: 'paragraph', text: 'MARKET RESEARCH REPORT', fontSize: 10, color: '#888888', letterSpacing: 3, smallCaps: true, align: 'center', spaceAfter: 8 },
    { type: 'heading', level: 1, text: 'Haryana Real Estate\nMarket Analysis', fontSize: 28, color: '#1a1a2e', align: 'center', spaceAfter: 8, bookmark: false },
    { type: 'paragraph', text: 'Q1 2026  ·  Residential & Commercial  ·  NCR Focus', fontSize: 12, color: '#555555', align: 'center', spaceAfter: 6 },
    { type: 'hr', color: '#1a1a2e', thickness: 2, spaceBelow: 8 },
    { type: 'paragraph', text: 'Published by Antigravity Research  ·  April 2026  ·  Not for redistribution', fontSize: 9, color: '#999999', align: 'center', spaceAfter: 40 },

    // TOC
    { type: 'toc', title: 'Contents', showTitle: true, leader: '.', minLevel: 1, maxLevel: 2, fontSize: 11, spaceAfter: 20 },

    // Executive Summary
    { type: 'page-break' },
    { type: 'heading', level: 1, text: 'Executive Summary', anchor: 'exec-summary', spaceAfter: 10 },
    { type: 'paragraph', text: 'The Haryana residential real estate market demonstrated robust growth in Q1 2026, with transacted volumes rising 18% year-on-year across key micro-markets. Gurugram maintained its position as the dominant market, accounting for 41% of all registered transactions. New Gurugram (Sectors 79-115) emerged as the fastest-growing submarket, driven by infrastructure completion on the Dwarka Expressway and Southern Peripheral Road corridor.', spaceAfter: 8 },
    { type: 'paragraph', text: 'Weighted average residential prices across Gurugram reached Rs.12,400/sqft, up 11% year-on-year. Faridabad and Panchkula showed modest appreciation of 6-8%, while Sonipat continued its upward trajectory following the announcement of the RRTS corridor.', spaceAfter: 8 },
    {
      type: 'table',
      columns: [{ width: '2*' }, { width: 90, align: 'right' }, { width: 90, align: 'right' }, { width: 80, align: 'right' }],
      rows: [
        { isHeader: true, cells: [
          { text: 'Market', fontWeight: 700 },
          { text: 'Avg Rs./sqft', fontWeight: 700 },
          { text: 'YoY Change', fontWeight: 700 },
          { text: 'Vol (units)', fontWeight: 700 },
        ]},
        { cells: [{ text: 'Gurugram - DLF, Golf Course' }, { text: '18,200' }, { text: '+9.2%' }, { text: '1,840' }] },
        { cells: [{ text: 'Gurugram - New Gurugram' }, { text: '9,800' }, { text: '+15.6%' }, { text: '3,210' }] },
        { cells: [{ text: 'Gurugram - Sohna Road' }, { text: '8,400' }, { text: '+12.1%' }, { text: '2,100' }] },
        { cells: [{ text: 'Faridabad - Sector 14-21' }, { text: '5,200' }, { text: '+6.8%' }, { text: '890' }] },
        { cells: [{ text: 'Panchkula - Sectors 5-12' }, { text: '6,100' }, { text: '+7.4%' }, { text: '640' }] },
        { cells: [{ text: 'Sonipat - NH-44 Corridor' }, { text: '4,100' }, { text: '+19.2%' }, { text: '420' }] },
      ],
      headerBgColor: '#f0f4ff',
      borderColor: '#dddddd',
      borderWidth: 0.5,
      cellPaddingH: 8,
      cellPaddingV: 6,
      spaceAfter: 16,
    },

    // Market Drivers
    { type: 'heading', level: 1, text: 'Market Drivers', anchor: 'market-drivers', spaceAfter: 8 },
    { type: 'heading', level: 2, text: 'Infrastructure Completions', anchor: 'infra', spaceAfter: 6 },
    { type: 'paragraph', text: 'The commissioning of the Dwarka Expressway elevated corridor in late 2025 triggered a significant re-rating of New Gurugram residential values. Average commute times from Sector 106 to Connaught Place fell from 75 minutes to under 40 minutes, making the corridor viable for Delhi-based professionals for the first time. The Southern Peripheral Road widening project, completed December 2025, similarly improved connectivity between Golf Course Extension and NH-48.', spaceAfter: 8 },
    { type: 'heading', level: 2, text: 'Policy Environment', anchor: 'policy', spaceAfter: 6 },
    { type: 'paragraph', text: "RERA enforcement has continued to improve buyer confidence, with registered complaints declining 22% year-on-year. The Haryana government's affordable housing policy (EWS/LIG units mandated at 20% of project area) has modestly compressed margins for Tier-1 developers but improved project approval timelines. RBI's hold on repo rates at 6.25% through Q1 2026 maintained housing loan affordability.", spaceAfter: 8 },
    { type: 'heading', level: 2, text: 'Demand Composition', anchor: 'demand', spaceAfter: 6 },
    {
      type: 'table',
      columns: [{ width: '2*' }, { width: 100, align: 'right' }, { width: 100, align: 'right' }],
      rows: [
        { isHeader: true, cells: [
          { text: 'Buyer Segment', fontWeight: 700 },
          { text: 'Q1 2026 Share', fontWeight: 700 },
          { text: 'Q1 2025 Share', fontWeight: 700 },
        ]},
        { cells: [{ text: 'End-use (self-occupation)' }, { text: '58%' }, { text: '61%' }] },
        { cells: [{ text: 'Investment (rental yield play)' }, { text: '29%' }, { text: '24%' }] },
        { cells: [{ text: 'NRI buyers' }, { text: '9%' }, { text: '11%' }] },
        { cells: [{ text: 'Institutional / bulk' }, { text: '4%' }, { text: '4%' }] },
      ],
      headerBgColor: '#f0f4ff',
      borderColor: '#dddddd',
      borderWidth: 0.5,
      cellPaddingH: 8,
      cellPaddingV: 6,
      spaceAfter: 16,
    },

    // Outlook
    { type: 'heading', level: 1, text: 'Outlook & Recommendations', anchor: 'outlook', spaceAfter: 8 },
    { type: 'paragraph', text: 'We maintain a positive outlook for Haryana residential real estate over the next 12 months. The following micro-markets are expected to outperform the broader market:', spaceAfter: 8 },
    {
      type: 'list',
      style: 'ordered',
      items: [
        { text: 'New Gurugram (Sectors 79-95): Infrastructure tailwind continues; expect 14-18% price appreciation.' },
        { text: 'Sohna Road Extension: Land parcels now activating; early-mover opportunity for investors.' },
        { text: 'Sonipat RRTS Corridor: Highest risk-adjusted return potential; 3-5 year horizon.' },
        { text: 'Panchkula Sectors 20-26: Stable appreciation; good rental yield story (3.8-4.2%).' },
      ],
      fontSize: 11,
      spaceAfter: 12,
    },
    {
      type: 'blockquote',
      text: 'Key risk: Any upward revision to repo rates above 6.75% would materially impact EMI affordability for mid-segment buyers and could compress volumes by 10-15% over two quarters.',
      borderColor: '#e63946',
      color: '#333333',
      spaceAfter: 12,
    },

    // Methodology
    { type: 'heading', level: 1, text: 'Methodology', anchor: 'methodology', spaceAfter: 8 },
    { type: 'paragraph', text: 'Data sourced from RERA Haryana registered transaction disclosures (Jan-Mar 2026), district registrar records, and primary field surveys conducted across 28 micro-markets. Price indices are weighted by transacted area. Year-on-year comparisons use Q1 2025 as base.', fontSize: 10, color: '#555555' },
  ],
})

writeFileSync('output/showcase-report.pdf', pdf)
console.log(`Done: showcase-report.pdf  (${(pdf.byteLength / 1024).toFixed(0)} KB)`)
