import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { render } from '../dist/index.js'
import type { PdfDocument } from '../dist/index.js'

/**
 * Extracts each page's text in visual reading order (top-to-bottom,
 * left-to-right). pdfjs's raw `getTextContent()` item order follows content
 * *draw* order, which does not reliably match reading order (dot leaders and
 * page numbers can be drawn out of visual sequence) — sorting by the item's
 * transform (x, y) position is required to get a string that reads the way
 * the page actually looks.
 */
async function extractPageTexts(pdfBytes: Uint8Array): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes })
  const pdfDoc = await loadingTask.promise
  const pages: string[] = []
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i)
    const content = await page.getTextContent()
    const items = (content.items as Array<{ str: string; transform: number[] }>)
      .filter((it) => typeof it.str === 'string')
      .sort((a, b) => {
        const dy = b.transform[5]! - a.transform[5]! // higher y (top of page) first
        if (Math.abs(dy) > 2) return dy
        return a.transform[4]! - b.transform[4]! // then left to right
      })
    pages.push(items.map((it) => it.str).join(' '))
  }
  return pages
}

/**
 * Isolates the TOC's own rendered section from the rest of a page's text —
 * needed because a short test document can put real heading occurrences and
 * the TOC listing on the SAME page, and a plain substring check can't tell
 * "this heading rendered normally elsewhere on the page" apart from "this
 * heading has its own TOC entry." Returns the text from `tocTitle` onward.
 */
function isolateTocSection(pageText: string, tocTitle: string): string {
  const idx = pageText.indexOf(tocTitle)
  return idx === -1 ? '' : pageText.slice(idx)
}

/**
 * Extracts the page number a TOC entry displays for `title`, by matching the
 * title followed only by dot-leader characters and whitespace, then the
 * first digit run — exactly the shape of a rendered "Title ..... N" line.
 * Returns null if the title isn't found or isn't followed by a page number
 * in that shape.
 */
function tocEntryPageNumber(pageText: string, title: string): number | null {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = pageText.match(new RegExp(`${escaped}[.\\s]*(\\d+)`))
  return m ? Number(m[1]) : null
}

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
        { type: 'toc', title: 'Table of Contents', minLevel: 1, maxLevel: 2 },
      ],
    }
    const pdf = await render(doc)
    const pages = await extractPageTexts(pdf)
    const tocPage = pages.find((p) => p.includes('Table of Contents'))
    assert.ok(tocPage, 'TOC title must appear on some page')
    for (const title of ['Getting Started', 'Installation', 'Configuration']) {
      const pageNum = tocEntryPageNumber(tocPage!, title)
      assert.ok(pageNum !== null, `TOC must list a page number for "${title}", got: ${JSON.stringify(tocPage)}`)
    }
  })

  // ─── Group B: Page Number Accuracy ────────────────────────────────────
  await t.test('B1: TOC page numbers are accurate (heading on page N shows N)', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'toc', title: 'Table of Contents' },
        ...Array.from({ length: 25 }, (_, i) => ({
          type: 'paragraph' as const,
          text: `Filler paragraph number ${i + 1} with enough padding text to consume real vertical space on the page and force a page break.`,
        })),
        { type: 'heading', level: 1, text: 'Chapter on Page 2' },
        { type: 'paragraph', text: 'Content.' },
      ],
    }
    const pdf = await render(doc)
    const pages = await extractPageTexts(pdf)
    assert.ok(pages.length >= 2, `fixture must actually span 2+ pages to test this — got ${pages.length}`)
    // Sanity: confirm the heading itself really lands on page 2, independent of the TOC.
    const actualHeadingPage = pages.findIndex((p, i) => i > 0 && p.includes('Chapter on Page 2')) + 1
    assert.equal(actualHeadingPage, 2, `test fixture assumption broken — heading landed on page ${actualHeadingPage}, not 2`)
    const shownPageNumber = tocEntryPageNumber(pages[0]!, 'Chapter on Page 2')
    assert.equal(shownPageNumber, 2, `TOC must show page 2 for the heading; got ${shownPageNumber} from: ${JSON.stringify(pages[0])}`)
  })

  await t.test('B2: TOC heading has correct offset when TOC occupies multiple pages', async () => {
    // Document with 35 headings will cause TOC to span multiple pages.
    // Each heading reference should account for the TOC page offset.
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
    const pages = await extractPageTexts(pdf)
    // TOC pages contain dot-leader runs ("...."); real-heading-only pages
    // never do. This is a more reliable fingerprint than trying to locate an
    // exact page boundary, since the TOC's last page and the first
    // real-content page can share a single physical page in a short fixture.
    const tocPages = pages.filter((p) => p.includes('....'))
    const contentOnlyPages = pages.filter((p) => !p.includes('....'))
    assert.ok(tocPages.length >= 2, `fixture must actually force a multi-page TOC — got ${tocPages.length} TOC page(s)`)
    const tocText = tocPages.join(' ')

    // Verify page numbers are internally consistent: sample headings spread
    // across the list and confirm their shown page numbers are
    // non-decreasing (heading N+1 must not be shown as being on an earlier
    // page than heading N) and that the LAST heading's shown page number
    // matches where it actually renders. A hardcoded/un-offset page number
    // would fail either check. (tocEntryPageNumber requires only dots/
    // whitespace between the title and the digits, so it can't accidentally
    // match across a later, unrelated heading's own real-text occurrence —
    // real heading text starts with a letter, breaking the pattern.)
    const sampleIndices = [1, 10, 20, 35]
    const shownPages = sampleIndices.map((n) => tocEntryPageNumber(tocText, `Heading ${n}`))
    for (const [i, n] of sampleIndices.entries()) {
      assert.ok(shownPages[i] !== null, `TOC must show a page number for "Heading ${n}"`)
    }
    for (let i = 1; i < shownPages.length; i++) {
      assert.ok(shownPages[i]! >= shownPages[i - 1]!, `page numbers must be non-decreasing: Heading ${sampleIndices[i]} shows page ${shownPages[i]}, Heading ${sampleIndices[i - 1]} shows page ${shownPages[i - 1]}`)
    }
    const actualLastHeadingPageAmongContentOnly = contentOnlyPages.findIndex((p) => p.includes('Heading 35'))
    assert.ok(actualLastHeadingPageAmongContentOnly !== -1, 'Heading 35 must actually render somewhere as real content')
    const actualLastHeadingPage = pages.indexOf(contentOnlyPages[actualLastHeadingPageAmongContentOnly]!) + 1
    assert.equal(shownPages[shownPages.length - 1], actualLastHeadingPage, `TOC-shown page for "Heading 35" (${shownPages[shownPages.length - 1]}) must match where it actually renders (page ${actualLastHeadingPage})`)
  })

  // ─── Group C: Level Filtering ──────────────────────────────────────────
  await t.test('C1: maxLevel: 2 excludes h3/h4 headings from TOC', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'heading', level: 1, text: 'Chapter' },
        { type: 'heading', level: 2, text: 'Section' },
        { type: 'heading', level: 3, text: 'Subsection Excluded' },
        { type: 'heading', level: 4, text: 'SubSubsection Excluded' },
        { type: 'paragraph', text: 'Content.' },
        { type: 'toc', title: 'Table of Contents', maxLevel: 2 },
      ],
    }
    const pdf = await render(doc)
    const pages = await extractPageTexts(pdf)
    const tocPage = pages.find((p) => p.includes('Table of Contents'))
    assert.ok(tocPage, 'TOC must render')
    const tocSection = isolateTocSection(tocPage!, 'Table of Contents')
    assert.ok(tocEntryPageNumber(tocSection, 'Chapter') !== null, 'h1 must be listed in the TOC')
    assert.ok(tocEntryPageNumber(tocSection, 'Section') !== null, 'h2 must be listed in the TOC')
    assert.ok(!tocSection.includes('Subsection Excluded'), `h3 must be excluded from maxLevel:2 TOC; got: ${JSON.stringify(tocSection)}`)
    assert.ok(!tocSection.includes('SubSubsection Excluded'), 'h4 must be excluded from maxLevel:2 TOC')
  })

  await t.test('C2: minLevel: 2 excludes h1 headings from TOC', async () => {
    const doc: PdfDocument = {
      content: [
        { type: 'heading', level: 1, text: 'TopLevelExcluded' },
        { type: 'heading', level: 2, text: 'SecondLevelIncluded' },
        { type: 'heading', level: 3, text: 'ThirdLevelIncluded' },
        { type: 'paragraph', text: 'Content.' },
        { type: 'toc', title: 'Table of Contents', minLevel: 2, maxLevel: 3 },
      ],
    }
    const pdf = await render(doc)
    const pages = await extractPageTexts(pdf)
    const tocPage = pages.find((p) => p.includes('Table of Contents'))
    assert.ok(tocPage, 'TOC must render')
    const tocSection = isolateTocSection(tocPage!, 'Table of Contents')
    assert.ok(!tocSection.includes('TopLevelExcluded'), `h1 must be excluded from minLevel:2 TOC; got: ${JSON.stringify(tocSection)}`)
    assert.ok(tocEntryPageNumber(tocSection, 'SecondLevelIncluded') !== null, 'h2 must be listed in the TOC')
    assert.ok(tocEntryPageNumber(tocSection, 'ThirdLevelIncluded') !== null, 'h3 must be listed in the TOC')
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
    const pages = await extractPageTexts(pdf)
    assert.ok(pages.some((p) => p.includes('My Custom TOC Title')), `custom title must appear in rendered output; pages: ${JSON.stringify(pages)}`)
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
    const pages = await extractPageTexts(pdf)
    assert.ok(!pages.some((p) => p.includes('This Should Not Appear')), `title must be hidden when showTitle: false; pages: ${JSON.stringify(pages)}`)
    // The TOC entries themselves must still render — only the title line is suppressed.
    const tocLikePage = pages.find((p) => tocEntryPageNumber(p, 'Chapter 1') !== null)
    assert.ok(tocLikePage, 'TOC entries must still render without a title line')
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
    const pages = await extractPageTexts(pdf)
    const combinedText = pages.join(' ')
    const missing: string[] = []
    for (let n = 1; n <= 40; n++) {
      if (tocEntryPageNumber(combinedText, `Chapter ${n}`) === null) missing.push(`Chapter ${n}`)
    }
    assert.deepEqual(missing, [], `all 40 headings must have a TOC entry with a page number; missing: ${missing.join(', ')}`)
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
