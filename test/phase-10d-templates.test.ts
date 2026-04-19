import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../dist/index.js'
import { createInvoice, createGstInvoice, createReport } from '../dist/templates.js'

test('Phase 10D — Templates', async (t) => {

  // ── createInvoice ──────────────────────────────────────────────────────────

  await t.test('invoice: generates content elements', () => {
    const content = createInvoice({
      from: { name: 'Acme Corp', address: '123 Main St', email: 'billing@acme.com' },
      to: { name: 'Client Ltd', address: '456 Oak Ave' },
      invoiceNumber: 'INV-2026-001',
      date: '2026-04-19',
      items: [
        { description: 'Consulting — April 2026', quantity: 10, unitPrice: 150 },
        { description: 'Design work', quantity: 5, unitPrice: 200 },
      ],
      currency: '$',
      taxRate: 10,
      taxLabel: 'GST',
    })
    assert.ok(Array.isArray(content))
    assert.ok(content.length > 0)
    const heading = content.find(e => e.type === 'heading') as any
    assert.equal(heading?.text, 'INVOICE')
    const table = content.find(e => e.type === 'table') as any
    assert.ok(table, 'should have a table element')
  })

  await t.test('invoice: renders as valid PDF', async () => {
    const content = createInvoice({
      from: { name: 'Acme Corp', address: '123 Main St, Mumbai' },
      to: { name: 'BigCo Ltd', address: '789 Business Park' },
      invoiceNumber: 'INV-042',
      date: '2026-04-19',
      dueDate: '2026-05-19',
      items: [
        { description: 'Software License — Annual', quantity: 3, unitPrice: 1200 },
        { description: 'Support & Maintenance', quantity: 1, unitPrice: 500 },
      ],
      currency: '$',
      taxRate: 18,
      notes: 'Payment due within 30 days.',
    })
    const pdf = await render({ content })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(Buffer.from(pdf.slice(0, 4)).toString('ascii'), '%PDF')
    assert.ok(pdf.byteLength > 1000)
  })

  await t.test('invoice: includes QR code when qrData provided', () => {
    const content = createInvoice({
      from: { name: 'Acme' },
      to: { name: 'Client' },
      invoiceNumber: 'INV-001',
      date: '2026-04-19',
      items: [{ description: 'Service', quantity: 1, unitPrice: 100 }],
      qrData: 'upi://pay?pa=acme@paytm&pn=Acme&am=100',
    })
    const qr = content.find(e => e.type === 'qr-code') as any
    assert.ok(qr, 'should have qr-code element when qrData is provided')
    assert.ok(qr.data.startsWith('upi://'))
  })

  await t.test('invoice: no QR code when qrData omitted', () => {
    const content = createInvoice({
      from: { name: 'Acme' },
      to: { name: 'Client' },
      invoiceNumber: 'INV-002',
      date: '2026-04-19',
      items: [{ description: 'Widget', quantity: 2, unitPrice: 50 }],
    })
    const qr = content.find(e => e.type === 'qr-code')
    assert.equal(qr, undefined)
  })

  // ── createGstInvoice ───────────────────────────────────────────────────────

  await t.test('gst invoice: renders as valid PDF', async () => {
    const content = createGstInvoice({
      supplier: {
        name: 'Antigravity Systems Pvt. Ltd.',
        address: 'Plot 42, Sector 18, Gurugram, Haryana 122015',
        gstin: '06AAACA1234A1ZV',
        state: 'Haryana',
        email: 'billing@antigravity.dev',
      },
      buyer: {
        name: 'TechStartup Solutions',
        address: 'Office 7, Bandra Kurla Complex, Mumbai 400051',
        gstin: '27AABCB5678B1ZP',
        state: 'Maharashtra',
      },
      invoiceNumber: 'INV/2026-27/001',
      invoiceDate: '19 Apr 2026',
      placeOfSupply: 'Maharashtra (27)',
      items: [
        { description: 'Software Development Services', hsnSac: '998314', quantity: 80, unit: 'Hrs', rate: 3000, taxRate: 18 },
        { description: 'Cloud Infrastructure Setup', hsnSac: '998316', quantity: 1, unit: 'Job', rate: 25000, taxRate: 18 },
      ],
      isInterState: true,
      bankName: 'HDFC Bank',
      accountNumber: '50100123456789',
      ifscCode: 'HDFC0001234',
      declaration: 'Certified that the particulars given above are true and correct.',
      qrUpiData: 'upi://pay?pa=antigravity@hdfc&pn=Antigravity+Systems&am=320650',
    })
    const pdf = await render({ content })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(Buffer.from(pdf.slice(0, 4)).toString('ascii'), '%PDF')
    assert.ok(pdf.byteLength > 2000)
  })

  await t.test('gst invoice: auto-detects inter-state from different supplier/buyer states', () => {
    const content = createGstInvoice({
      supplier: { name: 'S', address: 'a', gstin: 'G1', state: 'Haryana' },
      buyer: { name: 'B', address: 'b', gstin: 'G2', state: 'Maharashtra' },
      invoiceNumber: 'X1',
      invoiceDate: '2026-04-19',
      placeOfSupply: 'MH',
      items: [{ description: 'Service', hsnSac: '998314', quantity: 1, unit: 'Job', rate: 1000, taxRate: 18 }],
    })
    // IGST heading should appear (interState = true)
    const tables = content.filter(e => e.type === 'table') as any[]
    const itemTable = tables[1] // second table is the items table
    assert.ok(itemTable, 'should have item table')
    // Check IGST appears in header cell text
    const headerCells = itemTable.rows[0].cells as any[]
    const igstCell = headerCells.find((c: any) => c.text.includes('IGST'))
    assert.ok(igstCell, 'should have IGST column in inter-state invoice')
  })

  await t.test('gst invoice: intra-state shows CGST+SGST columns', () => {
    const content = createGstInvoice({
      supplier: { name: 'S', address: 'a', gstin: 'G1', state: 'Maharashtra' },
      buyer: { name: 'B', address: 'b', gstin: 'G2', state: 'Maharashtra' },
      invoiceNumber: 'X2',
      invoiceDate: '2026-04-19',
      placeOfSupply: 'MH',
      items: [{ description: 'Service', hsnSac: '998314', quantity: 1, unit: 'Job', rate: 1000, taxRate: 18 }],
    })
    const tables = content.filter(e => e.type === 'table') as any[]
    const itemTable = tables[1]
    const headerCells = itemTable.rows[0].cells as any[]
    const cgstCell = headerCells.find((c: any) => c.text.includes('CGST'))
    assert.ok(cgstCell, 'should have CGST column in intra-state invoice')
  })

  // ── createReport ───────────────────────────────────────────────────────────

  await t.test('report: generates expected structure', () => {
    const content = createReport({
      title: 'Annual Performance Report',
      subtitle: 'FY 2025–26',
      author: 'Finance Team',
      date: 'April 2026',
      sections: [
        { title: 'Executive Summary', paragraphs: ['Revenue grew 18% YoY.'], bullets: ['Cloud +32%', 'Enterprise +12%'] },
        { title: 'Methodology', level: 2, paragraphs: ['Data from internal systems.'] },
      ],
    })
    const headings = content.filter(e => e.type === 'heading') as any[]
    assert.ok(headings.length >= 3) // title + 2 section headings
    assert.equal(headings[0].text, 'Annual Performance Report')
    const list = content.find(e => e.type === 'list') as any
    assert.ok(list, 'should have a list for bullets')
    assert.equal(list.items.length, 2)
  })

  await t.test('gst invoice: amountInWords returns "Rupees Zero Only" for zero-value invoice', () => {
    const content = createGstInvoice({
      supplier: { name: 'S', address: 'a', gstin: 'G1', state: 'Haryana' },
      buyer: { name: 'B', address: 'b', gstin: 'G2', state: 'Haryana' },
      invoiceNumber: 'FREE-001',
      invoiceDate: '2026-04-19',
      placeOfSupply: 'HR',
      items: [{ description: 'Free sample', hsnSac: '998314', quantity: 1, unit: 'Nos', rate: 0, taxRate: 0 }],
    })
    const amtEl = content.find(e => e.type === 'paragraph' && (e as any).text?.includes('Amount in words')) as any
    assert.ok(amtEl, 'should have amount-in-words paragraph')
    assert.ok(amtEl.text.includes('Rupees Zero Only'), `expected "Rupees Zero Only" but got: "${amtEl.text}"`)
  })

  await t.test('report: renders as valid PDF', async () => {
    const content = createReport({
      title: 'Q1 2026 Sales Report',
      author: 'Sales Team',
      date: 'April 2026',
      abstract: 'Q1 showed strong growth across all segments. Key driver was the enterprise segment.',
      sections: [
        {
          title: 'Revenue Overview',
          paragraphs: ['Total revenue reached $4.2M in Q1 2026, representing an 18% increase.'],
          bullets: ['SaaS revenue: $2.8M', 'Services: $1.1M', 'Other: $0.3M'],
        },
        {
          title: 'Regional Breakdown',
          paragraphs: ['APAC led growth at 32%. Americas showed steady 12% growth.'],
        },
      ],
    })
    const pdf = await render({ content })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(Buffer.from(pdf.slice(0, 4)).toString('ascii'), '%PDF')
    assert.ok(pdf.byteLength > 1000)
  })

})
