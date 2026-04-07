/**
 * Example: Generate a realistic invoice PDF using Phase 2 features.
 * Run: node --experimental-strip-types examples/invoice.ts
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const { render } = await import('../dist/index.js')

const pdf = await render({
  pageSize: 'A4',
  margins: { top: 60, bottom: 60, left: 72, right: 72 },
  defaultFont: 'Inter',
  defaultFontSize: 11,
  footer: {
    text: 'Page {{pageNumber}} of {{totalPages}}  |  Confidential',
    fontSize: 9,
    align: 'center',
  },
  content: [
    // ── Header ────────────────────────────────────────────────────────────────
    {
      type: 'heading',
      level: 1,
      text: 'INVOICE',
      color: '#1a1a2e',
      spaceAfter: 4,
    },
    {
      type: 'paragraph',
      text: 'Invoice #INV-2026-0042\nDate: March 31, 2026\nDue: April 30, 2026',
      fontSize: 10,
      color: '#666666',
      spaceAfter: 16,
    },

    // ── From ──────────────────────────────────────────────────────────────────
    {
      type: 'heading',
      level: 3,
      text: 'From',
      color: '#333333',
      spaceAfter: 4,
    },
    {
      type: 'paragraph',
      text: 'Antigravity Systems Pvt. Ltd.\n123 Innovation Park, Sector 18\nGurgaon, Haryana 122015\nGSTIN: 06AABCA1234Z1ZK',
      fontSize: 10,
      color: '#444444',
      spaceAfter: 12,
    },

    // ── Bill To ───────────────────────────────────────────────────────────────
    {
      type: 'heading',
      level: 3,
      text: 'Bill To',
      color: '#333333',
      spaceAfter: 4,
    },
    {
      type: 'paragraph',
      text: 'Acme Technologies Ltd.\nAttn: Accounts Payable\n456 Business Hub, DLF Phase 3\nGurgaon, Haryana 122002\nGSTIN: 06AACCA5678B2ZM',
      fontSize: 10,
      color: '#444444',
      spaceAfter: 16,
    },

    // ── Line items table ──────────────────────────────────────────────────────
    {
      type: 'heading',
      level: 3,
      text: 'Services Rendered',
      color: '#1a1a2e',
      spaceAfter: 8,
    },
    {
      type: 'table',
      columns: [
        { width: '3*', align: 'left' },
        { width: 90, align: 'right' },
        { width: 90, align: 'right' },
      ],
      rows: [
        {
          isHeader: true,
          cells: [
            { text: 'Description', fontWeight: 700 },
            { text: 'Hours/Type', fontWeight: 700 },
            { text: 'Amount (₹)', fontWeight: 700 },
          ],
        },
        {
          cells: [
            { text: 'AI Strategy Consulting' },
            { text: '15 hrs @ ₹8,000' },
            { text: '1,20,000' },
          ],
        },
        {
          cells: [
            { text: 'Custom LLM Integration & Deployment' },
            { text: '20 hrs @ ₹10,000' },
            { text: '2,00,000' },
          ],
        },
        {
          cells: [
            { text: 'Real Estate Market Analysis Report (Haryana NCR, Q1 2026)' },
            { text: 'Fixed fee' },
            { text: '75,000' },
          ],
        },
        {
          cells: [
            { text: 'Automation Pipeline Setup (n8n + Supabase + VPS)' },
            { text: 'Fixed fee' },
            { text: '60,000' },
          ],
        },
        {
          cells: [
            { text: 'Monthly Retainer — March 2026' },
            { text: 'Fixed fee' },
            { text: '50,000' },
          ],
        },
      ],
      headerBgColor: '#f0f4ff',
      borderColor: '#dddddd',
      borderWidth: 0.5,
      cellPaddingH: 8,
      cellPaddingV: 6,
      spaceAfter: 8,
    },

    // ── Totals ────────────────────────────────────────────────────────────────
    {
      type: 'hr',
      color: '#dddddd',
      thickness: 0.5,
      spaceAbove: 4,
      spaceBelow: 8,
    },
    {
      type: 'paragraph',
      text: 'Subtotal:     ₹5,05,000',
      fontSize: 10,
      align: 'right',
      spaceAfter: 4,
    },
    {
      type: 'paragraph',
      text: 'GST @ 18%:    ₹90,900',
      fontSize: 10,
      color: '#555555',
      align: 'right',
      spaceAfter: 8,
    },
    {
      type: 'paragraph',
      text: 'TOTAL DUE:    ₹5,95,900',
      fontSize: 14,
      fontWeight: 700,
      color: '#1a1a2e',
      align: 'right',
      spaceAfter: 20,
    },

    // ── Payment details ───────────────────────────────────────────────────────
    {
      type: 'heading',
      level: 3,
      text: 'Payment Details',
      color: '#333333',
      spaceAfter: 6,
    },
    {
      type: 'paragraph',
      text: 'Bank: HDFC Bank\nAccount: 5020 1234 5678\nIFSC: HDFC0001234\nUPI: payments@antigravity.in\nPAN: AABCA1234Z',
      fontSize: 10,
      color: '#444444',
      spaceAfter: 8,
    },
    {
      type: 'heading',
      level: 4,
      text: 'Accepted Payment Methods',
      color: '#555555',
      spaceAfter: 4,
    },
    {
      type: 'list',
      style: 'unordered',
      items: [
        { text: 'NEFT / RTGS to the bank account above' },
        { text: 'UPI: payments@antigravity.in' },
        { text: 'Cheque payable to Antigravity Systems Pvt. Ltd.' },
      ],
      fontSize: 10,
      spaceAfter: 20,
    },

    // ── Terms ─────────────────────────────────────────────────────────────────
    {
      type: 'hr',
      color: '#e8e8e8',
      spaceAbove: 0,
      spaceBelow: 8,
    },
    {
      type: 'heading',
      level: 4,
      text: 'Terms & Conditions',
      color: '#555555',
      spaceAfter: 4,
    },
    {
      type: 'paragraph',
      text: 'Payment is due within 30 days of invoice date. Late payments are subject to 1.5% monthly interest. All disputes must be raised within 7 days of invoice receipt. This invoice is generated by pretext-pdf.',
      fontSize: 9,
      color: '#888888',
    },
  ],
})

const outPath = path.join(__dirname, '..', 'test', 'output', 'invoice-v2.pdf')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, pdf)

console.log(`✅ Invoice PDF generated: ${outPath}`)
console.log(`   Size: ${(pdf.byteLength / 1024).toFixed(1)} KB`)
