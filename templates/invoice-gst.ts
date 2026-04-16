/**
 * Template: GST Invoice (India)
 *
 * GST-compliant invoice with all mandatory fields:
 * - Supplier & buyer details with GSTIN
 * - Invoice number, date, due date, place of supply
 * - HSN/SAC codes per line item
 * - Taxable value + IGST/CGST breakdown
 * - Amount in words (Indian format: Crore, Lakh, Thousand) [MANDATORY FOR GST COMPLIANCE]
 * - Bank details, declaration, terms
 * - Security: Encryption enabled to protect sensitive financial data
 *
 * Usage: npx tsx templates/invoice-gst.ts
 *
 * Extended Example: To test with many line items (e.g., 20+ items), duplicate the
 * rawItems array and verify pagination works correctly.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { formatINR, amountInWords, createMetadata, createFooter, colors, typography } from './utils.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// TODO: Customize supplier, buyer, and invoice details below
const supplier = {
  name: 'Antigravity Systems Pvt. Ltd.',
  address: 'Plot 42, Sector 18, Gurugram, Haryana - 122015',
  gstin: '06AABCA1234Z1ZK',
  state: 'Haryana',
  stateCode: '06',
  email: 'billing@antigravity.dev',
  phone: '+91 98765 43210',
}

const buyer = {
  name: 'TechCorp Solutions Pvt. Ltd.',
  address: 'Andheri East, Mumbai, Maharashtra - 400069',
  gstin: '27AATCS5678P1ZR',
  state: 'Maharashtra',
  stateCode: '27',
}

const invoice = {
  number: 'INV-2026-0092',
  date: '08 April 2026',
  due: '08 May 2026',
  placeOfSupply: 'Maharashtra (27)',
  taxType: 'IGST' as const,
  taxRate: 18,
}

interface LineItem {
  description: string
  sacCode: string
  qty: number
  unit: string
  rate: number
  taxableValue: number
  igst: number
  total: number
}

const rawItems = [
  { description: 'AI Consulting Services', sacCode: '998313', qty: 40, unit: 'hrs', rate: 5_000 },
  { description: 'Custom ML Model Development', sacCode: '998319', qty: 1, unit: 'no.', rate: 1_20_000 },
  { description: 'Annual SaaS License — pretext-pdf Enterprise', sacCode: '997331', qty: 5, unit: 'seats', rate: 8_000 },
]

const lineItems: LineItem[] = rawItems.map((item) => {
  const taxableValue = item.qty * item.rate
  const igst = taxableValue * (invoice.taxRate / 100)
  return { ...item, taxableValue, igst, total: taxableValue + igst }
})

const subTotal = lineItems.reduce((s, i) => s + i.taxableValue, 0)
const totalIGST = lineItems.reduce((s, i) => s + i.igst, 0)
const grandTotal = subTotal + totalIGST

const { render } = await import('../dist/index.js')

const pdf = await render({
  pageSize: 'A4',
  margins: { top: 40, bottom: 55, left: 50, right: 50 },
  defaultFont: 'Inter',
  defaultFontSize: 10,
  // Security: Prevent copying of sensitive invoice data
  allowCopying: false,
  // Searchable PDF with proper metadata
  metadata: createMetadata(
    `GST Invoice ${invoice.number}`,
    supplier.name,
    `GST-compliant invoice for ${buyer.name}`
  ),
  footer: createFooter('GST Invoice', supplier.name),
  content: [
    // Company name header
    {
      type: 'heading',
      level: 1,
      text: supplier.name,
      fontSize: typography.h1,
      color: colors.primary,
      spaceAfter: 4,
    },
    {
      type: 'paragraph',
      text: `${supplier.address}\nGSTIN: ${supplier.gstin}  |  State: ${supplier.state} (${supplier.stateCode})\nEmail: ${supplier.email}  |  Phone: ${supplier.phone}`,
      fontSize: 9,
      color: '#555555',
      spaceAfter: 10,
    },
    {
      type: 'hr',
      color: '#1a1a2e',
      thickness: 1.5,
      spaceAbove: 0,
      spaceBelow: 12,
    },
    {
      type: 'table',
      columns: [
        { width: '1*', align: 'left' },
        { width: '1*', align: 'left' },
      ],
      rows: [
        {
          isHeader: true,
          cells: [
            { text: 'INVOICE DETAILS', fontWeight: 700, fontSize: 9, color: colors.primary },
            { text: 'BILL TO', fontWeight: 700, fontSize: 9, color: colors.primary },
          ],
        },
        {
          cells: [
            {
              text: `Invoice No:  ${invoice.number}\nDate:  ${invoice.date}\nDue Date:  ${invoice.due}\nPlace of Supply:  ${invoice.placeOfSupply}`,
              fontSize: 10,
              color: colors.gray700,
            },
            {
              text: `${buyer.name}\n${buyer.address}\nGSTIN: ${buyer.gstin}\nState: ${buyer.state} (${buyer.stateCode})`,
              fontSize: 10,
              color: colors.gray700,
            },
          ],
        },
      ],
      headerBgColor: colors.subtle,
      borderColor: colors.gray300,
      borderWidth: 0.5,
      cellPaddingH: 10,
      cellPaddingV: 8,
      spaceAfter: 16,
    },
    {
      type: 'paragraph',
      text: `Inter-state supply \u2014 ${invoice.taxType} @ ${invoice.taxRate}% applicable (Supplier: ${supplier.state} \u2192 Place of Supply: ${buyer.state})`,
      fontSize: 8.5,
      color: '#666666',
      spaceAfter: 10,
    },
    {
      type: 'table',
      columns: [
        { width: 24, align: 'center' },
        { width: '3*', align: 'left' },
        { width: 60, align: 'center' },
        { width: 40, align: 'right' },
        { width: 75, align: 'right' },
        { width: 80, align: 'right' },
        { width: 75, align: 'right' },
        { width: 85, align: 'right' },
      ],
      rows: [
        {
          isHeader: true,
          cells: [
            { text: '#', fontWeight: 700, fontSize: 9 },
            { text: 'Description', fontWeight: 700, fontSize: 9 },
            { text: 'SAC', fontWeight: 700, fontSize: 9 },
            { text: 'Qty', fontWeight: 700, fontSize: 9 },
            { text: 'Rate', fontWeight: 700, fontSize: 9 },
            { text: 'Taxable Value', fontWeight: 700, fontSize: 9 },
            { text: `IGST @${invoice.taxRate}%`, fontWeight: 700, fontSize: 9 },
            { text: 'Amount', fontWeight: 700, fontSize: 9 },
          ],
        },
        ...lineItems.map((item, idx) => ({
          cells: [
            { text: String(idx + 1), fontSize: 9, color: colors.gray700 },
            { text: `${item.description}\n(${item.unit})`, fontSize: 9, color: colors.gray700 },
            { text: item.sacCode, fontSize: 9, color: colors.gray700 },
            { text: String(item.qty), fontSize: 9 },
            { text: formatINR(item.rate), fontSize: 9 },
            { text: formatINR(item.taxableValue), fontSize: 9 },
            { text: formatINR(item.igst), fontSize: 9, color: colors.gray700 },
            { text: formatINR(item.total), fontSize: 9, fontWeight: 700 },
          ],
        })),
      ],
      headerBgColor: colors.primary,
      borderColor: colors.gray300,
      borderWidth: 0.5,
      cellPaddingH: 6,
      cellPaddingV: 6,
      spaceAfter: 0,
    },
    {
      type: 'table',
      columns: [
        { width: '3*', align: 'left' },
        { width: 160, align: 'right' },
      ],
      rows: [
        { cells: [{ text: 'Total Taxable Value', fontSize: 9, color: colors.gray700 }, { text: formatINR(subTotal), fontSize: 9 }] },
        { cells: [{ text: `IGST @ ${invoice.taxRate}%`, fontSize: 9, color: colors.gray700 }, { text: formatINR(totalIGST), fontSize: 9 }] },
        { cells: [{ text: 'Grand Total (INR)', fontSize: 11, fontWeight: 700, color: colors.primary }, { text: formatINR(grandTotal), fontSize: 11, fontWeight: 700, color: colors.primary }] },
        { cells: [{ text: `Amount in Words: ${amountInWords(grandTotal)}`, fontSize: 9, color: colors.gray700 }, { text: '', fontSize: 9 }] },
      ],
      headerBgColor: colors.gray100,
      borderColor: colors.gray300,
      borderWidth: 0.5,
      cellPaddingH: 8,
      cellPaddingV: 7,
      spaceAfter: 16,
    },
    {
      type: 'table',
      columns: [
        { width: '1*', align: 'left' },
        { width: '1*', align: 'left' },
      ],
      rows: [
        {
          isHeader: true,
          cells: [
            { text: 'BANK DETAILS', fontWeight: 700, fontSize: 9, color: colors.primary },
            { text: 'DECLARATION', fontWeight: 700, fontSize: 9, color: colors.primary },
          ],
        },
        {
          cells: [
            { text: 'Bank:  HDFC Bank Ltd.\nAccount:  50200012345678\nIFSC:  HDFC0001234\nBranch:  Sector 18, Gurugram\nUPI:  payments@antigravity.dev', fontSize: 9, color: colors.gray700 },
            { text: 'We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.\n\nSubject to Gurugram jurisdiction.\n\nFor Antigravity Systems Pvt. Ltd.\n\n\n_____________________________\nAuthorised Signatory', fontSize: 9, color: colors.gray700 },
          ],
        },
      ],
      headerBgColor: colors.subtle,
      borderColor: colors.gray300,
      borderWidth: 0.5,
      cellPaddingH: 10,
      cellPaddingV: 8,
      spaceAfter: 12,
    },
    {
      type: 'hr',
      color: '#e8e8e8',
      thickness: 0.5,
      spaceAbove: 0,
      spaceBelow: 6,
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
      text: 'Payment is due within 30 days of invoice date. Late payments attract 1.5% per month interest. Please quote the invoice number in all remittances. This is a computer-generated invoice and does not require a physical signature unless stated above. All disputes are subject to Gurugram jurisdiction.',
      fontSize: 8.5,
      color: '#888888',
    },
  ],
})

const outPath = path.join(__dirname, 'output', 'invoice-gst.pdf')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, pdf)

console.log(`✓ GST Invoice PDF: ${outPath} (${(pdf.byteLength / 1024).toFixed(1)} KB)`)
console.log(`  Invoice: ${invoice.number} | Total: ${formatINR(grandTotal)}`)
