/**
 * Template: International Invoice
 *
 * Multi-currency invoice for USD/EUR/GBP transactions with optional discount/tax.
 * Features: company header, bill-to/from, line items with optional discount, tax calculation,
 * totals, payment terms, bank details.
 * Security: Encryption enabled to protect sensitive financial data.
 *
 * Usage: npx tsx templates/invoice-intl.ts
 *
 * Extended Example: To test with discount, change `const discount = 0` to `const discount = 500`
 * to see discount row appear in totals table. Useful for validating conditional layout logic.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { formatCurrency, createMetadata, createFooter, colors, typography } from './utils.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// TODO: Change currency to 'EUR' or 'GBP' as needed
const config = { currency: 'USD' as const }

// TODO: Replace with your company details
const company = {
  name: 'Digital Agency Inc.',
  address: '123 Tech Street, San Francisco, CA 94102',
  email: 'billing@digitalagency.com',
  phone: '+1 (415) 555-0100',
  website: 'www.digitalagency.com',
  taxId: 'US Tax ID: 12-3456789',
}

const client = {
  name: 'Acme Corporation',
  address: 'London Office, 456 Business Avenue, London, UK',
  contactName: 'Sarah Johnson',
  email: 'sarah@acmecorp.com',
}

const invoiceData = {
  number: 'INV-2026-1847',
  date: '15 April 2026',
  dueDate: '15 May 2026',
  reference: 'PO-2026-5432',
}

const items = [
  { description: 'Web Application Development — 80 hours', qty: 80, rate: 150 },
  { description: 'UI/UX Design — 24 hours', qty: 24, rate: 120 },
  { description: 'Project Management & QA', qty: 1, rate: 2000 },
]

const lineItems = items.map(item => ({
  ...item,
  total: item.qty * item.rate,
}))

const subtotal = lineItems.reduce((s, i) => s + i.total, 0)
const discount = 0
const taxRate = 0.08
const taxAmount = (subtotal - discount) * taxRate
const total = subtotal - discount + taxAmount

const { render } = await import('../dist/index.js')

const pdf = await render({
  pageSize: 'A4',
  margins: { top: 40, bottom: 50, left: 50, right: 50 },
  defaultFont: 'Inter',
  defaultFontSize: 11,
  // Security: Prevent copying of sensitive invoice data
  allowCopying: false,
  // Searchable PDF with proper metadata
  metadata: createMetadata(
    `Invoice ${invoiceData.number}`,
    company.name,
    `International invoice for ${client.name} - ${config.currency}`
  ),
  footer: createFooter('Invoice', company.name),
  content: [
    // Invoice title and company header
    {
      type: 'heading',
      level: 1,
      text: 'INVOICE',
      fontSize: typography.h1,
      color: colors.primary,
      spaceAfter: 2,
    },
    {
      type: 'paragraph',
      text: company.name,
      fontSize: 10,
      fontWeight: 700,
      color: colors.primary,
      spaceAfter: 8,
    },

    // Two-column: Company info | Invoice details
    {
      type: 'table',
      columns: [{ width: '1*' }, { width: '1*' }],
      rows: [
        {
          cells: [
            {
              text: `${company.address}\n${company.taxId}\n\n${company.email}\n${company.phone}\n${company.website}`,
              fontSize: 9,
              color: colors.gray700,
            },
            {
              text: `Invoice Number:  ${invoiceData.number}\nInvoice Date:  ${invoiceData.date}\nDue Date:  ${invoiceData.dueDate}\nPO Reference:  ${invoiceData.reference}`,
              fontSize: 10,
              color: colors.gray700,
            },
          ],
        },
      ],
      borderColor: colors.gray300,
      borderWidth: 0,
      cellPaddingH: 8,
      cellPaddingV: 8,
      spaceAfter: 16,
    },

    // Billing recipient details
    {
      type: 'heading',
      level: 4,
      text: 'BILL TO',
      fontSize: typography.h4,
      color: colors.gray500,
      letterSpacing: 2,
      smallCaps: true,
      spaceAfter: 4,
    },
    {
      type: 'paragraph',
      text: `${client.name}\n${client.address}\n\nContact: ${client.contactName}\n${client.email}`,
      fontSize: 10,
      color: colors.gray700,
      spaceAfter: 14,
    },

    // Line items
    {
      type: 'table',
      columns: [
        { width: '3*', align: 'left' },
        { width: 80, align: 'right' },
        { width: 70, align: 'right' },
        { width: 100, align: 'right' },
      ],
      rows: [
        {
          isHeader: true,
          cells: [
            { text: 'Description', fontWeight: 700, fontSize: 10 },
            { text: 'Qty', fontWeight: 700, fontSize: 10 },
            { text: 'Rate', fontWeight: 700, fontSize: 10 },
            { text: 'Amount', fontWeight: 700, fontSize: 10 },
          ],
        },
        ...lineItems.map(item => ({
          cells: [
            { text: item.description, fontSize: 10, color: colors.gray700 },
            { text: String(item.qty), fontSize: 10, align: 'right' },
            { text: formatCurrency(item.rate, config.currency), fontSize: 10, align: 'right' },
            { text: formatCurrency(item.total, config.currency), fontSize: 10, fontWeight: 700, align: 'right' },
          ],
        })),
      ],
      headerBgColor: colors.primary,
      borderColor: colors.gray300,
      borderWidth: 0.5,
      cellPaddingH: 8,
      cellPaddingV: 8,
      spaceAfter: 0,
    },

    // Totals
    {
      type: 'table',
      columns: [{ width: '3*' }, { width: 270, align: 'right' }],
      rows: [
        { cells: [{ text: 'Subtotal', fontSize: 10, color: colors.gray700 }, { text: formatCurrency(subtotal, config.currency), fontSize: 10 }] },
        ...(discount > 0 ? [{ cells: [{ text: 'Discount', fontSize: 10, color: colors.gray700 }, { text: formatCurrency(-discount, config.currency), fontSize: 10 }] }] : []),
        { cells: [{ text: `Tax @ ${(taxRate * 100).toFixed(0)}%`, fontSize: 10, color: colors.gray700 }, { text: formatCurrency(taxAmount, config.currency), fontSize: 10 }] },
        { cells: [{ text: 'TOTAL DUE', fontSize: 12, fontWeight: 700, color: colors.primary }, { text: formatCurrency(total, config.currency), fontSize: 12, fontWeight: 700, color: colors.primary }] },
      ],
      borderColor: colors.gray300,
      borderWidth: 0.5,
      cellPaddingH: 10,
      cellPaddingV: 8,
      spaceAfter: 20,
    },

    // Payment terms and conditions
    {
      type: 'heading',
      level: 4,
      text: 'Payment Terms',
      fontSize: typography.h4,
      color: colors.gray500,
      letterSpacing: 2,
      smallCaps: true,
      spaceAfter: 4,
    },
    {
      type: 'paragraph',
      text: 'Payment is due within 30 days of invoice date. Please include the invoice number in your payment reference. Wire transfer to our bank account or ACH preferred. Late payments may incur interest charges of 1.5% per month.',
      fontSize: 9,
      color: colors.gray600,
      spaceAfter: 12,
    },

    // Bank details for payment
    {
      type: 'paragraph',
      text: `Bank Details: ABC Bank, San Francisco | Account: 123456789 | Routing: 021000021 | Swift: ABCDUS33`,
      fontSize: typography.small,
      color: colors.gray500,
    },
  ],
})

const outPath = path.join(__dirname, 'output', 'invoice-intl.pdf')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, pdf)

console.log(`✓ International Invoice PDF: ${outPath} (${(pdf.byteLength / 1024).toFixed(1)} KB)`)
console.log(`  Invoice: ${invoiceData.number} | Total: ${formatCurrency(total, config.currency)}`)
