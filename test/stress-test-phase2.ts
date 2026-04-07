/**
 * Phase 2 Stress Test — Push every feature to its limits.
 *
 * Run: node --experimental-strip-types test/stress-test-phase2.ts
 *
 * This generates a single PDF designed to break weak implementations:
 * - Tables with 100+ rows (3+ page breaks)
 * - Multi-line wrapping text in table cells
 * - Table with 0 header rows (no header repetition)
 * - Table with 2 header rows
 * - Back-to-back tables with no gap
 * - Ordered list with 25 items (double-digit numbering)
 * - Nested list with wrapping text
 * - Mixed content: heading → table → hr → list → paragraph → table
 * - Small custom page to force aggressive pagination
 * - Right/center aligned table columns
 * - Table cells with different colors and bold
 * - HR between every section
 * - List immediately after a table (spacing)
 * - Empty-ish cell text (single char)
 * - Very wide table text that forces multi-line cell wrapping
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.join(__dirname, 'output')
fs.mkdirSync(outputDir, { recursive: true })

const { render } = await import('../dist/index.js')

function save(filename: string, bytes: Uint8Array) {
  const outPath = path.join(outputDir, filename)
  fs.writeFileSync(outPath, bytes)
  console.log(`✅ ${filename}  (${(bytes.byteLength / 1024).toFixed(1)} KB, ${bytes.byteLength} bytes)`)
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 1: Large table on small page (extreme pagination stress)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n🔬 Test 1: Large table on small page (extreme pagination) ...')
save('stress-table-pagination.pdf', await render({
  pageSize: [400, 300],  // Very small page — forces many page breaks
  margins: { top: 40, bottom: 40, left: 30, right: 30 },
  defaultFontSize: 9,
  footer: { text: 'Page {{pageNumber}} of {{totalPages}}', fontSize: 7, align: 'center' },
  content: [
    { type: 'heading', level: 2, text: 'Stress: 100-Row Table on Small Page', spaceAfter: 4 },
    {
      type: 'table',
      columns: [
        { width: 30, align: 'right' },
        { width: '*', align: 'left' },
        { width: 60, align: 'center' },
        { width: 60, align: 'right' },
      ],
      rows: [
        {
          isHeader: true,
          cells: [
            { text: '#', fontWeight: 700 },
            { text: 'Description', fontWeight: 700 },
            { text: 'Status', fontWeight: 700 },
            { text: 'Amount', fontWeight: 700 },
          ],
        },
        ...Array.from({ length: 100 }, (_, i) => ({
          cells: [
            { text: String(i + 1) },
            { text: `Item ${i + 1} — ${i % 5 === 0 ? 'This item has a very long description that should wrap to multiple lines within the cell to test cell height calculation' : 'Standard item'}` },
            { text: i % 4 === 0 ? 'Paid' : i % 4 === 1 ? 'Pending' : i % 4 === 2 ? 'Overdue' : 'Draft',
              color: i % 4 === 0 ? '#006600' : i % 4 === 1 ? '#cc6600' : i % 4 === 2 ? '#cc0000' : '#666666' },
            { text: `₹${((i + 1) * 1500).toLocaleString('en-IN')}` },
          ],
        })),
      ],
      borderColor: '#888888',
      borderWidth: 0.5,
      headerBgColor: '#e8eeff',
      cellPaddingH: 4,
      cellPaddingV: 3,
      fontSize: 8,
      spaceAfter: 8,
    },
    { type: 'paragraph', text: '↑ End of 100-row table. This text should appear after the table on the final page.', fontSize: 7, color: '#888888' },
  ],
}))

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 2: Table with NO header rows (no repetition expected)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n🔬 Test 2: Table with 0 header rows ...')
save('stress-table-no-header.pdf', await render({
  pageSize: [400, 300],
  margins: { top: 30, bottom: 30, left: 30, right: 30 },
  defaultFontSize: 9,
  content: [
    { type: 'heading', level: 3, text: 'Table Without Header Rows', spaceAfter: 4 },
    {
      type: 'table',
      columns: [{ width: '*' }, { width: 80 }],
      rows: Array.from({ length: 30 }, (_, i) => ({
        // NO isHeader on any row
        cells: [
          { text: `Data row ${i + 1} — no header row should appear on any page` },
          { text: `₹${(i + 1) * 500}` },
        ],
      })),
      borderColor: '#aaaaaa',
      borderWidth: 0.5,
      cellPaddingH: 6,
      cellPaddingV: 4,
      spaceAfter: 4,
    },
    { type: 'paragraph', text: 'Verify: NO header row appears on any page (including page 2+).', fontSize: 7, color: '#cc0000' },
  ],
}))

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 3: Table with 2 header rows
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n🔬 Test 3: Table with 2 header rows ...')
save('stress-table-2-headers.pdf', await render({
  pageSize: [400, 350],
  margins: { top: 30, bottom: 30, left: 30, right: 30 },
  defaultFontSize: 9,
  content: [
    { type: 'heading', level: 3, text: 'Two Header Rows (Both Should Repeat)', spaceAfter: 4 },
    {
      type: 'table',
      columns: [
        { width: '*', align: 'left' },
        { width: 50, align: 'center' },
        { width: 60, align: 'right' },
      ],
      rows: [
        {
          isHeader: true,
          cells: [
            { text: 'Category / Description', fontWeight: 700, bgColor: '#d4e6ff' },
            { text: 'Qty', fontWeight: 700, bgColor: '#d4e6ff' },
            { text: 'Amount', fontWeight: 700, bgColor: '#d4e6ff' },
          ],
        },
        {
          isHeader: true,
          cells: [
            { text: '(all amounts in INR)', color: '#666666' },
            { text: '' },
            { text: 'excl. GST', color: '#666666' },
          ],
        },
        ...Array.from({ length: 25 }, (_, i) => ({
          cells: [
            { text: `Service line item #${i + 1}` },
            { text: String(Math.floor(Math.random() * 20) + 1) },
            { text: `₹${((i + 1) * 2000).toLocaleString('en-IN')}` },
          ],
        })),
      ],
      borderColor: '#bbbbbb',
      borderWidth: 0.5,
      headerBgColor: '#eef4ff',
      cellPaddingH: 6,
      cellPaddingV: 4,
      spaceAfter: 4,
    },
    { type: 'paragraph', text: 'Verify: BOTH header rows repeat on every continuation page.', fontSize: 7, color: '#006600' },
  ],
}))

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 4: Back-to-back tables with no gap + mixed content tornado
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n🔬 Test 4: Mixed content tornado ...')
save('stress-mixed-content.pdf', await render({
  pageSize: 'A4',
  margins: { top: 50, bottom: 50, left: 60, right: 60 },
  defaultFontSize: 10,
  header: { text: 'STRESS TEST — Mixed Content', fontSize: 8, align: 'left' },
  footer: { text: 'Page {{pageNumber}} / {{totalPages}}', fontSize: 8, align: 'right' },
  content: [
    // Section 1: heading + table
    { type: 'heading', level: 1, text: 'Section 1: Financial Summary', color: '#1a1a2e', spaceAfter: 8 },

    {
      type: 'table',
      columns: [{ width: '2*' }, { width: '*' }, { width: 80, align: 'right' }],
      rows: [
        { isHeader: true, cells: [{ text: 'Department', fontWeight: 700 }, { text: 'Quarter', fontWeight: 700 }, { text: 'Revenue', fontWeight: 700 }] },
        { cells: [{ text: 'Engineering' }, { text: 'Q1 2026' }, { text: '₹45,00,000' }] },
        { cells: [{ text: 'Sales & Marketing' }, { text: 'Q1 2026' }, { text: '₹32,00,000' }] },
        { cells: [{ text: 'Operations' }, { text: 'Q1 2026' }, { text: '₹18,50,000' }] },
        { cells: [{ text: 'Research & Development' }, { text: 'Q1 2026' }, { text: '₹12,75,000', color: '#cc6600' }] },
      ],
      borderColor: '#cccccc',
      borderWidth: 0.5,
      headerBgColor: '#f0f4ff',
      cellPaddingH: 8,
      cellPaddingV: 5,
      // NO spaceAfter — table 2 should butt right up against this one
    },

    // Back-to-back table 2 (0pt gap)
    {
      type: 'table',
      columns: [{ width: '2*' }, { width: '*' }, { width: 80, align: 'right' }],
      rows: [
        { isHeader: true, cells: [{ text: 'Expense Category', fontWeight: 700 }, { text: 'Quarter', fontWeight: 700 }, { text: 'Cost', fontWeight: 700 }] },
        { cells: [{ text: 'Cloud Infrastructure (AWS + OVH)' }, { text: 'Q1 2026' }, { text: '₹8,50,000' }] },
        { cells: [{ text: 'Salaries & Benefits' }, { text: 'Q1 2026' }, { text: '₹28,00,000' }] },
        { cells: [{ text: 'Software Licenses' }, { text: 'Q1 2026' }, { text: '₹3,20,000' }] },
        { cells: [{ text: 'Legal & Compliance' }, { text: 'Q1 2026' }, { text: '₹2,10,000' }] },
        { cells: [{ text: 'TOTAL', fontWeight: 700 }, { text: '', fontWeight: 700 }, { text: '₹41,80,000', fontWeight: 700, color: '#cc0000' }] },
      ],
      borderColor: '#cccccc',
      borderWidth: 0.5,
      headerBgColor: '#fff4f0',
      cellPaddingH: 8,
      cellPaddingV: 5,
      spaceAfter: 12,
    },

    // HR separator
    { type: 'hr', thickness: 1, color: '#1a1a2e', spaceAbove: 8, spaceBelow: 16 },

    // Section 2: heading + ordered list
    { type: 'heading', level: 2, text: 'Section 2: Action Items', spaceAfter: 8 },
    {
      type: 'list',
      style: 'ordered',
      items: Array.from({ length: 25 }, (_, i) => ({
        text: i % 3 === 0
          ? `Action item ${i + 1}: This is a deliberately verbose action item that should wrap to at least two lines to test the list measurement and rendering pipeline thoroughly. The marker "1." vs "10." vs "25." should all right-align.`
          : `Action item ${i + 1}: Brief task description for item number ${i + 1}.`,
      })),
      itemSpaceAfter: 4,
      spaceAfter: 12,
    },

    // HR
    { type: 'hr', thickness: 0.5, color: '#cccccc', spaceAbove: 4, spaceBelow: 12 },

    // Section 3: nested list
    { type: 'heading', level: 2, text: 'Section 3: Service Taxonomy', spaceAfter: 6 },
    {
      type: 'list',
      style: 'unordered',
      items: [
        {
          text: 'AI & Machine Learning',
          items: [
            { text: 'Strategy consulting and roadmap development for enterprise AI adoption' },
            { text: 'Custom LLM integration, fine-tuning, and deployment (GPT-4, Claude, Gemini)' },
            { text: 'RAG pipeline architecture and vector database optimization' },
          ],
        },
        {
          text: 'Research & Intelligence',
          items: [
            { text: 'Real estate market analysis covering Haryana NCR micro-markets with comparable sales data' },
            { text: 'Competitive intelligence reports for SaaS, real estate, and fintech verticals' },
          ],
        },
        {
          text: 'Infrastructure & Automation',
          items: [
            { text: 'n8n workflow automation pipelines connecting Supabase, SendGrid, Slack, and custom APIs' },
            { text: 'VPS provisioning and management (OVH, Hetzner) with Docker and Coolify' },
          ],
        },
        { text: 'Monthly retainer engagements (dedicated support hours)' },
      ],
      spaceAfter: 16,
    },

    // Section 4: another table (testing table after list)
    { type: 'heading', level: 2, text: 'Section 4: Pricing Matrix', spaceAfter: 8 },
    {
      type: 'table',
      columns: [
        { width: '*', align: 'left' },
        { width: 80, align: 'center' },
        { width: 80, align: 'right' },
        { width: 80, align: 'right' },
      ],
      rows: [
        { isHeader: true, cells: [
          { text: 'Service', fontWeight: 700 },
          { text: 'Unit', fontWeight: 700 },
          { text: 'Rate', fontWeight: 700 },
          { text: 'Min Order', fontWeight: 700 },
        ]},
        { cells: [{ text: 'AI Strategy Consulting' }, { text: 'Hour' }, { text: '₹8,000' }, { text: '10 hrs' }] },
        { cells: [{ text: 'LLM Integration' }, { text: 'Hour' }, { text: '₹10,000' }, { text: '20 hrs' }] },
        { cells: [{ text: 'Market Analysis Report' }, { text: 'Report' }, { text: '₹75,000' }, { text: '1' }] },
        { cells: [{ text: 'Automation Pipeline' }, { text: 'Pipeline' }, { text: '₹60,000' }, { text: '1' }] },
        { cells: [{ text: 'Monthly Retainer (Priority Support)' }, { text: 'Month' }, { text: '₹50,000' }, { text: '3 months' }] },
        { cells: [{ text: 'VPS Management' }, { text: 'Month' }, { text: '₹15,000' }, { text: '6 months' }] },
        { cells: [{ text: 'Data Engineering (ETL + dbt)' }, { text: 'Hour' }, { text: '₹7,500' }, { text: '15 hrs' }] },
        { cells: [{ text: 'Technical Due Diligence' }, { text: 'Engagement' }, { text: '₹2,00,000' }, { text: '1' }] },
      ],
      borderColor: '#cccccc',
      borderWidth: 0.5,
      headerBgColor: '#f8f8f8',
      cellPaddingH: 6,
      cellPaddingV: 5,
      spaceAfter: 8,
    },

    // Closing
    { type: 'hr', color: '#e0e0e0', spaceAbove: 8, spaceBelow: 8 },
    { type: 'paragraph', text: 'End of stress test document. All elements should compose correctly with no overlapping, no missing headers, and correct spacing.', fontSize: 8, color: '#888888' },
  ],
}))

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 5: Table with borderWidth: 0 (no visible borders)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n🔬 Test 5: Borderless table ...')
save('stress-table-borderless.pdf', await render({
  content: [
    { type: 'heading', level: 3, text: 'Borderless Table', spaceAfter: 8 },
    {
      type: 'table',
      columns: [{ width: '*' }, { width: 100, align: 'right' }],
      borderWidth: 0,
      rows: [
        { isHeader: true, cells: [{ text: 'Item', fontWeight: 700 }, { text: 'Total', fontWeight: 700 }] },
        { cells: [{ text: 'Consulting Services' }, { text: '₹3,00,000' }] },
        { cells: [{ text: 'Implementation' }, { text: '₹2,00,000' }] },
        { cells: [{ text: 'Training & Documentation' }, { text: '₹75,000' }] },
      ],
      headerBgColor: '#f0f0f0',
      cellPaddingH: 8,
      cellPaddingV: 6,
      spaceAfter: 12,
    },
    { type: 'paragraph', text: 'Above table should have NO borders — only header background color and text alignment.', fontSize: 8, color: '#666666' },
  ],
}))

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 6: Table with multi-line cells in every row
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n🔬 Test 6: Table with multi-line cell wrapping ...')
save('stress-table-multiline-cells.pdf', await render({
  pageSize: [500, 400],
  margins: { top: 40, bottom: 40, left: 40, right: 40 },
  defaultFontSize: 9,
  content: [
    { type: 'heading', level: 3, text: 'Multi-line Cell Wrapping Stress', spaceAfter: 4 },
    {
      type: 'table',
      columns: [
        { width: '*', align: 'left' },
        { width: '*', align: 'left' },
      ],
      rows: [
        { isHeader: true, cells: [{ text: 'Question', fontWeight: 700 }, { text: 'Answer', fontWeight: 700 }] },
        {
          cells: [
            { text: 'What services does Antigravity Systems provide?' },
            { text: 'We provide AI strategy consulting, custom LLM integration and deployment, real estate market analysis for Haryana NCR, automation pipeline setup using n8n and Supabase, and monthly retainer engagements for priority support.' },
          ],
        },
        {
          cells: [
            { text: 'What is the typical engagement timeline?' },
            { text: 'Consulting engagements start with a 2-week discovery phase, followed by 4-8 weeks of implementation. Retainer clients receive ongoing support with 48-hour response SLAs.' },
          ],
        },
        {
          cells: [
            { text: 'How is pricing structured?' },
            { text: 'Hourly rates range from ₹7,500 to ₹10,000 depending on complexity. Fixed-fee projects start at ₹60,000. Monthly retainers begin at ₹50,000 with a 3-month minimum commitment.' },
          ],
        },
        {
          cells: [
            { text: 'What technologies do you work with?' },
            { text: 'Our core stack includes Node.js, TypeScript, Next.js, Supabase, PostgreSQL, Redis, Docker, n8n, and various LLM APIs (OpenAI, Anthropic Claude, Google Gemini). We also work with pdf-lib, Pretext, and custom tooling.' },
          ],
        },
        {
          cells: [
            { text: 'Do you support clients outside India?' },
            { text: 'Yes, we work with international clients. All invoicing can be done in USD, EUR, or INR. Time zone overlap is managed through async communication and scheduled sync calls.' },
          ],
        },
      ],
      borderColor: '#cccccc',
      borderWidth: 0.5,
      headerBgColor: '#eef4ff',
      cellPaddingH: 8,
      cellPaddingV: 6,
      spaceAfter: 4,
    },
    { type: 'paragraph', text: 'Verify: row heights adapt to the tallest cell. Text should not overflow cell boundaries.', fontSize: 7, color: '#666666' },
  ],
}))

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 7: Ordered list with 30 items on small page (list pagination + double digits)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n🔬 Test 7: Large ordered list on small page ...')
save('stress-list-pagination.pdf', await render({
  pageSize: [400, 350],
  margins: { top: 30, bottom: 30, left: 40, right: 40 },
  defaultFontSize: 10,
  footer: { text: 'Page {{pageNumber}}', fontSize: 7, align: 'center' },
  content: [
    { type: 'heading', level: 3, text: 'Ordered List: 30 Items', spaceAfter: 4 },
    {
      type: 'list',
      style: 'ordered',
      items: Array.from({ length: 30 }, (_, i) => ({
        text: i % 5 === 0
          ? `Item ${i + 1}: This is a longer item that should wrap to multiple lines. The marker "${i + 1}." should right-align so that body text for items 1-9 and 10-30 starts at the same x position.`
          : `Item ${i + 1}: Brief item.`,
      })),
      itemSpaceAfter: 3,
      spaceAfter: 8,
    },
    { type: 'paragraph', text: 'Verify: markers right-align (1. and 10. and 30. all end at same x). List paginates correctly.', fontSize: 7, color: '#006600' },
  ],
}))

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 8: Everything on one page (fit test — no pagination)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n🔬 Test 8: Everything fits on one A4 page ...')
save('stress-single-page.pdf', await render({
  pageSize: 'A4',
  margins: { top: 60, bottom: 60, left: 72, right: 72 },
  defaultFontSize: 10,
  content: [
    { type: 'heading', level: 1, text: 'Single-Page Stress', color: '#1a1a2e', spaceAfter: 4 },
    { type: 'paragraph', text: 'Everything below should fit on one page without overflow.', fontSize: 9, color: '#666666', spaceAfter: 8 },

    { type: 'table',
      columns: [{ width: '*' }, { width: 80, align: 'right' }],
      rows: [
        { isHeader: true, cells: [{ text: 'Item', fontWeight: 700 }, { text: 'Amount', fontWeight: 700 }] },
        { cells: [{ text: 'Service A' }, { text: '₹1,00,000' }] },
        { cells: [{ text: 'Service B' }, { text: '₹2,00,000' }] },
      ],
      borderColor: '#dddddd', borderWidth: 0.5, headerBgColor: '#f0f4ff',
      cellPaddingH: 6, cellPaddingV: 4, spaceAfter: 8,
    },

    { type: 'hr', thickness: 0.5, color: '#dddddd', spaceAbove: 4, spaceBelow: 8 },

    { type: 'list', style: 'unordered', items: [
      { text: 'Bank transfer' },
      { text: 'UPI payment' },
      { text: 'Cheque' },
    ], fontSize: 9, spaceAfter: 8 },

    { type: 'hr', color: '#e0e0e0', spaceAbove: 4, spaceBelow: 4 },

    { type: 'list', style: 'ordered', items: [
      { text: 'Verify invoice details' },
      { text: 'Process payment' },
      { text: 'Send confirmation' },
    ], fontSize: 9, spaceAfter: 8 },

    { type: 'paragraph', text: 'This is the final paragraph. If you can read this, everything fit on one page.', fontSize: 8, color: '#888888' },
  ],
}))

// ═══════════════════════════════════════════════════════════════════════════════
// DONE
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(70))
console.log('✅ All 8 stress tests generated in test/output/')
console.log('═'.repeat(70))
console.log('\nVisual verification checklist:')
console.log('  1. stress-table-pagination.pdf     — 100 rows, header repeats on every page, last page has trailing text')
console.log('  2. stress-table-no-header.pdf       — NO header on ANY page (including page 2+)')
console.log('  3. stress-table-2-headers.pdf        — BOTH header rows repeat on every continuation page')
console.log('  4. stress-mixed-content.pdf          — back-to-back tables, HR, lists, headings all compose correctly')
console.log('  5. stress-table-borderless.pdf       — no borders, only header bg + text')
console.log('  6. stress-table-multiline-cells.pdf  — row heights adapt to tallest cell, no text overflow')
console.log('  7. stress-list-pagination.pdf        — ordered 1-30, markers right-align, paginates')
console.log('  8. stress-single-page.pdf            — table + hr + 2 lists + text all on one page')
