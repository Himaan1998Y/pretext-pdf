/**
 * Example: Same invoice rendered with pdfmake for typography comparison.
 * This shows the differences in line breaking, kerning, and text quality
 * between pretext-pdf (professional typography) and pdfmake (basic).
 *
 * Run: npm install pdfmake && npx ts-node examples/comparison-pdfmake.ts
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pdfMake from 'pdfmake/build/pdfmake.js'
import pdfFonts from 'pdfmake/build/vfs_fonts.js'

pdfMake.vfs = pdfFonts.pdfMake.vfs

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Same invoice data structure as pretext-pdf version
const docDefinition = {
  pageSize: 'A4',
  pageMargins: [72, 60, 72, 60],
  content: [
    {
      text: 'INVOICE',
      fontSize: 24,
      bold: true,
      color: '#1a1a2e',
      margin: [0, 0, 0, 4],
    },
    {
      text: 'Invoice #INV-2026-0042\nDate: March 31, 2026\nDue: April 30, 2026',
      fontSize: 10,
      color: '#666666',
      margin: [0, 0, 0, 16],
    },

    // From section
    {
      text: 'From',
      fontSize: 14,
      bold: true,
      color: '#333333',
      margin: [0, 0, 0, 4],
    },
    {
      text: 'Antigravity Systems Pvt. Ltd.\n123 Innovation Park, Sector 18\nGurgaon, Haryana 122015\nGSTIN: 06AABCA1234Z1ZK',
      fontSize: 10,
      color: '#444444',
      margin: [0, 0, 0, 12],
    },

    // Bill To section
    {
      text: 'Bill To',
      fontSize: 14,
      bold: true,
      color: '#333333',
      margin: [0, 0, 0, 4],
    },
    {
      text: 'Acme Technologies Ltd.\nAttn: Accounts Payable\n456 Business Hub, DLF Phase 3\nGurgaon, Haryana 122002\nGSTIN: 06AACCA5678B2ZM',
      fontSize: 10,
      color: '#444444',
      margin: [0, 0, 0, 16],
    },

    // Services table
    {
      text: 'Services Rendered',
      fontSize: 14,
      bold: true,
      color: '#1a1a2e',
      margin: [0, 0, 0, 8],
    },
    {
      table: {
        headerRows: 1,
        widths: ['*', 100, 100],
        body: [
          [
            { text: 'Description', bold: true },
            { text: 'Hours/Type', bold: true, alignment: 'right' },
            { text: 'Amount (₹)', bold: true, alignment: 'right' },
          ],
          [
            'AI Strategy Consulting',
            { text: '15 hrs @ ₹8,000', alignment: 'right' },
            { text: '1,20,000', alignment: 'right' },
          ],
          [
            'Custom LLM Integration & Deployment',
            { text: '20 hrs @ ₹10,000', alignment: 'right' },
            { text: '2,00,000', alignment: 'right' },
          ],
          [
            'Real Estate Market Analysis Report (Haryana NCR, Q1 2026)',
            { text: 'Fixed fee', alignment: 'right' },
            { text: '75,000', alignment: 'right' },
          ],
          [
            'Automation Pipeline Setup (n8n + Supabase + VPS)',
            { text: 'Fixed fee', alignment: 'right' },
            { text: '60,000', alignment: 'right' },
          ],
          [
            'Monthly Retainer — March 2026',
            { text: 'Fixed fee', alignment: 'right' },
            { text: '50,000', alignment: 'right' },
          ],
        ],
      },
      margin: [0, 0, 0, 8],
    },

    // Totals section (simple text, not table)
    {
      text: 'Subtotal:     ₹5,05,000',
      fontSize: 10,
      alignment: 'right',
      margin: [0, 4, 0, 4],
    },
    {
      text: 'GST @ 18%:    ₹90,900',
      fontSize: 10,
      color: '#555555',
      alignment: 'right',
      margin: [0, 0, 0, 8],
    },
    {
      text: 'TOTAL DUE:    ₹5,95,900',
      fontSize: 14,
      bold: true,
      color: '#1a1a2e',
      alignment: 'right',
      margin: [0, 0, 0, 20],
    },

    // Payment details
    {
      text: 'Payment Details',
      fontSize: 14,
      bold: true,
      color: '#333333',
      margin: [0, 0, 0, 6],
    },
    {
      text: 'Bank: HDFC Bank\nAccount: 5020 1234 5678\nIFSC: HDFC0001234\nUPI: payments@antigravity.in\nPAN: AABCA1234Z',
      fontSize: 10,
      color: '#444444',
      margin: [0, 0, 0, 8],
    },

    // Payment methods
    {
      text: 'Accepted Payment Methods',
      fontSize: 11,
      bold: true,
      color: '#555555',
      margin: [0, 0, 0, 4],
    },
    {
      ul: [
        { text: 'NEFT / RTGS to the bank account above', fontSize: 10 },
        { text: 'UPI: payments@antigravity.in', fontSize: 10 },
        { text: 'Cheque payable to Antigravity Systems Pvt. Ltd.', fontSize: 10 },
      ],
      margin: [0, 0, 0, 20],
    },

    // Terms & Conditions
    {
      text: 'Terms & Conditions',
      fontSize: 11,
      bold: true,
      color: '#555555',
      margin: [0, 8, 0, 4],
    },
    {
      text: 'Payment is due within 30 days of invoice date. Late payments are subject to 1.5% monthly interest. All disputes must be raised within 7 days of invoice receipt. This invoice is generated with pdfmake.',
      fontSize: 9,
      color: '#888888',
    },
  ],
  footer: (currentPage: number, pageCount: number) => ({
    text: `Page ${currentPage} of ${pageCount}  |  Confidential`,
    alignment: 'center' as const,
    fontSize: 9,
  }),
}

const pdfDoc = pdfMake.createPdf(docDefinition)

const outPath = path.join(__dirname, '..', 'test', 'output', 'invoice-pdfmake-comparison.pdf')
fs.mkdirSync(path.dirname(outPath), { recursive: true })

pdfDoc.getBase64((base64) => {
  const buffer = Buffer.from(base64, 'base64')
  fs.writeFileSync(outPath, buffer)
  console.log(`✅ pdfmake Invoice PDF generated: ${outPath}`)
  console.log(`   Size: ${(buffer.byteLength / 1024).toFixed(1)} KB`)
  console.log('\n📊 Comparison tips:')
  console.log('   1. Line breaking: pretext-pdf uses optimal paragraph layout')
  console.log('   2. Kerning: pretext-pdf applies proper letter spacing')
  console.log('   3. Hyphenation: pretext-pdf hyphenates long words automatically')
  console.log('   4. Text quality: pretext-pdf produces sharper, more professional text')
})
