import { test } from 'node:test'
import assert from 'node:assert'
import { render } from '../dist/index.js'
import type { PdfDocument } from '../dist/types.js'

test('Phase 7 — Feature Integration Tests', async (t) => {
  // ─────────────────────────────────────────────────────────────────────────
  // Integration Test 1: TOC + Bookmarks
  // Verify that TOC and Bookmarks can coexist and both render correctly
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('Integration: TOC and Bookmarks both render together', async () => {
    const doc: PdfDocument = {
      bookmarks: true,  // Enable PDF bookmarks/outlines
      content: [
        { type: 'heading', level: 1, text: 'Chapter 1' },
        { type: 'paragraph', text: 'Introduction content here.' },
        { type: 'heading', level: 2, text: 'Section 1.1' },
        { type: 'paragraph', text: 'More content.' },
        { type: 'heading', level: 2, text: 'Section 1.2' },
        { type: 'paragraph', text: 'Even more content.' },
        { type: 'toc', title: 'Table of Contents', minLevel: 1, maxLevel: 2 },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array, 'render() must return Uint8Array')
    assert(pdf.length > 0, 'PDF must not be empty')
    const header = new TextDecoder().decode(pdf.slice(0, 4))
    assert.equal(header, '%PDF', 'PDF must have valid header')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Integration Test 2: Watermark + Encryption
  // Verify that watermark and encryption can both be applied to same document
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('Integration: Watermark and Encryption both applied', async () => {
    const doc: PdfDocument = {
      watermark: {
        text: 'CONFIDENTIAL',
        opacity: 0.3,
        rotation: 45,
        color: '#FF0000',
      },
      encryption: {
        userPassword: 'open123',
        ownerPassword: 'admin456',
        permissions: {
          printing: false,
          modifying: false,
          copying: false,
        },
      },
      content: [
        { type: 'heading', level: 1, text: 'Secret Document' },
        { type: 'paragraph', text: 'This document is encrypted and watermarked.' },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
    const header = new TextDecoder().decode(pdf.slice(0, 4))
    assert.equal(header, '%PDF')
    // Verify /Encrypt marker exists in PDF
    const pdfText = new TextDecoder().decode(pdf)
    assert(pdfText.includes('/Encrypt'), 'PDF should contain /Encrypt marker')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Integration Test 3: SVG + RTL Text
  // Verify that SVG elements render correctly alongside RTL text on same page
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('Integration: SVG and RTL text on same page', async () => {
    const doc: PdfDocument = {
      content: [
        {
          type: 'svg',
          svg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="blue"/></svg>',
          width: 100,
          height: 100,
          align: 'center',
        },
        { type: 'paragraph', text: 'A diagram above.' },
        { type: 'paragraph', text: 'שלום עולם - RTL text should appear below', dir: 'rtl' },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
    const header = new TextDecoder().decode(pdf.slice(0, 4))
    assert.equal(header, '%PDF')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Integration Test 4: Hyphenation + RTL
  // Verify that hyphenation rules are applied correctly to both LTR and RTL text
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('Integration: Hyphenation with mixed LTR and RTL text', async () => {
    const doc: PdfDocument = {
      pageSize: 'A4',
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      hyphenation: { language: 'en-us' },
      content: [
        {
          type: 'paragraph',
          text: 'This is a very long English sentence with many words that should be hyphenated across multiple lines when the column width is narrow enough.',
        },
        {
          type: 'paragraph',
          text: 'טקסט עברי עם מילים ארוכות מאוד שצריכות להיות מעוטפות בצורה נכונה בעמודה צרה.',
          dir: 'rtl',
        },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
    const header = new TextDecoder().decode(pdf.slice(0, 4))
    assert.equal(header, '%PDF')
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Integration Test 5: Complex Feature Combination
  // All Phase 7 features enabled simultaneously
  // ─────────────────────────────────────────────────────────────────────────
  await t.test('Integration: All Phase 7 features enabled simultaneously', async () => {
    const doc: PdfDocument = {
      watermark: {
        text: 'DRAFT',
        opacity: 0.15,
        rotation: 45,
      },
      encryption: {
        userPassword: 'password123',
      },
      bookmarks: { minLevel: 1, maxLevel: 3 },
      hyphenation: { language: 'en-us' },
      content: [
        { type: 'heading', level: 1, text: 'Main Report' },
        {
          type: 'svg',
          svg: '<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="green"/></svg>',
          width: 100,
          height: 100,
        },
        {
          type: 'paragraph',
          text: 'This document demonstrates simultaneous use of watermarks, encryption, bookmarks, and hyphenation.',
        },
        { type: 'heading', level: 2, text: 'Details' },
        { type: 'paragraph', text: 'Hebrew section: שלום', dir: 'rtl' },
        { type: 'toc', title: 'Contents' },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array, 'render() must return Uint8Array')
    assert(pdf.length > 0, 'PDF must not be empty')
    const header = new TextDecoder().decode(pdf.slice(0, 4))
    assert.equal(header, '%PDF', 'PDF must have valid header')
  })
})
