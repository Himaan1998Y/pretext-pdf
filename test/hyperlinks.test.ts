/**
 * Phase 8G — Hyperlinks
 * Tests for paragraph.url, heading.url, anchor links, and href spans
 *
 * v2.2.4: rewritten to verify the actual /Annots + /URI annotation reaches
 * the output (previously every test here only asserted pdf.byteLength > 0,
 * which would still pass even if the link annotation were silently absent
 * or corrupted). This rewrite is what surfaced a real bug: addLinkAnnotation
 * (src/render-utils.ts) wrapped the raw URL string in PDFHexString.of()
 * without hex-encoding it first, so every rendered hyperlink resolved to
 * garbage bytes instead of the intended URL. Fixed alongside these tests.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { render } from '../dist/index.js'

/** Resolves each Link annotation's URI on a page via pdfjs-dist (ground truth for what a real viewer would follow). */
async function extractLinkUrls(pdfBytes: Uint8Array, pageNum = 1): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes })
  const pdfDoc = await loadingTask.promise
  const page = await pdfDoc.getPage(pageNum)
  const annots = (await page.getAnnotations()) as Array<{ subtype: string; unsafeUrl?: string }>
  return annots.filter(a => a.subtype === 'Link' && a.unsafeUrl !== undefined).map(a => a.unsafeUrl!)
}

test('Phase 8G — Hyperlinks', async (t) => {
  await t.test('paragraph.url produces a /Annots Link annotation resolving to the exact URL', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [
        {
          type: 'paragraph',
          text: 'Click me to visit Google',
          url: 'https://google.com',
        },
      ],
    })
    assert.ok(pdf)
    assert.ok(pdf.byteLength > 0)
    const text = Buffer.from(pdf).toString('latin1')
    assert.ok(text.includes('/Annots'), '/Annots array not found in PDF bytes')
    assert.ok(text.includes('/Subtype /Link'), '/Subtype /Link annotation not found')
    const urls = await extractLinkUrls(pdf)
    assert.deepStrictEqual(urls, ['https://google.com'], 'resolved link URL must exactly match the source URL')
  })

  await t.test('heading.url produces a /Annots Link annotation resolving to the exact URL', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [
        {
          type: 'heading',
          level: 1,
          text: 'Clickable Heading',
          url: 'https://example.com',
        },
      ],
    })
    assert.ok(pdf)
    assert.ok(pdf.byteLength > 0)
    const urls = await extractLinkUrls(pdf)
    assert.deepStrictEqual(urls, ['https://example.com'])
  })

  await t.test('heading.anchor registers without error (no destination is created — internal-anchor navigation is not yet wired up, see CHANGELOG)', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [
        {
          type: 'heading',
          level: 2,
          text: 'Section One',
          anchor: 'section-one',
        },
        {
          type: 'paragraph',
          text: 'Some content here',
        },
      ],
    })
    assert.ok(pdf)
    assert.ok(pdf.byteLength > 0)
    // Setting `anchor` alone (with no span/paragraph url pointing at it) must
    // not produce any Link annotation on its own — it's pure metadata today.
    const urls = await extractLinkUrls(pdf)
    assert.deepStrictEqual(urls, [])
  })

  await t.test('paragraph.url with empty string throws VALIDATION_ERROR', async () => {
    let error: any
    try {
      await render({
        pageSize: 'A4',
        content: [
          {
            type: 'paragraph',
            text: 'Test',
            url: '',
          },
        ],
      })
    } catch (e) {
      error = e
    }
    assert.ok(error)
    assert.strictEqual(error.code, 'VALIDATION_ERROR')
    assert.ok(error.message.includes('url'))
  })

  await t.test('heading.anchor with invalid characters throws VALIDATION_ERROR', async () => {
    let error: any
    try {
      await render({
        pageSize: 'A4',
        content: [
          {
            type: 'heading',
            level: 1,
            text: 'Test',
            anchor: 'bad anchor (spaces)',
          },
        ],
      })
    } catch (e) {
      error = e
    }
    assert.ok(error)
    assert.strictEqual(error.code, 'VALIDATION_ERROR')
    assert.ok(error.message.includes('anchor'))
  })

  await t.test('heading with both url and anchor: url still produces a working Link annotation', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [
        {
          type: 'heading',
          level: 1,
          text: 'Linked & Anchored',
          url: 'https://example.com',
          anchor: 'my-section',
        },
      ],
    })
    assert.ok(pdf)
    assert.ok(pdf.byteLength > 0)
    const urls = await extractLinkUrls(pdf)
    assert.deepStrictEqual(urls, ['https://example.com'])
  })

  await t.test('rich-paragraph with href produces a /Annots Link annotation resolving to the exact URL', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [
        {
          type: 'rich-paragraph',
          fontSize: 12,
          spans: [
            { text: 'Normal text ' },
            { text: 'linked text', href: 'https://example.com' },
            { text: ' more text' },
          ],
        },
      ],
    })
    assert.ok(pdf)
    assert.ok(pdf.byteLength > 0)
    // Rich-text tokenizes a span into per-word fragments, so a two-word link
    // span ("linked text") produces one Link annotation per word — assert
    // every fragment resolves to the same href, not an exact fragment count.
    const urls = await extractLinkUrls(pdf)
    assert.ok(urls.length > 0, 'expected at least one Link annotation for the href span')
    assert.ok(urls.every(u => u === 'https://example.com'), `expected every link to resolve to https://example.com, got: ${JSON.stringify(urls)}`)
  })

  await t.test('mailto: links resolve to the exact mailto URI', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [
        {
          type: 'paragraph',
          text: 'Email me',
          url: 'mailto:test@example.com',
        },
      ],
    })
    assert.ok(pdf)
    assert.ok(pdf.byteLength > 0)
    const urls = await extractLinkUrls(pdf)
    assert.deepStrictEqual(urls, ['mailto:test@example.com'])
  })

  await t.test('multi-column paragraph with url resolves to the exact URL on every wrapped line', async () => {
    const pdf = await render({
      pageSize: 'A4',
      content: [
        {
          type: 'paragraph',
          text: 'Lorem ipsum dolor sit amet consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
          columns: 2,
          url: 'https://example.com',
        },
      ],
    })
    assert.ok(pdf)
    assert.ok(pdf.byteLength > 0)
    // A wrapped paragraph gets one Link annotation per visual line (a single
    // /Rect can't cover a multi-line region) — assert every one of them
    // resolves to the same URL, rather than assuming an exact count that
    // depends on line-wrap layout details.
    const urls = await extractLinkUrls(pdf)
    assert.ok(urls.length > 0, 'expected at least one Link annotation')
    assert.ok(urls.every(u => u === 'https://example.com'), `expected every link to resolve to https://example.com, got: ${JSON.stringify(urls)}`)
  })

  await t.test('v2.2.4 regression: URL with parens/backslash/query characters survives hex-encoding byte-exact (no injection, no corruption)', async () => {
    const trickyUrl = "https://example.com/search?q=(unbalanced&path=back\\slash&note=it's(fine)"
    const pdf = await render({
      pageSize: 'A4',
      content: [
        {
          type: 'paragraph',
          text: 'Tricky link',
          url: trickyUrl,
        },
      ],
    })
    const urls = await extractLinkUrls(pdf)
    assert.deepStrictEqual(urls, [trickyUrl], 'URL with parens/backslash must resolve exactly — no truncation, no corruption')
  })
})
