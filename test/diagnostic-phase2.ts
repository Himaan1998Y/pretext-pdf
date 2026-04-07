/**
 * Phase 2 Diagnostic PDF Generator
 *
 * Generates visual test PDFs for each new element type.
 * Open each output in a PDF viewer and visually verify before signing off on Phase 2.
 *
 * Run: node --experimental-strip-types test/diagnostic-phase2.ts
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
  console.log(`✅ ${filename}  (${(bytes.byteLength / 1024).toFixed(1)} KB)`)
}

// ─── Diagnostic 1: Table borders, header, cell padding ───────────────────────

console.log('\n📋 Generating diagnostic-table.pdf ...')
save('diagnostic-table.pdf', await render({
  defaultFontSize: 10,
  content: [
    { type: 'heading', level: 2, text: 'Table Diagnostic — Border Alignment, Header Repetition', spaceAfter: 8 },
    { type: 'paragraph', text: 'Check: borders align, header row has colored bg, text doesn\'t overlap borders, header repeats on page 2.', spaceAfter: 12 },
    {
      type: 'table',
      columns: [
        { width: '*',   align: 'left' },
        { width: 80,  align: 'center' },
        { width: 80,  align: 'right' },
        { width: 60,  align: 'right' },
      ],
      rows: [
        {
          isHeader: true,
          cells: [
            { text: 'Description', fontWeight: 700 },
            { text: 'Date', fontWeight: 700 },
            { text: 'Amount', fontWeight: 700 },
            { text: 'Status', fontWeight: 700 },
          ],
        },
        ...Array.from({ length: 30 }, (_, i) => ({
          cells: [
            { text: `Service Item ${String(i + 1).padStart(2, '0')} — Professional Services` },
            { text: `2026-0${(i % 9) + 1}-15` },
            { text: `₹${((i + 1) * 5000).toLocaleString('en-IN')}` },
            { text: i % 3 === 0 ? 'Paid' : i % 3 === 1 ? 'Pending' : 'Due', color: i % 3 === 0 ? '#006600' : i % 3 === 1 ? '#cc6600' : '#cc0000' },
          ],
        })),
      ],
      borderColor: '#cccccc',
      borderWidth: 0.5,
      headerBgColor: '#f0f4ff',
      cellPaddingH: 8,
      cellPaddingV: 5,
      spaceAfter: 12,
    },
    { type: 'paragraph', text: 'End of table — this text should appear after the table on the last page.', fontSize: 9, color: '#888888' },
  ],
}))

// ─── Diagnostic 2: List alignment, marker positioning ────────────────────────

console.log('\n📋 Generating diagnostic-list.pdf ...')
save('diagnostic-list.pdf', await render({
  defaultFontSize: 11,
  content: [
    { type: 'heading', level: 2, text: 'List Diagnostic — Marker Alignment & Indentation', spaceAfter: 8 },

    { type: 'heading', level: 3, text: 'Ordered List (check: numbers right-align in column)', spaceAfter: 4 },
    {
      type: 'list',
      style: 'ordered',
      items: Array.from({ length: 15 }, (_, i) => ({
        text: `List item number ${i + 1} — this text should align with the text of item 1, not with the number. If the text starts at different x positions for "1." vs "10." that's a bug.`,
      })),
      spaceAfter: 16,
    },

    { type: 'heading', level: 3, text: 'Unordered List (check: bullets align, text indents correctly)', spaceAfter: 4 },
    {
      type: 'list',
      style: 'unordered',
      items: [
        { text: 'Short item' },
        { text: 'A longer item that wraps to a second line — the second line should align with the first line, not with the bullet point.' },
        { text: 'Another short item' },
        { text: 'Yet another longer item that demonstrates that continuation lines of a list item indent correctly and do not start at the bullet column.' },
        { text: 'Final item' },
      ],
      spaceAfter: 16,
    },

    { type: 'heading', level: 3, text: 'Nested List (check: inner items use hollow bullet, deeper indent)', spaceAfter: 4 },
    {
      type: 'list',
      style: 'unordered',
      items: [
        {
          text: 'AI Services',
          items: [
            { text: 'Strategy consulting and roadmap development' },
            { text: 'Custom LLM integration and fine-tuning' },
          ],
        },
        {
          text: 'Research & Analysis',
          items: [
            { text: 'Real estate market analysis (Haryana NCR)' },
            { text: 'Competitive intelligence reports' },
          ],
        },
        { text: 'Automation Pipelines (no nested items)' },
      ],
      spaceAfter: 12,
    },

    { type: 'paragraph', text: 'List diagnostic end. Text after list should be normally positioned.', fontSize: 9, color: '#666666' },
  ],
}))

// ─── Diagnostic 3: Horizontal rules at various sizes ─────────────────────────

console.log('\n📋 Generating diagnostic-hr.pdf ...')
save('diagnostic-hr.pdf', await render({
  content: [
    { type: 'heading', level: 2, text: 'HR Diagnostic — Spacing & Thickness', spaceAfter: 8 },
    { type: 'paragraph', text: 'Default HR (0.5pt, #cccccc, 12pt space above/below):', spaceAfter: 0 },
    { type: 'hr' },
    { type: 'paragraph', text: 'Thick dark HR (2pt, #1a1a2e, 20pt space above/below):', spaceAfter: 0 },
    { type: 'hr', thickness: 2, color: '#1a1a2e', spaceAbove: 20, spaceBelow: 20 },
    { type: 'paragraph', text: 'Thin colored HR (0.25pt, #cc0000, 8pt space above/below):', spaceAfter: 0 },
    { type: 'hr', thickness: 0.25, color: '#cc0000', spaceAbove: 8, spaceBelow: 8 },
    { type: 'paragraph', text: 'Tight HR (0.5pt, 4pt space above/below):', spaceAfter: 0 },
    { type: 'hr', spaceAbove: 4, spaceBelow: 4 },
    { type: 'paragraph', text: 'Wide space HR (0.5pt, 32pt space above/below):', spaceAfter: 0 },
    { type: 'hr', spaceAbove: 32, spaceBelow: 32 },
    { type: 'paragraph', text: 'HR diagnostic end. Verify all lines span full content width and spacing looks correct.', fontSize: 9, color: '#666666' },
  ],
}))

// ─── Diagnostic 4: Full invoice v2 ───────────────────────────────────────────

console.log('\n📋 Generating diagnostic-invoice-v2.pdf ...')
save('diagnostic-invoice-v2.pdf', await render({
  pageSize: 'A4',
  margins: { top: 60, bottom: 60, left: 72, right: 72 },
  defaultFontSize: 11,
  footer: { text: 'Page {{pageNumber}} of {{totalPages}}  |  Antigravity Systems', fontSize: 9, align: 'center' },
  content: [
    { type: 'heading', level: 1, text: 'INVOICE', color: '#1a1a2e', spaceAfter: 4 },
    { type: 'paragraph', text: 'Invoice #INV-2026-0042\nDate: March 31, 2026\nDue: April 30, 2026', fontSize: 10, color: '#666666', spaceAfter: 16 },

    { type: 'heading', level: 3, text: 'From', color: '#333333', spaceAfter: 4 },
    { type: 'paragraph', text: 'Antigravity Systems Pvt. Ltd.\n123 Innovation Park, Sector 18\nGurgaon, Haryana 122015\nGSTIN: 06AABCA1234Z1ZK', fontSize: 10, color: '#444444', spaceAfter: 12 },

    { type: 'heading', level: 3, text: 'Bill To', color: '#333333', spaceAfter: 4 },
    { type: 'paragraph', text: 'Acme Technologies Ltd.\nAttn: Accounts Payable\n456 Business Hub, DLF Phase 3\nGurgaon, Haryana 122002\nGSTIN: 06AACCA5678B2ZM', fontSize: 10, color: '#444444', spaceAfter: 16 },

    { type: 'heading', level: 3, text: 'Services Rendered', color: '#1a1a2e', spaceAfter: 8 },

    {
      type: 'table',
      columns: [
        { width: '3*', align: 'left' },
        { width: 80, align: 'right' },
        { width: 90, align: 'right' },
      ],
      rows: [
        { isHeader: true, cells: [{ text: 'Description', fontWeight: 700 }, { text: 'Hours/Type', fontWeight: 700 }, { text: 'Amount (₹)', fontWeight: 700 }] },
        { cells: [{ text: 'AI Strategy Consulting' }, { text: '15 hrs @ ₹8,000' }, { text: '1,20,000' }] },
        { cells: [{ text: 'Custom LLM Integration & Deployment' }, { text: '20 hrs @ ₹10,000' }, { text: '2,00,000' }] },
        { cells: [{ text: 'Real Estate Market Analysis Report (Haryana NCR, Q1 2026)' }, { text: 'Fixed' }, { text: '75,000' }] },
        { cells: [{ text: 'Automation Pipeline Setup (n8n + Supabase + VPS)' }, { text: 'Fixed' }, { text: '60,000' }] },
        { cells: [{ text: 'Monthly Retainer — March 2026' }, { text: 'Fixed' }, { text: '50,000' }] },
      ],
      headerBgColor: '#f0f4ff',
      borderColor: '#dddddd',
      cellPaddingH: 8,
      cellPaddingV: 6,
      spaceAfter: 8,
    },

    { type: 'hr', color: '#dddddd', thickness: 0.5, spaceAbove: 4, spaceBelow: 8 },

    { type: 'paragraph', text: 'Subtotal:     ₹5,05,000', fontSize: 10, align: 'right', spaceAfter: 4 },
    { type: 'paragraph', text: 'GST @ 18%:    ₹90,900', fontSize: 10, color: '#555555', align: 'right', spaceAfter: 8 },
    { type: 'paragraph', text: 'TOTAL DUE:    ₹5,95,900', fontSize: 14, fontWeight: 700, color: '#1a1a2e', align: 'right', spaceAfter: 20 },

    { type: 'heading', level: 3, text: 'Payment Details', color: '#333333', spaceAfter: 6 },
    { type: 'paragraph', text: 'Bank: HDFC Bank\nAccount: 5020 1234 5678\nIFSC: HDFC0001234\nUPI: payments@antigravity.in\nPAN: AABCA1234Z', fontSize: 10, color: '#444444', spaceAfter: 8 },

    { type: 'heading', level: 4, text: 'Accepted Payment Methods', color: '#555555', spaceAfter: 4 },
    {
      type: 'list',
      style: 'unordered',
      items: [
        { text: 'NEFT / RTGS to bank account above' },
        { text: 'UPI: payments@antigravity.in' },
        { text: 'Cheque payable to Antigravity Systems Pvt. Ltd.' },
      ],
      fontSize: 10,
      spaceAfter: 20,
    },

    { type: 'hr', color: '#e8e8e8', spaceAbove: 0, spaceBelow: 8 },

    { type: 'heading', level: 4, text: 'Terms & Conditions', color: '#555555', spaceAfter: 4 },
    { type: 'paragraph', text: 'Payment is due within 30 days of invoice date. Late payments are subject to 1.5% monthly interest. All disputes must be raised within 7 days of invoice receipt. This invoice is generated by pretext-pdf Phase 2.', fontSize: 9, color: '#888888' },
  ],
}))

console.log('\n✅ All diagnostic PDFs generated in test/output/')
console.log('   Open each PDF and visually verify before signing off on Phase 2:\n')
console.log('   - diagnostic-table.pdf   → borders aligned, header repeats on page 2, text not overlapping borders')
console.log('   - diagnostic-list.pdf    → ordered numbers right-align, body text indents consistently')
console.log('   - diagnostic-hr.pdf      → lines span full width, spacing correct at each variant')
console.log('   - diagnostic-invoice-v2.pdf → looks like a real invoice, all elements composing correctly')
