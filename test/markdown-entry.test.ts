import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../dist/index.js'
import { markdownToContent } from '../dist/markdown.js'

// ─── Markdown → ContentElement conversion ────────────────────────────────────

test('Phase 10C — Markdown utility', async (t) => {

  // ── markdownToContent: element type mapping ────────────────────────────────

  await t.test('markdown: heading h1-h4 converts to HeadingElement', async () => {
    const elements = await markdownToContent('# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5 (clamped to 4)')
    const headings = elements.filter(e => e.type === 'heading') as Array<{ type: 'heading'; level: number }>
    assert.equal(headings.length, 5)
    assert.equal(headings[0]!.level, 1)
    assert.equal(headings[1]!.level, 2)
    assert.equal(headings[2]!.level, 3)
    assert.equal(headings[3]!.level, 4)
    assert.equal(headings[4]!.level, 4) // h5 clamped to 4
  })

  await t.test('markdown: plain paragraph converts to ParagraphElement', async () => {
    const elements = await markdownToContent('Hello world, plain text only.')
    assert.equal(elements.length, 1)
    assert.equal(elements[0]!.type, 'paragraph')
    assert.equal((elements[0] as any).text, 'Hello world, plain text only.')
  })

  await t.test('markdown: paragraph with bold/italic converts to RichParagraphElement', async () => {
    const elements = await markdownToContent('This is **bold** and *italic* text.')
    assert.equal(elements.length, 1)
    assert.equal(elements[0]!.type, 'rich-paragraph')
    const spans = (elements[0] as any).spans as Array<any>
    const boldSpan = spans.find((s: any) => s.fontWeight === 700)
    const italicSpan = spans.find((s: any) => s.fontStyle === 'italic')
    assert.ok(boldSpan, 'should have a bold span')
    assert.equal(boldSpan.text, 'bold')
    assert.ok(italicSpan, 'should have an italic span')
    assert.equal(italicSpan.text, 'italic')
  })

  await t.test('markdown: link in paragraph converts to InlineSpan with href', async () => {
    const elements = await markdownToContent('Click [here](https://example.com) for info.')
    assert.equal(elements[0]!.type, 'rich-paragraph')
    const spans = (elements[0] as any).spans as Array<any>
    const linkSpan = spans.find((s: any) => s.href)
    assert.ok(linkSpan, 'should have a link span')
    assert.equal(linkSpan.text, 'here')
    assert.equal(linkSpan.href, 'https://example.com')
  })

  await t.test('markdown: unordered list converts to ListElement with style unordered', async () => {
    const elements = await markdownToContent('- apple\n- banana\n- cherry')
    const list = elements.find(e => e.type === 'list') as any
    assert.ok(list, 'should have a list element')
    assert.equal(list.style, 'unordered')
    assert.equal(list.items.length, 3)
    assert.equal(list.items[0].text, 'apple')
  })

  await t.test('markdown: ordered list converts to ListElement with style ordered', async () => {
    const elements = await markdownToContent('1. first\n2. second\n3. third')
    const list = elements.find(e => e.type === 'list') as any
    assert.ok(list)
    assert.equal(list.style, 'ordered')
    assert.equal(list.items.length, 3)
    assert.equal(list.items[2].text, 'third')
  })

  await t.test('markdown: nested list converts to ListItem.items (max 2 levels)', async () => {
    const elements = await markdownToContent('- parent\n  - child A\n  - child B\n- other')
    const list = elements.find(e => e.type === 'list') as any
    assert.ok(list)
    assert.equal(list.items[0].text, 'parent')
    assert.ok(Array.isArray(list.items[0].items), 'parent should have nested items')
    assert.equal(list.items[0].items.length, 2)
    assert.equal(list.items[0].items[0].text, 'child A')
  })

  await t.test('markdown: blockquote converts to BlockquoteElement', async () => {
    const elements = await markdownToContent('> This is a quote.')
    const bq = elements.find(e => e.type === 'blockquote') as any
    assert.ok(bq)
    assert.ok(bq.text.includes('This is a quote'))
  })

  await t.test('markdown: hr converts to HrElement', async () => {
    const elements = await markdownToContent('above\n\n---\n\nbelow')
    const hr = elements.find(e => e.type === 'hr')
    assert.ok(hr)
  })

  await t.test('markdown: fenced code without codeFontFamily becomes ParagraphElement', async () => {
    const elements = await markdownToContent('```js\nconst x = 1\n```')
    const el = elements[0] as any
    assert.equal(el.type, 'paragraph')
    assert.ok(el.text.includes('const x'))
  })

  await t.test('markdown: space tokens are dropped (no empty elements)', async () => {
    const elements = await markdownToContent('# Title\n\nParagraph one.\n\nParagraph two.')
    // No 'space' type elements in output
    assert.ok(elements.every(e => e.type !== 'space'))
    assert.equal(elements.length, 3)
  })

  // ── End-to-end: render markdown-derived content as PDF ────────────────────

  await t.test('markdown: full doc renders as valid PDF', async () => {
    const md = `# Annual Report 2026

This report covers **Q1 through Q4** performance across all regions.

## Revenue

Revenue grew by 18% year-over-year, driven by:

- Cloud services (+32%)
- Enterprise licenses (+12%)
- Support contracts (+8%)

## Methodology

Data was sourced from internal systems and validated against external audits.

> All figures are in USD millions unless stated otherwise.

---

See full details in the appendix.
`
    const content = await markdownToContent(md)
    const pdf = await render({ content })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(Buffer.from(pdf.slice(0, 4)).toString('ascii'), '%PDF')
    assert.ok(pdf.byteLength > 1000)
  })

  await t.test('markdown: renders with heading and paragraph interspersed with other elements', async () => {
    const content = await markdownToContent('# Invoice\n\nThank you for your **business**.\n\n1. Item A — $100\n2. Item B — $250')
    const pdf = await render({
      content: [
        ...content,
        { type: 'paragraph', text: 'Total: $350' },
      ],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.equal(Buffer.from(pdf.slice(0, 4)).toString('ascii'), '%PDF')
  })

  // ── Inline token edge cases (del / escape / br / image) ───────────────────

  await t.test('markdown: del token content is preserved as plain spans', async () => {
    const elements = await markdownToContent('Price: ~~$100~~ $80')
    assert.equal(elements.length, 1)
    assert.equal(elements[0]!.type, 'rich-paragraph')
    const spans = (elements[0] as any).spans as Array<{ text: string }>
    const allText = spans.map(s => s.text).join('')
    assert.ok(allText.includes('$100'), 'del content should appear in spans')
    assert.ok(allText.includes('$80'))
  })

  await t.test('markdown: escape token emits literal character', async () => {
    // \* escapes asterisk — marked emits an escape token
    const elements = await markdownToContent('Use \\* for multiplication')
    assert.equal(elements.length, 1)
    // escaped char should appear in the output text (paragraph or rich-paragraph)
    const el = elements[0] as any
    const text: string = el.text ?? el.spans?.map((s: any) => s.text).join('') ?? ''
    assert.ok(text.includes('*'), 'escaped asterisk should appear in output')
  })

  await t.test('markdown: br token produces a space between inline content', async () => {
    // hard line break: two trailing spaces
    const elements = await markdownToContent('Line one  \nLine two')
    assert.equal(elements.length, 1)
    const el = elements[0] as any
    const text: string = el.text ?? el.spans?.map((s: any) => s.text).join('') ?? ''
    // Content from both lines should be present
    assert.ok(text.includes('Line one'), 'first line should appear')
    assert.ok(text.includes('Line two'), 'second line should appear')
  })

  await t.test('markdown: inline image emits alt text as span', async () => {
    const elements = await markdownToContent('See the ![company logo](logo.png) for branding.')
    assert.equal(elements.length, 1)
    const spans = (elements[0] as any).spans as Array<{ text: string }> | undefined
    if (spans) {
      const allText = spans.map(s => s.text).join('')
      assert.ok(allText.includes('company logo'), 'image alt text should appear in spans')
    }
    // If it fell back to plain paragraph, text should still have surrounding words
    const el = elements[0] as any
    const text: string = el.text ?? spans?.map((s: any) => s.text).join('') ?? ''
    assert.ok(text.includes('for branding'), 'surrounding text should be present')
  })

  await t.test('markdown: list item with bold text strips markdown syntax', async () => {
    const elements = await markdownToContent('- **Important**: read this\n- Plain item')
    assert.equal(elements.length, 1)
    assert.equal(elements[0]!.type, 'list')
    const items = (elements[0] as any).items as Array<{ text: string }>
    // Bold text in list item should be stripped to plain text (not **Important**)
    assert.ok(!items[0]!.text.includes('**'), 'markdown syntax should not appear in list item text')
    assert.ok(items[0]!.text.includes('Important'), 'bold content should still appear')
  })

  // ── v0.8.3 regression: deep nesting + paragraph-typed list items ──────────

  await t.test('markdown: 3-level nested list preserves all content (v0.8.3 fix)', async () => {
    // Pre-v0.8.3: convertListItem only created text-only leaves for nested
    // lists, so anything deeper than 2 levels was silently dropped.
    const md = '- A\n  - B\n    - C\n    - D'
    const elements = await markdownToContent(md)
    assert.equal(elements.length, 1)
    const list = elements[0] as any
    assert.equal(list.type, 'list')
    assert.equal(list.items.length, 1, 'top level has 1 item (A)')
    assert.equal(list.items[0].text, 'A')
    const lvl2 = list.items[0].items
    assert.ok(Array.isArray(lvl2) && lvl2.length === 1, 'level-2 has 1 item (B)')
    assert.equal(lvl2[0].text, 'B')
    const lvl3 = lvl2[0].items
    assert.ok(Array.isArray(lvl3) && lvl3.length === 2, `level-3 should have C and D; got ${JSON.stringify(lvl3)}`)
    assert.equal(lvl3[0].text, 'C')
    assert.equal(lvl3[1].text, 'D')
  })

  await t.test('markdown: list item with paragraph-typed content preserves text (v0.8.3 fix)', async () => {
    // When list items are separated by blank lines, marked emits paragraph tokens
    // (not text tokens) for the item content. Pre-v0.8.3 this content was
    // silently dropped because only `token.type === 'text'` was handled.
    const md = '- First item paragraph\n\n- Second item paragraph'
    const elements = await markdownToContent(md)
    assert.equal(elements.length, 1)
    const list = elements[0] as any
    assert.equal(list.type, 'list')
    assert.equal(list.items.length, 2)
    assert.ok(list.items[0].text.includes('First item'), `lost first item text; got "${list.items[0].text}"`)
    assert.ok(list.items[1].text.includes('Second item'), `lost second item text; got "${list.items[1].text}"`)
  })

})
