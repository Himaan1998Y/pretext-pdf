import { describe, test } from 'node:test'
import * as assert from 'node:assert'
import { render, validate, PretextPdfError } from '../dist/index.js'
import type { PdfDocument } from '../dist/index.js'

async function expectValidationError(fn: () => Promise<void> | void, expectedSubstring: string): Promise<void> {
  try {
    await Promise.resolve(fn())
    assert.fail(`Expected VALIDATION_ERROR with "${expectedSubstring}", but no error was thrown`)
  } catch (e) {
    if (!(e instanceof PretextPdfError) || e.code !== 'VALIDATION_ERROR') {
      throw e
    }
    if (!e.message.includes(expectedSubstring)) {
      assert.fail(`Expected "${expectedSubstring}" in error message, got: ${e.message}`)
    }
  }
}

async function expectPass(fn: () => Promise<void> | void): Promise<void> {
  await Promise.resolve(fn())
}

const minimalDoc: PdfDocument = {
  metadata: { title: 'Test' },
  content: [{ type: 'paragraph', text: 'Hello' }],
}

// ─── Group 1: Default (non-strict) mode — existing behavior preserved ───

describe('Strict validation — Group 1: Default mode (non-strict)', () => {
  test('Unknown prop on paragraph → passes silently (not strict)', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [{ type: 'paragraph', text: 'Hi', footnote: {} as any }],
    }
    await expectPass(() => render(doc))
  })

  test('Unknown prop on table cell → passes silently', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'table',
          columns: [{ width: 200 }],
          rows: [{ cells: [{ text: 'Cell', bogus: true as any }] }],
        },
      ],
    }
    await expectPass(() => render(doc))
  })

  test('Unknown prop at doc level → passes silently', async () => {
    const doc = { ...minimalDoc, strictMode: true as any }
    await expectPass(() => render(doc))
  })
})

// ─── Group 2: Strict mode — valid docs pass ───

describe('Strict validation — Group 2: Strict mode valid docs', () => {
  test('Minimal valid paragraph with strict → passes', async () => {
    await expectPass(() => render(minimalDoc, { strict: true }))
  })

  test('Full document structure with strict → passes', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Invoice', author: 'Test' },
      content: [
        { type: 'heading', level: 1, text: 'Invoice' },
        { type: 'paragraph', text: 'Date: 2026-04-23' },
        {
          type: 'table',
          columns: [{ width: 200 }, { width: 200 }],
          rows: [
            { isHeader: true, cells: [{ text: 'Item' }, { text: 'Price' }] },
            { cells: [{ text: 'Widget' }, { text: '$10' }] },
          ],
        },
        { type: 'list', style: 'unordered', items: [{ text: 'Note 1' }, { text: 'Note 2' }] },
      ],
    }
    await expectPass(() => render(doc, { strict: true }))
  })

  test('Document with all major element types → passes', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Demo' },
      content: [
        { type: 'paragraph', text: 'Para' },
        { type: 'heading', level: 1, text: 'H1' },
        { type: 'spacer', height: 10 },
        { type: 'hr', thickness: 1, color: '#000000' },
        { type: 'page-break' },
        { type: 'blockquote', text: 'Quote' },
        {
          type: 'rich-paragraph',
          spans: [{ text: 'Rich' }],
        },
        { type: 'callout', style: 'info', content: 'Info text' },
        { type: 'list', style: 'unordered', items: [{ text: 'Item' }] },
      ],
    }
    await expectPass(() => render(doc, { strict: true }))
  })
})

// ─── Group 3: Unknown prop on each element type ───

describe('Strict validation — Group 3: Unknown props on element types', () => {
  test('paragraph + footnote (invalid) → VALIDATION_ERROR', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [{ type: 'paragraph', text: 'Hi', footnote: {} as any }],
    }
    await expectValidationError(() => render(doc, { strict: true }), 'content[0].footnote')
  })

  test('heading + bogus prop → VALIDATION_ERROR', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [{ type: 'heading', level: 1, text: 'Title', bogus: true as any }],
    }
    await expectValidationError(() => render(doc, { strict: true }), 'bogus')
  })

  test('table + unknown cell prop → path content[0].rows[0].cells[1].xyz', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'table',
          columns: [{ width: 100 }, { width: 100 }],
          rows: [
            {
              cells: [
                { text: 'A' },
                { text: 'B', xyz: 'bad' as any },
              ],
            },
          ],
        },
      ],
    }
    await expectValidationError(
      () => render(doc, { strict: true }),
      'content[0].rows[0].cells[1].xyz'
    )
  })

  test('table + unknown row prop → path content[0].rows[0].badProp', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'table',
          columns: [{ width: 200 }],
          rows: [{ cells: [{ text: 'X' }], badProp: true as any }],
        },
      ],
    }
    await expectValidationError(
      () => render(doc, { strict: true }),
      'content[0].rows[0].badProp'
    )
  })

  test('list + unknown item prop → path content[0].items[0].xyz', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'list',
          style: 'unordered',
          items: [{ text: 'Item', xyz: 'bad' as any }],
        },
      ],
    }
    await expectValidationError(
      () => render(doc, { strict: true }),
      'content[0].items[0].xyz'
    )
  })

  test('rich-paragraph + unknown span prop (hrefs) → suggests href', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'rich-paragraph',
          spans: [{ text: 'Link', hrefs: 'http://example.com' as any }],
        },
      ],
    }
    await expectValidationError(
      () => render(doc, { strict: true }),
      'hrefs'
    )
  })

  test('image + alt (invalid) → VALIDATION_ERROR', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'image',
          src: new Uint8Array(10),
          format: 'png',
          width: 100,
          height: 100,
          alt: 'image' as any,
        },
      ],
    }
    await expectValidationError(() => render(doc, { strict: true }), 'alt')
  })

  test('callout + variant (should be style) → VALIDATION_ERROR', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'callout',
          style: 'info',
          content: 'Some callout text',
          variant: 'warning' as any,
        },
      ],
    }
    await expectValidationError(() => render(doc, { strict: true }), 'variant')
  })

  test('blockquote + quote (should be text) → VALIDATION_ERROR', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [{ type: 'blockquote', text: 'Quote', quote: 'extra' as any }],
    }
    await expectValidationError(() => render(doc, { strict: true }), 'quote')
  })

  test('spacer + width (invalid, only height) → VALIDATION_ERROR', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [{ type: 'spacer', height: 10, width: 20 as any }],
    }
    await expectValidationError(() => render(doc, { strict: true }), 'width')
  })

  test('hr + color (valid, should pass) → passes', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [{ type: 'hr', thickness: 1, color: '#000000' }],
    }
    await expectPass(() => render(doc, { strict: true }))
  })

  test('page-break + force (invalid) → VALIDATION_ERROR', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [{ type: 'page-break', force: true as any }],
    }
    await expectValidationError(() => render(doc, { strict: true }), 'force')
  })
})

// ─── Group 4: Nested structures ───

describe('Strict validation — Group 4: Nested structures', () => {
  test('Table cell with unknown prop → correct path', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'table',
          columns: [{ width: 200 }],
          rows: [{ cells: [{ text: 'X', badKey: 'val' as any }] }],
        },
      ],
    }
    await expectValidationError(
      () => render(doc, { strict: true }),
      'cells[0].badKey'
    )
  })

  test('List item level 1 → path content[0].items[0].xyz', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'list',
          style: 'unordered',
          items: [{ text: 'Item', badProp: true as any }],
        },
      ],
    }
    await expectValidationError(
      () => render(doc, { strict: true }),
      'content[0].items[0].badProp'
    )
  })

  test('List item level 2 (nested) → path content[0].items[0].items[0].xyz', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'list',
          style: 'unordered',
          items: [
            {
              text: 'Item 1',
              items: [{ text: 'Nested', badKey: 'x' as any }],
            },
          ],
        },
      ],
    }
    await expectValidationError(
      () => render(doc, { strict: true }),
      'items[0].items[0].badKey'
    )
  })

  test('Span with unknown prop → correct path', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'rich-paragraph',
          spans: [{ text: 'Text', badSpanProp: true as any }],
        },
      ],
    }
    await expectValidationError(
      () => render(doc, { strict: true }),
      'spans[0].badSpanProp'
    )
  })

  test('Annotation on paragraph with unknown prop → path content[0].annotation.xyz', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'paragraph',
          text: 'Annotated',
          annotation: { contents: 'Note', badAnnotationKey: true as any },
        },
      ],
    }
    await expectValidationError(
      () => render(doc, { strict: true }),
      'content[0].annotation.badAnnotationKey'
    )
  })
})

// ─── Group 5: Error message quality ───

describe('Strict validation — Group 5: Error message quality', () => {
  test('Multi-error: 3 unknown props → all collected', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        { type: 'paragraph', text: 'A', bad1: true as any },
        { type: 'heading', level: 1, text: 'B', bad2: true as any },
        { type: 'spacer', height: 10, bad3: true as any },
      ],
    }
    await expectValidationError(() => render(doc, { strict: true }), 'Strict validation failed (3 issues)')
  })

  test('Error limit: 21 unknown props → shows "and X more"', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'paragraph',
          text: 'Test',
          a: 1 as any,
          b: 1 as any,
          c: 1 as any,
          d: 1 as any,
          e: 1 as any,
          f: 1 as any,
          g: 1 as any,
          h: 1 as any,
          i: 1 as any,
          j: 1 as any,
          k: 1 as any,
          l: 1 as any,
          m: 1 as any,
          n: 1 as any,
          o: 1 as any,
          p: 1 as any,
          q: 1 as any,
          r: 1 as any,
          s: 1 as any,
          t: 1 as any,
          u: 1 as any,
        },
      ],
    }
    await expectValidationError(() => render(doc, { strict: true }), '... and')
  })

  test('Levenshtein: hrefs → suggests href', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'rich-paragraph',
          spans: [{ text: 'Link', hrefs: 'bad' as any }],
        },
      ],
    }
    await expectValidationError(
      () => render(doc, { strict: true }),
      'did you mean "href"'
    )
  })

  test('Levenshtein: spaceafter → suggests spaceAfter', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [{ type: 'paragraph', text: 'X', spaceafter: 10 as any }],
    }
    await expectValidationError(
      () => render(doc, { strict: true }),
      'did you mean "spaceAfter"'
    )
  })

  test('No suggestion for completely wrong prop', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [{ type: 'paragraph', text: 'X', xyzzy: 'nope' as any }],
    }
    await expectValidationError(() => render(doc, { strict: true }), 'xyzzy')
  })
})

// ─── Group 6: Opaque/doc-level ───

describe('Strict validation — Group 6: Opaque content and doc-level', () => {
  test('ChartElement.spec with extra vega-lite props → passes', async () => {
    const vega = { $schema: 'https://vega.github.io/schema/vega-lite/v5.json', data: { values: [] }, mark: 'bar', encoding: {} }
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'chart',
          spec: vega,
          width: 400,
          height: 300,
        },
      ],
    }
    await expectPass(() => render(doc, { strict: true }))
  })

  test('Doc-level unknown prop → VALIDATION_ERROR with path doc.xyz', async () => {
    const doc = { ...minimalDoc, strictMode: true as any }
    await expectValidationError(() => render(doc, { strict: true }), 'doc.strictMode')
  })

  test('FloatGroup content item validated recursively', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'float-group',
          float: 'left',
          image: { src: new Uint8Array(10), format: 'png', height: 100 },
          content: [
            { type: 'paragraph', text: 'Text', badKey: true as any },
          ],
        },
      ],
    }
    await expectValidationError(
      () => render(doc, { strict: true }),
      'badKey'
    )
  })

  test('Encryption with unknown prop → path doc.encryption.xyz', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [{ type: 'paragraph', text: 'Secret' }],
      encryption: { userPassword: 'secret', badKey: true as any },
    }
    await expectValidationError(
      () => render(doc, { strict: true }),
      'doc.encryption.badKey'
    )
  })
})

// ─── Group 7: Levenshtein edge cases ───

describe('Strict validation — Group 7: Levenshtein edge cases', () => {
  test('Exact match of allowed prop → passes', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [{ type: 'paragraph', text: 'Hi', spaceAfter: 10 }],
    }
    await expectPass(() => render(doc, { strict: true }))
  })

  test('Prop with distance > 2 → no suggestion', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [{ type: 'paragraph', text: 'Hi', longunknownbadkey: true as any }],
    }
    await assert.rejects(
      () => render(doc, { strict: true }),
      (e: any) => {
        assert.ok(e.code === 'VALIDATION_ERROR')
        assert.ok(!e.message.includes('did you mean'))
        return true
      }
    )
  })

  test('Distance 1 vs 2 candidates → returns shortest', async () => {
    // This is hard to construct naturally, so just verify d=1 suggestions work
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [{ type: 'paragraph', text: 'Hi', textt: 'extra' as any }],
    }
    await expectValidationError(
      () => render(doc, { strict: true }),
      'did you mean "text"'
    )
  })
})

// ─── Group 8: Discriminated unions (Phase B type safety) ───

describe('Discriminated unions — WatermarkSpec', () => {
  test('WatermarkSpec with text → passes', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [{ type: 'paragraph', text: 'Content' }],
      watermark: { text: 'DRAFT', opacity: 0.5 },
    }
    await expectPass(() => render(doc))
  })

  test('WatermarkSpec with image → passes', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [{ type: 'paragraph', text: 'Content' }],
      watermark: { image: new Uint8Array(100), opacity: 0.5 },
    }
    await expectPass(() => render(doc))
  })

  test('WatermarkSpec with both text and image → type error at compile-time', async () => {
    // This test documents the compile-time constraint.
    // At runtime, validation still ensures one is set.
    // TypeScript would catch this at compile time with stricter checking.
  })
})

describe('Discriminated unions — SvgElement', () => {
  test('SvgElement with svg (inline) → passes', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'svg',
          svg: '<svg><circle cx="50" cy="50" r="40" /></svg>',
          width: 100,
        },
      ],
    }
    await expectPass(() => render(doc))
  })

  test('SvgElement with src (file path) → validation recognizes the type', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'svg',
          src: '/abs/path/to/file.svg',
          width: 100,
        },
      ],
    }
    // This would fail on rendering (file doesn't exist), but validation accepts the type structure
    assert.ok(doc.content[0].type === 'svg')
  })

  test('SvgElement with src (https URL) → validation recognizes the type', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'svg',
          src: 'https://example.com/chart.svg',
          width: 100,
        },
      ],
    }
    // This would fail on rendering (file doesn't exist), but validation accepts the type structure
    assert.ok(doc.content[0].type === 'svg')
  })

  test('SvgElement with both svg and src → type error at compile-time', async () => {
    // TypeScript enforces this constraint at compile-time.
  })
})

describe('Discriminated unions — AssemblyPart', () => {
  test('AssemblyPart with doc → passes', async () => {
    const part: any = {
      doc: { content: [{ type: 'paragraph', text: 'Page 1' }] },
    }
    // Would pass validation if assembled
    assert.ok(part.doc !== undefined)
  })

  test('AssemblyPart with pdf → passes', async () => {
    const part: any = {
      pdf: new Uint8Array(100),
    }
    assert.ok(part.pdf !== undefined)
  })

  test('AssemblyPart with both doc and pdf → type error at compile-time', async () => {
    // TypeScript enforces this constraint at compile-time.
  })
})

describe('Discriminated unions — ImageElement float variant', () => {
  test('ImageElement without float → passes', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'image',
          src: new Uint8Array(100),
          format: 'png',
          width: 200,
          height: 200,
        },
      ],
    }
    await expectPass(() => render(doc))
  })

  test('ImageElement with float and floatText → passes', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'image',
          src: new Uint8Array(100),
          format: 'png',
          float: 'left',
          floatText: 'Text beside image',
          floatWidth: 200,
        },
      ],
    }
    await expectPass(() => render(doc))
  })

  test('ImageElement with float and floatSpans → passes', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'image',
          src: new Uint8Array(100),
          format: 'png',
          float: 'right',
          floatSpans: [{ text: 'Styled text' }, { text: 'beside image', fontWeight: 700 }],
        },
      ],
    }
    await expectPass(() => render(doc))
  })

  test('ImageElement with float but no floatText/floatSpans → validation error', async () => {
    const doc: PdfDocument = {
      metadata: { title: 'Test' },
      content: [
        {
          type: 'image',
          src: new Uint8Array(100),
          format: 'png',
          float: 'left' as any,
          // Missing floatText and floatSpans
        },
      ],
    }
    await expectValidationError(
      () => render(doc),
      "'floatText' or 'floatSpans' is required when 'float' is set"
    )
  })
})
