/**
 * End-to-end tests for the full render() pipeline.
 * Run: node --test --experimental-strip-types test/e2e.test.ts
 */
import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputDir = path.join(__dirname, 'output')

// Import from compiled dist
const { render, PretextPdfError } = await import('../dist/index.js')

before(() => {
  fs.mkdirSync(outputDir, { recursive: true })
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPdfBytes(bytes: Uint8Array): boolean {
  // All PDFs start with %PDF-
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
}

function writeOutput(filename: string, bytes: Uint8Array): void {
  fs.writeFileSync(path.join(outputDir, filename), bytes)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('e2e — basic rendering', () => {
  test('minimal document renders valid PDF bytes', async () => {
    const pdf = await render({
      content: [
        { type: 'paragraph', text: 'Hello World' },
      ],
    })

    assert.ok(pdf instanceof Uint8Array, 'Should return Uint8Array')
    assert.ok(pdf.byteLength > 1000, `PDF too small (${pdf.byteLength} bytes) — likely corrupt`)
    assert.ok(isPdfBytes(pdf), 'Output should start with %PDF-')
    writeOutput('e2e-minimal.pdf', pdf)
  })

  test('document with heading and paragraph renders', async () => {
    const pdf = await render({
      content: [
        { type: 'heading', level: 1, text: 'Invoice #1234' },
        { type: 'paragraph', text: 'Thank you for your business. This invoice covers services rendered in March 2026.' },
        { type: 'spacer', height: 24 },
        { type: 'heading', level: 2, text: 'Services' },
        { type: 'paragraph', text: 'AI Consulting: ₹1,00,000\nDevelopment: ₹2,00,000\nTotal: ₹3,00,000' },
      ],
    })

    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-invoice-basic.pdf', pdf)
  })

  test('document with all heading levels renders', async () => {
    const pdf = await render({
      content: [
        { type: 'heading', level: 1, text: 'Heading Level 1' },
        { type: 'paragraph', text: 'Body text after h1.' },
        { type: 'heading', level: 2, text: 'Heading Level 2' },
        { type: 'paragraph', text: 'Body text after h2.' },
        { type: 'heading', level: 3, text: 'Heading Level 3' },
        { type: 'paragraph', text: 'Body text after h3.' },
        { type: 'heading', level: 4, text: 'Heading Level 4' },
        { type: 'paragraph', text: 'Body text after h4.' },
      ],
    })

    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-headings.pdf', pdf)
  })
})

describe('e2e — pagination', () => {
  test('multi-page document renders correctly', async () => {
    // Generate enough content to force 3+ pages
    const loremIpsum = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.'

    const content = []
    for (let i = 1; i <= 12; i++) {
      content.push({ type: 'heading' as const, level: 2 as const, text: `Section ${i}` })
      content.push({ type: 'paragraph' as const, text: loremIpsum })
      content.push({ type: 'paragraph' as const, text: loremIpsum })
    }

    const pdf = await render({ content })

    assert.ok(isPdfBytes(pdf))
    // Multi-page PDFs are larger
    assert.ok(pdf.byteLength > 5_000, `Expected large PDF for multi-page doc, got ${pdf.byteLength} bytes`)
    writeOutput('e2e-multipage.pdf', pdf)
  })

  test('document with header and footer on every page', async () => {
    const loremIpsum = 'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.'

    const content = []
    for (let i = 1; i <= 8; i++) {
      content.push({ type: 'heading' as const, level: 2 as const, text: `Chapter ${i}` })
      content.push({ type: 'paragraph' as const, text: loremIpsum })
      content.push({ type: 'paragraph' as const, text: loremIpsum })
    }

    const pdf = await render({
      header: { text: 'Confidential Document · pretext-pdf Demo', align: 'center' },
      footer: { text: 'Page {{pageNumber}} of {{totalPages}}', align: 'center' },
      content,
    })

    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-header-footer.pdf', pdf)
  })
})

describe('e2e — page sizes', () => {
  test('Letter page size', async () => {
    const pdf = await render({
      pageSize: 'Letter',
      content: [{ type: 'paragraph', text: 'Letter size document.' }],
    })
    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-letter.pdf', pdf)
  })

  test('custom page size', async () => {
    const pdf = await render({
      pageSize: [400, 600],
      content: [{ type: 'paragraph', text: 'Custom size: 400×600 pt.' }],
    })
    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-custom-size.pdf', pdf)
  })
})

describe('e2e — text options', () => {
  test('colored text renders', async () => {
    const pdf = await render({
      content: [
        { type: 'paragraph', text: 'Black text (default).', color: '#000000' },
        { type: 'paragraph', text: 'Dark blue text.', color: '#1a1a2e' },
        { type: 'paragraph', text: 'Gray text.', color: '#888888' },
        { type: 'paragraph', text: 'Bold text.', fontWeight: 700 },
      ],
    })
    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-colors.pdf', pdf)
  })

  test('text alignment renders', async () => {
    const pdf = await render({
      content: [
        { type: 'paragraph', text: 'Left aligned text (default).', align: 'left' },
        { type: 'paragraph', text: 'Center aligned text.', align: 'center' },
        { type: 'paragraph', text: 'Right aligned text.', align: 'right' },
      ],
    })
    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-alignment.pdf', pdf)
  })

  test('long paragraph wraps correctly', async () => {
    const longText = 'This is a very long paragraph that should wrap across multiple lines. '.repeat(20)
    const pdf = await render({
      content: [{ type: 'paragraph', text: longText }],
    })
    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-long-paragraph.pdf', pdf)
  })
})

describe('e2e — validation errors', () => {
  test('throws VALIDATION_ERROR for empty content', async () => {
    await assert.rejects(
      () => render({ content: [] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  test('throws VALIDATION_ERROR for invalid heading level', async () => {
    await assert.rejects(
      () => render({ content: [{ type: 'heading', level: 5 as never, text: 'Bad' }] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  test('accepts Arabic RTL text (now supported)', async () => {
    const result = await render({ content: [{ type: 'paragraph', text: 'السلام عليكم' }] })
    assert.ok(result instanceof Uint8Array)
    assert.ok(result.length > 0, 'PDF should have content')
  })

  test('throws VALIDATION_ERROR for invalid hex color', async () => {
    await assert.rejects(
      () => render({ content: [{ type: 'paragraph', text: 'Test', color: 'red' }] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  test('throws VALIDATION_ERROR for impossible margins (content width <= 0)', async () => {
    // A4 = 595pt wide. left=300 + right=300 = 600 > 595 → content width < 0
    await assert.rejects(
      () => render({
        pageSize: 'A4',
        margins: { top: 72, bottom: 72, left: 300, right: 300 },
        content: [{ type: 'paragraph', text: 'Test' }],
      }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.ok(['PAGE_TOO_SMALL', 'VALIDATION_ERROR'].includes((err as PretextPdfError).code))
        return true
      }
    )
  })
})

// ─── Phase 2: Tables ──────────────────────────────────────────────────────────

describe('e2e — tables', () => {
  test('simple 3-column table renders', async () => {
    const pdf = await render({
      content: [
        { type: 'heading', level: 2, text: 'Invoice Items', spaceAfter: 8 },
        {
          type: 'table',
          columns: [
            { width: '*', align: 'left' },
            { width: 60, align: 'right' },
            { width: 80, align: 'right' },
          ],
          rows: [
            { isHeader: true, cells: [{ text: 'Description', fontWeight: 700 }, { text: 'Qty', fontWeight: 700 }, { text: 'Amount', fontWeight: 700 }] },
            { cells: [{ text: 'AI Strategy Consulting' }, { text: '15 hrs' }, { text: '₹1,20,000' }] },
            { cells: [{ text: 'Custom LLM Integration' }, { text: '20 hrs' }, { text: '₹2,00,000' }] },
            { cells: [{ text: 'Market Analysis Report' }, { text: 'Fixed' }, { text: '₹75,000' }] },
          ],
          spaceAfter: 12,
        },
      ],
    })

    assert.ok(isPdfBytes(pdf), 'Should return valid PDF bytes')
    assert.ok(pdf.byteLength > 5000, `PDF too small: ${pdf.byteLength} bytes`)
    writeOutput('e2e-table-simple.pdf', pdf)
  })

  test('table with proportional and fixed columns', async () => {
    const pdf = await render({
      content: [
        {
          type: 'table',
          columns: [
            { width: '3*' },  // takes 3/4 of remaining space
            { width: '1*' },  // takes 1/4 of remaining space
          ],
          rows: [
            { isHeader: true, cells: [{ text: 'Description', fontWeight: 700 }, { text: 'Total', fontWeight: 700 }] },
            { cells: [{ text: 'Professional Services rendered in Q1 2026' }, { text: '₹5,05,000' }] },
            { cells: [{ text: 'GST @ 18%' }, { text: '₹90,900' }] },
            { cells: [{ text: 'Grand Total', fontWeight: 700 }, { text: '₹5,95,900', fontWeight: 700 }] },
          ],
        },
      ],
    })

    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-table-proportional.pdf', pdf)
  })

  test('table that spans multiple pages with header repetition', async () => {
    // Build a table with 40 rows to force pagination
    const rows: { cells: { text: string }[] }[] = [
      { cells: [{ text: 'Item' }, { text: 'Date' }, { text: 'Amount' }] },
    ]
    for (let i = 1; i <= 40; i++) {
      rows.push({ cells: [{ text: `Service Item ${i}` }, { text: `2026-0${(i % 9) + 1}-01` }, { text: `₹${i * 1000}` }] })
    }

    const pdf = await render({
      content: [
        {
          type: 'table',
          columns: [{ width: '*' }, { width: 80 }, { width: 80 }],
          rows: [
            { isHeader: true, cells: [{ text: 'Description', fontWeight: 700 }, { text: 'Date', fontWeight: 700 }, { text: 'Amount', fontWeight: 700 }] },
            ...Array.from({ length: 40 }, (_, i) => ({
              cells: [
                { text: `Service Item ${i + 1}` },
                { text: `2026-0${(i % 9) + 1}-01` },
                { text: `₹${(i + 1) * 1000}` },
              ],
            })),
          ],
        },
      ],
    })

    assert.ok(isPdfBytes(pdf))
    assert.ok(pdf.byteLength > 10_000, 'Multi-page table should produce larger PDF')
    writeOutput('e2e-table-multipage.pdf', pdf)
  })

  test('table validation: throws COLSPAN_OVERFLOW when column count mismatches row cell count', async () => {
    // With colspan support, a row with fewer cells than columns throws COLSPAN_OVERFLOW
    // (colspan sum < column count) rather than VALIDATION_ERROR
    await assert.rejects(
      () => render({
        content: [{
          type: 'table',
          columns: [{ width: '*' }, { width: 80 }],
          rows: [
            { cells: [{ text: 'Only one cell' }] }, // 2 columns but 1 cell (colspan sum = 1 < 2)
          ],
        }],
      }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'COLSPAN_OVERFLOW')
        return true
      }
    )
  })

  test('table validation: throws when fixed columns exceed content width', async () => {
    await assert.rejects(
      () => render({
        content: [{
          type: 'table',
          columns: [{ width: 400 }, { width: 400 }], // 800pt > A4 content width (~451pt)
          rows: [{ cells: [{ text: 'A' }, { text: 'B' }] }],
        }],
      }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'TABLE_COLUMN_OVERFLOW')
        return true
      }
    )
  })

  // ─── Colspan (Phase 5B.3) ──────────────────────────────────────────────────
  test('table with colspan renders valid PDF', async () => {
    const pdf = await render({
      content: [{
        type: 'table',
        columns: [{ width: '*' }, { width: '*' }, { width: '*' }],
        rows: [
          { isHeader: true, cells: [{ text: 'Product', fontWeight: 700 }, { text: 'Q1', fontWeight: 700 }, { text: 'Q2', fontWeight: 700 }] },
          { cells: [{ text: 'Widget A', colspan: 1 }, { text: '100', colspan: 1 }, { text: '120', colspan: 1 }] },
          { cells: [{ text: 'Total Units', colspan: 2 }, { text: '220', colspan: 1 }] },
        ],
      }],
    })
    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-table-colspan.pdf', pdf)
  })

  test('table with complex colspan pattern renders', async () => {
    const pdf = await render({
      content: [{
        type: 'table',
        columns: [{ width: '*' }, { width: '*' }, { width: '*' }, { width: '*' }],
        rows: [
          { isHeader: true, cells: [{ text: 'Name', fontWeight: 700, colspan: 2 }, { text: 'Scores', fontWeight: 700, colspan: 2 }] },
          { cells: [{ text: 'First', fontWeight: 700 }, { text: 'Last', fontWeight: 700 }, { text: 'Math', fontWeight: 700 }, { text: 'Science', fontWeight: 700 }] },
          { cells: [{ text: 'John' }, { text: 'Doe' }, { text: '85' }, { text: '90' }] },
          { cells: [{ text: 'Jane Smith', colspan: 2 }, { text: '92' }, { text: '88' }] },
        ],
      }],
    })
    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-table-complex-colspan.pdf', pdf)
  })
})

// ─── Phase 2: Lists ───────────────────────────────────────────────────────────

describe('e2e — lists', () => {
  test('unordered list renders', async () => {
    const pdf = await render({
      content: [
        { type: 'heading', level: 3, text: 'Payment Methods', spaceAfter: 6 },
        {
          type: 'list',
          style: 'unordered',
          items: [
            { text: 'Bank Transfer (HDFC Bank, IFSC: HDFC0001234)' },
            { text: 'UPI: payments@antigravity.in' },
            { text: 'Cheque payable to Antigravity Systems Pvt. Ltd.' },
          ],
          spaceAfter: 12,
        },
      ],
    })

    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-list-unordered.pdf', pdf)
  })

  test('ordered list renders', async () => {
    const pdf = await render({
      content: [
        { type: 'heading', level: 3, text: 'Steps to Complete Payment', spaceAfter: 6 },
        {
          type: 'list',
          style: 'ordered',
          items: [
            { text: 'Log in to your net banking portal or UPI app.' },
            { text: 'Use the account details provided in the Payment Details section above.' },
            { text: 'Enter the invoice number (INV-2026-0042) in the remarks field.' },
            { text: 'Send payment confirmation to accounts@antigravity.in.' },
            { text: 'Expect acknowledgement within 1 business day.' },
          ],
          spaceAfter: 12,
        },
      ],
    })

    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-list-ordered.pdf', pdf)
  })

  test('list with nested items renders', async () => {
    const pdf = await render({
      content: [
        {
          type: 'list',
          style: 'unordered',
          items: [
            {
              text: 'AI Services',
              items: [
                { text: 'Strategy consulting' },
                { text: 'LLM integration' },
              ],
            },
            {
              text: 'Research & Reports',
              items: [
                { text: 'Market analysis' },
                { text: 'Competitive intelligence' },
              ],
            },
            { text: 'Automation Pipelines' },
          ],
        },
      ],
    })

    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-list-nested.pdf', pdf)
  })

  test('list validation: throws for empty items', async () => {
    await assert.rejects(
      () => render({
        content: [{ type: 'list', style: 'unordered', items: [] }],
      }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  test('list validation: throws for 2-level deep nesting', async () => {
    await assert.rejects(
      () => render({
        content: [{
          type: 'list',
          style: 'unordered',
          items: [{
            text: 'Parent',
            items: [{
              text: 'Child',
              items: [{ text: 'Grandchild — not allowed' }],
            }],
          }],
        }],
      }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })
})

// ─── Phase 2: Horizontal Rules ────────────────────────────────────────────────

describe('e2e — horizontal rules', () => {
  test('horizontal rule renders', async () => {
    const pdf = await render({
      content: [
        { type: 'paragraph', text: 'Content above the rule.' },
        { type: 'hr' },
        { type: 'paragraph', text: 'Content below the rule.' },
      ],
    })

    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-hr-basic.pdf', pdf)
  })

  test('styled horizontal rules render', async () => {
    const pdf = await render({
      content: [
        { type: 'paragraph', text: 'Section 1' },
        { type: 'hr', thickness: 0.5, color: '#cccccc', spaceAbove: 8, spaceBelow: 8 },
        { type: 'paragraph', text: 'Section 2' },
        { type: 'hr', thickness: 2, color: '#1a1a2e', spaceAbove: 16, spaceBelow: 16 },
        { type: 'paragraph', text: 'Section 3' },
        { type: 'hr', thickness: 0.25, color: '#888888', spaceAbove: 4, spaceBelow: 4 },
        { type: 'paragraph', text: 'Section 4' },
      ],
    })

    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-hr-styled.pdf', pdf)
  })
})

// ─── Phase 2: Combined document ───────────────────────────────────────────────

describe('e2e — Phase 2 combined', () => {
  test('full invoice with all Phase 2 elements renders', async () => {
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
        { type: 'heading', level: 1, text: 'INVOICE', color: '#1a1a2e', spaceAfter: 4 },
        { type: 'paragraph', text: 'Invoice #INV-2026-0042\nDate: March 31, 2026\nDue: April 30, 2026', fontSize: 10, color: '#666666', spaceAfter: 16 },

        { type: 'heading', level: 3, text: 'From', color: '#333333', spaceAfter: 4 },
        { type: 'paragraph', text: 'Antigravity Systems Pvt. Ltd.\n123 Innovation Park, Sector 18\nGurgaon, Haryana 122015', fontSize: 10, color: '#444444', spaceAfter: 12 },

        { type: 'heading', level: 3, text: 'Bill To', color: '#333333', spaceAfter: 4 },
        { type: 'paragraph', text: 'Acme Technologies Ltd.\nAttn: Accounts Payable\n456 Business Hub, DLF Phase 3\nGurgaon, Haryana 122002', fontSize: 10, color: '#444444', spaceAfter: 16 },

        { type: 'heading', level: 3, text: 'Services Rendered', color: '#1a1a2e', spaceAfter: 8 },

        // Table for line items
        {
          type: 'table',
          columns: [
            { width: '3*', align: 'left' },
            { width: 80, align: 'right' },
            { width: 90, align: 'right' },
          ],
          rows: [
            {
              isHeader: true,
              cells: [
                { text: 'Description', fontWeight: 700 },
                { text: 'Hours/Type', fontWeight: 700 },
                { text: 'Amount', fontWeight: 700 },
              ],
            },
            { cells: [{ text: 'AI Strategy Consulting' }, { text: '15 hrs' }, { text: '₹1,20,000' }] },
            { cells: [{ text: 'Custom LLM Integration & Deployment' }, { text: '20 hrs' }, { text: '₹2,00,000' }] },
            { cells: [{ text: 'Real Estate Market Analysis Report (Q1 2026)' }, { text: 'Fixed' }, { text: '₹75,000' }] },
            { cells: [{ text: 'Automation Pipeline Setup (n8n + Supabase)' }, { text: 'Fixed' }, { text: '₹60,000' }] },
            { cells: [{ text: 'Monthly Retainer — March 2026' }, { text: 'Fixed' }, { text: '₹50,000' }] },
          ],
          cellPaddingH: 8,
          cellPaddingV: 6,
          spaceAfter: 16,
        },

        { type: 'hr', color: '#cccccc', thickness: 0.5, spaceAbove: 4, spaceBelow: 12 },

        { type: 'paragraph', text: 'Subtotal:     ₹5,05,000', fontSize: 10, spaceAfter: 4 },
        { type: 'paragraph', text: 'GST @ 18%:    ₹90,900', fontSize: 10, color: '#555555', spaceAfter: 8 },
        { type: 'paragraph', text: 'TOTAL DUE:    ₹5,95,900', fontSize: 14, fontWeight: 700, color: '#1a1a2e', spaceAfter: 20 },

        { type: 'heading', level: 3, text: 'Payment Details', color: '#333333', spaceAfter: 6 },
        { type: 'paragraph', text: 'Bank: HDFC Bank\nAccount: 5020 1234 5678\nIFSC: HDFC0001234', fontSize: 10, color: '#444444', spaceAfter: 8 },

        { type: 'heading', level: 4, text: 'Accepted Payment Methods', color: '#555555', spaceAfter: 4 },
        {
          type: 'list',
          style: 'unordered',
          items: [
            { text: 'NEFT/RTGS to bank account above' },
            { text: 'UPI: payments@antigravity.in' },
            { text: 'Cheque payable to Antigravity Systems Pvt. Ltd.' },
          ],
          fontSize: 10,
          spaceAfter: 16,
        },

        { type: 'hr', color: '#e0e0e0', spaceAbove: 8, spaceBelow: 8 },

        { type: 'paragraph', text: 'Payment is due within 30 days of invoice date. Late payments are subject to 1.5% monthly interest. All disputes must be raised within 7 days of invoice receipt.', fontSize: 9, color: '#888888' },
      ],
    })

    assert.ok(isPdfBytes(pdf), 'Full invoice should be valid PDF')
    assert.ok(pdf.byteLength > 10_000, `Invoice PDF seems too small: ${pdf.byteLength} bytes`)
    writeOutput('e2e-invoice-v2.pdf', pdf)
  })
})

// ─── Phase 3: Code Blocks ─────────────────────────────────────────────────────

describe('e2e — code blocks', () => {
  test('code block with bundled font renders valid PDF', async () => {
    // Uses Inter (bundled) as fontFamily — not monospace visually, but valid for pipeline test
    const pdf = await render({
      content: [
        { type: 'heading', level: 2, text: 'Code Example', spaceAfter: 8 },
        {
          type: 'code',
          fontFamily: 'Inter',
          text: 'function hello() {\n  console.log("Hello, World!")\n  return 42\n}',
          spaceAfter: 12,
        },
        { type: 'paragraph', text: 'The function above returns 42.' },
      ],
    })
    assert.ok(isPdfBytes(pdf))
    assert.ok(pdf.byteLength > 3000)
    writeOutput('e2e-p3-code.pdf', pdf)
  })

  test('code block validation: throws MONOSPACE_FONT_REQUIRED without fontFamily', async () => {
    await assert.rejects(
      // @ts-expect-error intentionally omitting required fontFamily
      () => render({ content: [{ type: 'code', text: 'hello()' }] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'MONOSPACE_FONT_REQUIRED')
        return true
      }
    )
  })

  test('code block validation: throws MONOSPACE_FONT_REQUIRED for unknown fontFamily', async () => {
    await assert.rejects(
      () => render({ content: [{ type: 'code', text: 'hello()', fontFamily: 'UnknownMonoFont' }] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'MONOSPACE_FONT_REQUIRED')
        return true
      }
    )
  })

  test('code block with styled options renders', async () => {
    const pdf = await render({
      content: [
        {
          type: 'code',
          fontFamily: 'Inter',
          text: 'const x = 1\nconst y = 2\nconst z = x + y',
          bgColor: '#f0f4f8',
          color: '#1a1a2e',
          padding: 12,
          fontSize: 10,
          spaceAfter: 8,
        },
      ],
    })
    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-p3-code-styled.pdf', pdf)
  })
})

// ─── Phase 3: Rich Text ───────────────────────────────────────────────────────

describe('e2e — rich text (rich-paragraph)', () => {
  test('rich-paragraph with bold and colored spans renders', async () => {
    const pdf = await render({
      content: [
        {
          type: 'rich-paragraph',
          spans: [
            { text: 'This invoice is ' },
            { text: 'OVERDUE', fontWeight: 700, color: '#cc0000' },
            { text: '. Please remit payment of ' },
            { text: '₹5,95,900', fontWeight: 700 },
            { text: ' immediately.' },
          ],
          spaceAfter: 12,
        },
        {
          type: 'rich-paragraph',
          spans: [
            { text: 'Regular text, ' },
            { text: 'bold text', fontWeight: 700 },
            { text: ', and colored text.', color: '#555555' },
          ],
        },
      ],
    })
    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-p3-rich-text.pdf', pdf)
  })

  test('rich-paragraph with Inter italic renders without error (bundled via @fontsource/inter)', async () => {
    // Inter italic is now bundled — should render successfully
    const pdf = await render({
      content: [{
        type: 'rich-paragraph',
        spans: [
          { text: 'Normal and ' },
          { text: 'italic', fontStyle: 'italic' },
        ],
      }],
    })
    assert.ok(pdf instanceof Uint8Array && pdf.length > 0)
  })

  test('rich-paragraph multi-line wrapping renders correctly', async () => {
    const longSpanText = 'This is a very long sentence that should wrap across multiple lines when rendered in the PDF. '
    const pdf = await render({
      content: [
        {
          type: 'rich-paragraph',
          spans: [
            { text: longSpanText },
            { text: 'Bold portion at the end. ', fontWeight: 700 },
            { text: longSpanText },
          ],
          spaceAfter: 12,
        },
      ],
    })
    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-p3-rich-text-wrap.pdf', pdf)
  })

  test('rich-paragraph validation: throws for empty spans array', async () => {
    await assert.rejects(
      () => render({ content: [{ type: 'rich-paragraph', spans: [] }] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })

  test('rich-paragraph validation: accepts Arabic RTL span (now supported)', async () => {
    const result = await render({ content: [{ type: 'rich-paragraph', spans: [{ text: 'مرحبا' }] }] })
    assert.ok(result instanceof Uint8Array)
    assert.ok(result.length > 0, 'PDF should have content')
  })

  test('rich-paragraph validation: throws for invalid color in span', async () => {
    await assert.rejects(
      () => render({ content: [{ type: 'rich-paragraph', spans: [{ text: 'hi', color: 'red' }] }] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        return true
      }
    )
  })
})

// ─── Phase 3: Page Break ──────────────────────────────────────────────────────

describe('e2e — page break', () => {
  test('page-break between content forces new page', async () => {
    const pdf = await render({
      content: [
        { type: 'paragraph', text: 'Page 1 content.' },
        { type: 'page-break' },
        { type: 'paragraph', text: 'Page 2 content.' },
        { type: 'page-break' },
        { type: 'paragraph', text: 'Page 3 content.' },
      ],
    })
    assert.ok(isPdfBytes(pdf))
    // 3 separate pages → PDF should be noticeably larger than single-page
    assert.ok(pdf.byteLength > 5000, `Expected multi-page PDF, got ${pdf.byteLength} bytes`)
    writeOutput('e2e-p3-page-break.pdf', pdf)
  })

  test('page-break at end of document does not create trailing blank page', async () => {
    const pdfWithTrailingBreak = await render({
      content: [
        { type: 'paragraph', text: 'Only page.' },
        { type: 'page-break' },
      ],
    })
    const pdfWithout = await render({
      content: [
        { type: 'paragraph', text: 'Only page.' },
      ],
    })
    // Both should be single-page — trailing page-break is trimmed
    assert.ok(isPdfBytes(pdfWithTrailingBreak))
    // The PDF with trailing break should not be significantly larger (no blank page)
    const sizeDiff = Math.abs(pdfWithTrailingBreak.byteLength - pdfWithout.byteLength)
    assert.ok(sizeDiff < 500, `Trailing page-break created extra content: size diff = ${sizeDiff} bytes`)
    writeOutput('e2e-p3-page-break-trailing.pdf', pdfWithTrailingBreak)
  })

  test('consecutive page-breaks do not create multiple blank pages', async () => {
    const pdf = await render({
      content: [
        { type: 'paragraph', text: 'Page 1.' },
        { type: 'page-break' },
        { type: 'page-break' }, // second break at top of page — no-op
        { type: 'paragraph', text: 'Page 2.' },
      ],
    })
    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-p3-page-break-consecutive.pdf', pdf)
  })
})

// ─── Phase 3: Document Metadata ───────────────────────────────────────────────

describe('e2e — document metadata', () => {
  test('document with full metadata renders valid PDF', async () => {
    const pdf = await render({
      metadata: {
        title: 'Q1 2026 Invoice',
        author: 'Himanshu Jain',
        subject: 'Professional Services Invoice',
        keywords: ['invoice', 'professional services', 'Q1 2026'],
        creator: 'pretext-pdf e2e test',
      },
      content: [
        { type: 'heading', level: 1, text: 'Q1 2026 Invoice' },
        { type: 'paragraph', text: 'Document metadata is embedded in the PDF.' },
      ],
    })
    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-p3-metadata.pdf', pdf)
  })

  test('document with partial metadata renders valid PDF', async () => {
    const pdf = await render({
      metadata: { title: 'Partial Metadata Test' },
      content: [{ type: 'paragraph', text: 'Only title metadata.' }],
    })
    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-p3-metadata-partial.pdf', pdf)
  })
})

// ─── Phase 3: Auto-Width Columns ─────────────────────────────────────────────

describe('e2e — auto-width table columns', () => {
  test('table with auto-width column renders valid PDF', async () => {
    const pdf = await render({
      content: [{
        type: 'table',
        columns: [
          { width: 'auto', align: 'center' }, // narrow — fits "INV", "PO", "RECEIPT"
          { width: '*', align: 'left' },       // takes remaining space
        ],
        rows: [
          { isHeader: true, cells: [{ text: 'Type', fontWeight: 700 }, { text: 'Description', fontWeight: 700 }] },
          { cells: [{ text: 'INV' }, { text: 'Standard invoice for professional services rendered' }] },
          { cells: [{ text: 'PO' }, { text: 'Purchase order confirmation and acceptance' }] },
          { cells: [{ text: 'RECEIPT' }, { text: 'Payment receipt and acknowledgement' }] },
        ],
        spaceAfter: 12,
      }],
    })
    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-p3-auto-width.pdf', pdf)
  })

  test('table with mixed fixed, star, and auto columns renders', async () => {
    const pdf = await render({
      content: [{
        type: 'table',
        columns: [
          { width: 60, align: 'center' },    // fixed
          { width: 'auto', align: 'left' },  // auto
          { width: '2*', align: 'right' },   // proportional
          { width: '*', align: 'right' },    // proportional
        ],
        rows: [
          {
            isHeader: true,
            cells: [
              { text: '#', fontWeight: 700 },
              { text: 'Item', fontWeight: 700 },
              { text: 'Rate', fontWeight: 700 },
              { text: 'Amount', fontWeight: 700 },
            ],
          },
          { cells: [{ text: '1' }, { text: 'Consulting' }, { text: '₹8,000/hr' }, { text: '₹1,20,000' }] },
          { cells: [{ text: '2' }, { text: 'Development' }, { text: '₹10,000/hr' }, { text: '₹2,00,000' }] },
        ],
      }],
    })
    assert.ok(isPdfBytes(pdf))
    writeOutput('e2e-p3-auto-width-mixed.pdf', pdf)
  })

  test('document with unreachable image URL skips gracefully (no crash)', async () => {
    // Capture warnings to verify the image load failure is logged
    const originalWarn = console.warn
    const warnings: string[] = []
    console.warn = (...args: any[]) => warnings.push(args.join(' '))

    try {
      const pdf = await render({
        content: [
          { type: 'paragraph', text: 'Before image.' },
          { type: 'image', src: 'https://this-domain-does-not-exist-invalid.test/image.png', width: 100, height: 100 },
          { type: 'paragraph', text: 'After image — the document still renders even though the image failed to load.' },
        ],
      })

      assert.ok(isPdfBytes(pdf), 'PDF should still generate despite unreachable image')
      assert.ok(pdf.byteLength > 1000, 'PDF should have content')
      assert.ok(warnings.some(w => w.includes('[pretext-pdf]') && w.includes('Image')), 'Should log image load warning')
      writeOutput('e2e-image-unreachable.pdf', pdf)
    } finally {
      console.warn = originalWarn
    }
  })
})
