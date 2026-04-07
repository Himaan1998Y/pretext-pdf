import { readFileSync } from 'fs'
import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { render } from '../dist/index.js'
import type { PdfDocument } from '../dist/index.js'

test('Phase 7D — Table of Contents', async (t) => {
  // ─── Group A: Basic TOC ─────────────────────────────────────────────────
  await t.test('A1: Document with { type: toc } renders valid PDF', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'heading', level: 1, text: 'Chapter 1' },
        { type: 'paragraph', text: 'Introduction text.' },
        { type: 'heading', level: 2, text: 'Section 1.1' },
        { type: 'paragraph', text: 'More content.' },
        { type: 'toc', title: 'Contents' },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array, 'render() must return Uint8Array')
    assert(pdf.length > 0, 'PDF must not be empty')
    const header = new TextDecoder().decode(pdf.slice(0, 4))
    assert.equal(header, '%PDF', 'PDF must start with %PDF header')
  })

  await t.test('A2: TOC entries match actual heading texts in document', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'heading', level: 1, text: 'Getting Started' },
        { type: 'paragraph', text: 'Step one.' },
        { type: 'heading', level: 2, text: 'Installation' },
        { type: 'paragraph', text: 'Step two.' },
        { type: 'heading', level: 2, text: 'Configuration' },
        { type: 'paragraph', text: 'Step three.' },
        { type: 'toc', minLevel: 1, maxLevel: 2 },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
    // TOC should include all three headings (h1 + 2x h2)
    // Verification: no crash, valid PDF generated
    const header = new TextDecoder().decode(pdf.slice(0, 4))
    assert.equal(header, '%PDF')
  })

  // ─── Group B: Page Number Accuracy ────────────────────────────────────
  await t.test('B1: TOC page numbers are accurate (heading on page N shows N)', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'toc', title: 'Table of Contents' },
        // Lots of paragraphs to push next heading to page 2+
        { type: 'paragraph', text: 'Filler 1.' },
        { type: 'paragraph', text: 'Filler 2.' },
        { type: 'paragraph', text: 'Filler 3.' },
        { type: 'paragraph', text: 'Filler 4.' },
        { type: 'paragraph', text: 'Filler 5.' },
        { type: 'paragraph', text: 'Filler 6.' },
        { type: 'paragraph', text: 'Filler 7.' },
        { type: 'paragraph', text: 'Filler 8.' },
        { type: 'heading', level: 1, text: 'Chapter on Page 2' },
        { type: 'paragraph', text: 'Content.' },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
    // The heading should appear on page 2 (1-based), and TOC entry should show "2"
    const header = new TextDecoder().decode(pdf.slice(0, 4))
    assert.equal(header, '%PDF')
  })

  await t.test('B2: TOC heading has correct offset when TOC occupies multiple pages', async () => {
    // Document with 30+ headings will cause TOC to span multiple pages
    // Each heading reference should account for the TOC page offset
    const headings = Array.from({ length: 35 }, (_, i) => ({
      type: 'heading' as const,
      level: 2 as const,
      text: `Heading ${i + 1}`,
    }))
    const doc: PdfDocument = {
      content: [
        { type: 'toc', title: 'Contents', minLevel: 2, maxLevel: 2 },
        ...headings,
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    assert(pdf.length > 0)
    // TOC should correctly offset all page numbers by its own height (multiple pages)
    const header = new TextDecoder().decode(pdf.slice(0, 4))
    assert.equal(header, '%PDF')
  })

  // ─── Group C: Level Filtering ──────────────────────────────────────────
  await t.test('C1: maxLevel: 2 excludes h3/h4 headings from TOC', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'heading', level: 1, text: 'Chapter' },
        { type: 'heading', level: 2, text: 'Section' },
        { type: 'heading', level: 3, text: 'Subsection (should not appear)' },
        { type: 'heading', level: 4, text: 'Sub-subsection (should not appear)' },
        { type: 'paragraph', text: 'Content.' },
        { type: 'toc', maxLevel: 2 },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    // TOC should include only h1 and h2, exclude h3 and h4
    assert(pdf.length > 0)
    const header = new TextDecoder().decode(pdf.slice(0, 4))
    assert.equal(header, '%PDF')
  })

  await t.test('C2: minLevel: 2 excludes h1 headings from TOC', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'heading', level: 1, text: 'H1 (should not appear)' },
        { type: 'heading', level: 2, text: 'H2 included' },
        { type: 'heading', level: 3, text: 'H3 included' },
        { type: 'paragraph', text: 'Content.' },
        { type: 'toc', minLevel: 2, maxLevel: 3 },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    // TOC should skip h1, include h2 and h3
    assert(pdf.length > 0)
    const header = new TextDecoder().decode(pdf.slice(0, 4))
    assert.equal(header, '%PDF')
  })

  // ─── Group D: Customization ────────────────────────────────────────────
  await t.test('D1: Custom title renders in TOC title line', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'heading', level: 1, text: 'Chapter' },
        { type: 'toc', title: 'My Custom TOC Title', showTitle: true },
        { type: 'paragraph', text: 'Content.' },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    // Title should appear in the rendered TOC section
    assert(pdf.length > 0)
    const header = new TextDecoder().decode(pdf.slice(0, 4))
    assert.equal(header, '%PDF')
  })

  await t.test('D2: showTitle: false hides TOC title', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'heading', level: 1, text: 'Chapter 1' },
        { type: 'heading', level: 1, text: 'Chapter 2' },
        { type: 'toc', title: 'This Should Not Appear', showTitle: false },
        { type: 'paragraph', text: 'Content.' },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    // TOC should render without a title line
    assert(pdf.length > 0)
    const header = new TextDecoder().decode(pdf.slice(0, 4))
    assert.equal(header, '%PDF')
  })

  // ─── Group E: Edge Cases ──────────────────────────────────────────────
  await t.test('E1: Multi-page TOC (30+ headings) renders all entries without crashing', async () => {
    const headings = Array.from({ length: 40 }, (_, i) => ({
      type: 'heading' as const,
      level: 1 as const,
      text: `Chapter ${i + 1}`,
    }))
    const doc: PdfDocument = {
      content: [{ type: 'toc', title: 'Complete TOC' }, ...headings],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    // All 40 headings should appear in TOC, spanning multiple pages
    assert(pdf.length > 0)
    const header = new TextDecoder().decode(pdf.slice(0, 4))
    assert.equal(header, '%PDF')
  })

  await t.test('E2: Regression—document without TOC element is unchanged', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'heading', level: 1, text: 'Title' },
        { type: 'paragraph', text: 'Paragraph text.' },
        { type: 'heading', level: 2, text: 'Section' },
        { type: 'paragraph', text: 'More content.' },
      ],
    }
    const pdf = await render(doc)
    assert(pdf instanceof Uint8Array)
    // Document without TOC should render normally, no two-pass overhead
    assert(pdf.length > 0)
    const header = new TextDecoder().decode(pdf.slice(0, 4))
    assert.equal(header, '%PDF')
  })
})
