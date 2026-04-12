/**
 * Unit tests for validate.ts — fast, no I/O, no PDF rendering.
 * Run: node --experimental-strip-types --test test/validate.test.ts
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

const { render, PretextPdfError } = await import('../dist/index.js')

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function expectError(docFn: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(docFn, (err: unknown) => {
    assert.ok(err instanceof PretextPdfError, `Expected PretextPdfError, got ${String(err)}`)
    assert.equal(err.code, code, `Expected code '${code}', got '${err.code}': ${err.message}`)
    return true
  })
}

const minDoc = { content: [{ type: 'paragraph' as const, text: 'hi' }] }

// ─── Content array ────────────────────────────────────────────────────────────

describe('validate — content array', () => {
  test('throws VALIDATION_ERROR for empty content', async () => {
    await expectError(() => render({ content: [] }), 'VALIDATION_ERROR')
  })

  test('throws VALIDATION_ERROR for non-array content', async () => {
    // @ts-expect-error intentional
    await expectError(() => render({ content: 'not an array' }), 'VALIDATION_ERROR')
  })
})

// ─── Page sizes ───────────────────────────────────────────────────────────────

describe('validate — page sizes', () => {
  for (const size of ['A4', 'Letter', 'Legal', 'A3', 'A5', 'Tabloid'] as const) {
    test(`page size '${size}' is accepted`, async () => {
      const pdf = await render({ pageSize: size, content: [{ type: 'paragraph', text: 'hi' }] })
      assert.ok(pdf instanceof Uint8Array && pdf.byteLength > 100)
    })
  }

  test('custom [width, height] page size is accepted', async () => {
    const pdf = await render({ pageSize: [300, 400], content: [{ type: 'paragraph', text: 'hi' }] })
    assert.ok(pdf instanceof Uint8Array)
  })

  test('throws PAGE_TOO_SMALL when margins exceed page width', async () => {
    await expectError(
      () => render({ pageSize: 'A4', margins: { top: 72, bottom: 72, left: 350, right: 350 }, content: [{ type: 'paragraph', text: 'hi' }] }),
      'PAGE_TOO_SMALL'
    )
  })

  test('throws VALIDATION_ERROR for negative margin values', async () => {
    await expectError(
      () => render({ margins: { top: -10, bottom: 72, left: 72, right: 72 }, content: [{ type: 'paragraph', text: 'hi' }] }),
      'VALIDATION_ERROR'
    )
    await expectError(
      () => render({ margins: { top: 72, bottom: 72, left: -5, right: 72 }, content: [{ type: 'paragraph', text: 'hi' }] }),
      'VALIDATION_ERROR'
    )
  })
})

// ─── Paragraph validation ─────────────────────────────────────────────────────

describe('validate — paragraph', () => {
  test('throws VALIDATION_ERROR for non-string text', async () => {
    // @ts-expect-error intentional
    await expectError(() => render({ content: [{ type: 'paragraph', text: 42 }] }), 'VALIDATION_ERROR')
  })

  test('accepts Arabic RTL text (now supported)', async () => {
    const result = await render({ content: [{ type: 'paragraph', text: 'مرحبا' }] })
    assert(result instanceof Uint8Array)
    assert(result.length > 0, 'PDF should have content')
  })

  test('throws VALIDATION_ERROR for invalid hex color', async () => {
    await expectError(() => render({ content: [{ type: 'paragraph', text: 'hi', color: 'red' }] }), 'VALIDATION_ERROR')
  })

  test('throws VALIDATION_ERROR for negative spaceAfter', async () => {
    await expectError(() => render({ content: [{ type: 'paragraph', text: 'hi', spaceAfter: -1 }] }), 'VALIDATION_ERROR')
  })

  test('throws VALIDATION_ERROR for zero fontSize', async () => {
    await expectError(() => render({ content: [{ type: 'paragraph', text: 'hi', fontSize: 0 }] }), 'VALIDATION_ERROR')
  })

  test('throws VALIDATION_ERROR for lineHeight less than fontSize', async () => {
    await expectError(
      () => render({ content: [{ type: 'paragraph', text: 'hi', fontSize: 14, lineHeight: 10 }] }),
      'VALIDATION_ERROR'
    )
  })

  test('accepts lineHeight equal to fontSize (tight but valid)', async () => {
    const pdf = await render({ content: [{ type: 'paragraph', text: 'hi', fontSize: 12, lineHeight: 12 }] })
    assert.ok(pdf instanceof Uint8Array)
  })

  test('throws VALIDATION_ERROR for lineHeight less than default fontSize (12pt) when fontSize not set', async () => {
    // lineHeight: 10 with no fontSize → defaults to 12 → 10 < 12 → should throw
    await expectError(
      () => render({ content: [{ type: 'paragraph', text: 'hi', lineHeight: 10 }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws FONT_NOT_LOADED for paragraph fontWeight:700 when 700 variant not in doc.fonts', async () => {
    await expectError(
      () => render({ content: [{ type: 'paragraph', text: 'hi', fontWeight: 700, fontFamily: 'NotLoaded' }] }),
      'FONT_NOT_LOADED'
    )
  })

  test('paragraph fontWeight:700 with bundled Inter is valid', async () => {
    const pdf = await render({ content: [{ type: 'paragraph', text: 'hi', fontWeight: 700 }] })
    assert.ok(pdf instanceof Uint8Array)
  })
})

// ─── Heading validation ───────────────────────────────────────────────────────

describe('validate — heading', () => {
  test('throws VALIDATION_ERROR for invalid level', async () => {
    // @ts-expect-error intentional
    await expectError(() => render({ content: [{ type: 'heading', level: 5, text: 'hi' }] }), 'VALIDATION_ERROR')
  })

  test('accepts all valid heading levels', async () => {
    for (const level of [1, 2, 3, 4] as const) {
      const pdf = await render({ content: [{ type: 'heading', level, text: `Heading ${level}` }] })
      assert.ok(pdf instanceof Uint8Array)
    }
  })

  test('throws VALIDATION_ERROR for negative spaceAfter on heading', async () => {
    await expectError(
      () => render({ content: [{ type: 'heading', level: 1, text: 'hi', spaceAfter: -1 }] }),
      'VALIDATION_ERROR'
    )
  })
})

// ─── Code block validation ────────────────────────────────────────────────────

describe('validate — code block', () => {
  test('throws MONOSPACE_FONT_REQUIRED when fontFamily omitted', async () => {
    // @ts-expect-error intentional
    await expectError(() => render({ content: [{ type: 'code', text: 'hello()' }] }), 'MONOSPACE_FONT_REQUIRED')
  })

  test('throws MONOSPACE_FONT_REQUIRED for unknown font family', async () => {
    await expectError(
      () => render({ content: [{ type: 'code', text: 'hello()', fontFamily: 'UnknownFont' }] }),
      'MONOSPACE_FONT_REQUIRED'
    )
  })

  test('throws VALIDATION_ERROR for empty text', async () => {
    await expectError(
      () => render({ content: [{ type: 'code', text: '', fontFamily: 'Inter' }] }),
      'VALIDATION_ERROR'
    )
  })

  test('accepts code block with bundled font', async () => {
    const pdf = await render({ content: [{ type: 'code', text: 'const x = 1', fontFamily: 'Inter' }] })
    assert.ok(pdf instanceof Uint8Array)
  })
})

// ─── Rich-paragraph validation ────────────────────────────────────────────────

describe('validate — rich-paragraph', () => {
  test('throws VALIDATION_ERROR for empty spans array', async () => {
    await expectError(() => render({ content: [{ type: 'rich-paragraph', spans: [] }] }), 'VALIDATION_ERROR')
  })

  test('throws VALIDATION_ERROR for empty string span text', async () => {
    await expectError(
      () => render({ content: [{ type: 'rich-paragraph', spans: [{ text: '' }] }] }),
      'VALIDATION_ERROR'
    )
  })

  test('accepts whitespace-only span (valid space between styled runs)', async () => {
    const pdf = await render({
      content: [{
        type: 'rich-paragraph',
        spans: [{ text: 'Bold', fontWeight: 700 }, { text: ' ' }, { text: 'normal' }],
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  test('accepts RTL span (now supported)', async () => {
    const result = await render({ content: [{ type: 'rich-paragraph', spans: [{ text: 'مرحبا' }] }] })
    assert(result instanceof Uint8Array)
    assert(result.length > 0, 'PDF should have content')
  })

  test('throws VALIDATION_ERROR for invalid color in span', async () => {
    await expectError(
      () => render({ content: [{ type: 'rich-paragraph', spans: [{ text: 'hi', color: 'blue' }] }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws ITALIC_FONT_NOT_LOADED for italic span without font', async () => {
    await expectError(
      () => render({ content: [{ type: 'rich-paragraph', spans: [{ text: 'italic', fontStyle: 'italic' }] }] }),
      'ITALIC_FONT_NOT_LOADED'
    )
  })

  test('throws VALIDATION_ERROR for invalid fontWeight', async () => {
    await expectError(
      // @ts-expect-error intentional
      () => render({ content: [{ type: 'rich-paragraph', spans: [{ text: 'hi', fontWeight: 500 }] }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for negative spaceBefore', async () => {
    await expectError(
      () => render({ content: [{ type: 'rich-paragraph', spans: [{ text: 'hi' }], spaceBefore: -1 }] }),
      'VALIDATION_ERROR'
    )
  })

  test('accepts spaceBefore: 0 on rich-paragraph', async () => {
    const pdf = await render({ content: [{ type: 'rich-paragraph', spans: [{ text: 'hi' }], spaceBefore: 0 }] })
    assert.ok(pdf instanceof Uint8Array)
  })
})

// ─── Font reference validation ────────────────────────────────────────────────

describe('validate — font references', () => {
  test('throws FONT_NOT_LOADED for unknown defaultFont', async () => {
    await expectError(
      () => render({ defaultFont: 'FantasyFont', content: [{ type: 'paragraph', text: 'hi' }] }),
      'FONT_NOT_LOADED'
    )
  })

  test('throws FONT_NOT_LOADED for unknown paragraph fontFamily', async () => {
    await expectError(
      () => render({ content: [{ type: 'paragraph', text: 'hi', fontFamily: 'NotLoaded' }] }),
      'FONT_NOT_LOADED'
    )
  })

  test('throws FONT_NOT_LOADED for unknown header fontFamily', async () => {
    await expectError(
      () => render({
        header: { text: 'Header', fontFamily: 'NotLoaded' },
        content: [{ type: 'paragraph', text: 'hi' }],
      }),
      'FONT_NOT_LOADED'
    )
  })

  test('throws FONT_NOT_LOADED for unknown rich-paragraph span fontFamily', async () => {
    await expectError(
      () => render({
        content: [{ type: 'rich-paragraph', spans: [{ text: 'hi', fontFamily: 'NotLoaded' }] }],
      }),
      'FONT_NOT_LOADED'
    )
  })

  test('Inter (bundled) is always accepted as defaultFont', async () => {
    const pdf = await render({ defaultFont: 'Inter', content: [{ type: 'paragraph', text: 'hi' }] })
    assert.ok(pdf instanceof Uint8Array)
  })

  test('header with fontWeight:700 accepted when 700 variant is available (Inter bundled)', async () => {
    const pdf = await render({
      header: { text: 'Page {{pageNumber}}', fontWeight: 700 },
      content: [{ type: 'paragraph', text: 'hi' }],
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  test('footer with fontWeight:700 accepted when using bundled Inter', async () => {
    const pdf = await render({
      footer: { text: '{{pageNumber}} of {{totalPages}}', fontWeight: 700 },
      content: [{ type: 'paragraph', text: 'hi' }],
    })
    assert.ok(pdf instanceof Uint8Array)
  })
})

// ─── Table validation ─────────────────────────────────────────────────────────

describe('validate — table', () => {
  test('throws COLSPAN_OVERFLOW for column count mismatch (colspan enabled)', async () => {
    // With colspan support, a row with fewer cells than columns throws COLSPAN_OVERFLOW
    // (colspan sum < column count) rather than VALIDATION_ERROR
    await expectError(
      () => render({ content: [{ type: 'table', columns: [{ width: '*' }, { width: 80 }], rows: [{ cells: [{ text: 'one cell only' }] }] }] }),
      'COLSPAN_OVERFLOW'
    )
  })

  test('throws TABLE_COLUMN_OVERFLOW for fixed columns exceeding content width', async () => {
    await expectError(
      () => render({ content: [{ type: 'table', columns: [{ width: 400 }, { width: 400 }], rows: [{ cells: [{ text: 'A' }, { text: 'B' }] }] }] }),
      'TABLE_COLUMN_OVERFLOW'
    )
  })

  test('accepts auto-width columns', async () => {
    const pdf = await render({
      content: [{
        type: 'table',
        columns: [{ width: 'auto' }, { width: '*' }],
        rows: [
          { isHeader: true, cells: [{ text: 'Type', fontWeight: 700 }, { text: 'Desc', fontWeight: 700 }] },
          { cells: [{ text: 'X' }, { text: 'description' }] },
        ],
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  test('throws VALIDATION_ERROR for table with zero fontSize', async () => {
    await expectError(
      () => render({ content: [{ type: 'table', fontSize: 0, columns: [{ width: '*' }], rows: [{ cells: [{ text: 'hi' }] }] }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for table with negative fontSize', async () => {
    await expectError(
      () => render({ content: [{ type: 'table', fontSize: -5, columns: [{ width: '*' }], rows: [{ cells: [{ text: 'hi' }] }] }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for negative spaceAfter on table', async () => {
    await expectError(
      () => render({ content: [{ type: 'table', spaceAfter: -1, columns: [{ width: '*' }], rows: [{ cells: [{ text: 'hi' }] }] }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for negative spaceBefore on table', async () => {
    await expectError(
      () => render({ content: [{ type: 'table', spaceBefore: -1, columns: [{ width: '*' }], rows: [{ cells: [{ text: 'hi' }] }] }] }),
      'VALIDATION_ERROR'
    )
  })

  // ─── Colspan validation (Phase 5B.3) ───────────────────────────────────────────

  test('throws COLSPAN_OVERFLOW when colspan sum > column count', async () => {
    await expectError(
      () => render({
        content: [{
          type: 'table',
          columns: [{ width: '*' }, { width: '*' }, { width: '*' }],
          rows: [{ cells: [{ text: 'A', colspan: 2 }, { text: 'B', colspan: 2 }] }],  // 2 + 2 = 4 > 3
        }],
      }),
      'COLSPAN_OVERFLOW'
    )
  })

  test('accepts valid colspan in a row', async () => {
    const pdf = await render({
      content: [{
        type: 'table',
        columns: [{ width: '*' }, { width: '*' }, { width: '*' }],
        rows: [
          { cells: [{ text: 'A', colspan: 2 }, { text: 'B' }] },  // 2 + 1 = 3 ✓
          { cells: [{ text: 'X' }, { text: 'Y' }, { text: 'Z' }] },
        ],
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  test('throws VALIDATION_ERROR for non-positive colspan', async () => {
    await expectError(
      () => render({
        content: [{
          type: 'table',
          columns: [{ width: '*' }, { width: '*' }],
          rows: [{ cells: [{ text: 'A', colspan: 0 }] }],
        }],
      }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for non-integer colspan', async () => {
    await expectError(
      () => render({
        content: [{
          type: 'table',
          columns: [{ width: '*' }, { width: '*' }],
          rows: [{ cells: [{ text: 'A', colspan: 1.5 }] }],
        }],
      }),
      'VALIDATION_ERROR'
    )
  })
})

// ─── Image validation ─────────────────────────────────────────────────────────

describe('validate — image', () => {
  test('throws VALIDATION_ERROR for invalid format', async () => {
    await expectError(
      // @ts-expect-error intentional
      () => render({ content: [{ type: 'image', src: '/img.bmp', format: 'bmp', width: 100, height: 100 }] }),
      'VALIDATION_ERROR'
    )
  })

  test('accepts format: auto (default)', async () => {
    // Without a real image file we can't render, but validation should pass
    // This should fail with IMAGE_LOAD_FAILED (file not found), not VALIDATION_ERROR
    await assert.rejects(
      () => render({ content: [{ type: 'image', src: '/nonexistent.png', format: 'auto', width: 100, height: 100 }] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.notEqual(err.code, 'VALIDATION_ERROR', 'Should fail at load, not validation')
        return true
      }
    )
  })

  test('format auto-detects PNG from Uint8Array magic bytes (fails at embed, not validation)', async () => {
    // Minimal PNG magic bytes — passes validation, fails at pdf-lib embed
    const pngMagic = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    await assert.rejects(
      () => render({ content: [{ type: 'image', src: pngMagic, width: 100, height: 100 }] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.notEqual(err.code, 'VALIDATION_ERROR', 'Should fail at embed (IMAGE_FORMAT_MISMATCH), not validation')
        return true
      }
    )
  })

  test('format auto-detects JPEG from Uint8Array magic bytes (fails at embed, not validation)', async () => {
    const jpegMagic = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10])
    await assert.rejects(
      () => render({ content: [{ type: 'image', src: jpegMagic, width: 100, height: 100 }] }),
      (err: unknown) => {
        assert.ok(err instanceof PretextPdfError)
        assert.notEqual(err.code, 'VALIDATION_ERROR', 'Should fail at embed, not validation')
        return true
      }
    )
  })

  test('throws VALIDATION_ERROR for negative spaceAfter on image', async () => {
    await expectError(
      () => render({ content: [{ type: 'image', src: '/img.png', width: 100, height: 100, spaceAfter: -1 }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for negative spaceBefore on image', async () => {
    await expectError(
      () => render({ content: [{ type: 'image', src: '/img.png', width: 100, height: 100, spaceBefore: -1 }] }),
      'VALIDATION_ERROR'
    )
  })
})

// ─── Unknown type ─────────────────────────────────────────────────────────────

describe('validate — unknown element type', () => {
  test('throws VALIDATION_ERROR for unknown element type', async () => {
    // @ts-expect-error intentional
    await expectError(() => render({ content: [{ type: 'video', src: 'x' }] }), 'VALIDATION_ERROR')
  })
})

// ─── List validation (5A.9 gap fill) ─────────────────────────────────────────

describe('validate — list (gap fill)', () => {
  test('throws VALIDATION_ERROR for invalid style', async () => {
    await expectError(
      // @ts-expect-error intentional
      () => render({ content: [{ type: 'list', style: 'bulleted', items: [{ text: 'item' }] }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for empty items array', async () => {
    await expectError(
      () => render({ content: [{ type: 'list', style: 'unordered', items: [] }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for empty item text', async () => {
    await expectError(
      () => render({ content: [{ type: 'list', style: 'unordered', items: [{ text: '' }] }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for invalid item color', async () => {
    await expectError(
      () => render({ content: [{ type: 'list', style: 'unordered', items: [{ text: 'hi' }], color: 'red' }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for negative indent', async () => {
    await expectError(
      () => render({ content: [{ type: 'list', style: 'unordered', items: [{ text: 'hi' }], indent: -5 }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for invalid fontWeight on list item', async () => {
    await expectError(
      // @ts-expect-error intentional
      () => render({ content: [{ type: 'list', style: 'unordered', items: [{ text: 'hi', fontWeight: 500 }] }] }),
      'VALIDATION_ERROR'
    )
  })

  test('accepts list item with fontWeight: 700', async () => {
    const pdf = await render({
      content: [{
        type: 'list',
        style: 'unordered',
        items: [{ text: 'bold item', fontWeight: 700 }, { text: 'normal item' }],
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
  })
})

// ─── HR validation (5A.9 gap fill) ───────────────────────────────────────────

describe('validate — hr (gap fill)', () => {
  test('throws VALIDATION_ERROR for negative thickness', async () => {
    await expectError(
      () => render({ content: [{ type: 'hr', thickness: -1 }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for invalid color', async () => {
    await expectError(
      () => render({ content: [{ type: 'hr', color: 'gray' }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for negative spaceAbove', async () => {
    await expectError(
      () => render({ content: [{ type: 'hr', spaceAbove: -5 }] }),
      'VALIDATION_ERROR'
    )
  })

  test('accepts hr with all defaults', async () => {
    const pdf = await render({ content: [{ type: 'hr' }] })
    assert.ok(pdf instanceof Uint8Array)
  })
})

// ─── Spacer validation (5A.9 gap fill) ───────────────────────────────────────

describe('validate — spacer (gap fill)', () => {
  test('throws VALIDATION_ERROR for negative height', async () => {
    await expectError(
      () => render({ content: [{ type: 'spacer', height: -1 }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for NaN height', async () => {
    await expectError(
      () => render({ content: [{ type: 'spacer', height: NaN }] }),
      'VALIDATION_ERROR'
    )
  })

  test('accepts spacer with zero height', async () => {
    const pdf = await render({ content: [{ type: 'spacer', height: 0 }] })
    assert.ok(pdf instanceof Uint8Array)
  })
})

// ─── Heading 5A.1 validation ──────────────────────────────────────────────────

describe('validate — heading 5A.1 fields', () => {
  test('throws VALIDATION_ERROR for invalid fontWeight on heading', async () => {
    await expectError(
      // @ts-expect-error intentional
      () => render({ content: [{ type: 'heading', level: 1, text: 'hi', fontWeight: 500 }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for zero fontSize on heading', async () => {
    await expectError(
      () => render({ content: [{ type: 'heading', level: 1, text: 'hi', fontSize: 0 }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for invalid align on heading', async () => {
    await expectError(
      // @ts-expect-error intentional
      () => render({ content: [{ type: 'heading', level: 1, text: 'hi', align: 'stretch' }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for negative spaceBefore on heading', async () => {
    await expectError(
      () => render({ content: [{ type: 'heading', level: 1, text: 'hi', spaceBefore: -1 }] }),
      'VALIDATION_ERROR'
    )
  })

  test('accepts heading with all new fields set', async () => {
    const pdf = await render({
      content: [{
        type: 'heading', level: 2, text: 'Custom Heading',
        fontWeight: 400, fontSize: 20, align: 'center', spaceBefore: 10, spaceAfter: 8,
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
  })

  test('throws FONT_NOT_LOADED for heading with unknown fontFamily', async () => {
    await expectError(
      () => render({ content: [{ type: 'heading', level: 1, text: 'hi', fontFamily: 'NotLoaded' }] }),
      'FONT_NOT_LOADED'
    )
  })
})

// ─── Paragraph bgColor 5A.4 ───────────────────────────────────────────────────

describe('validate — paragraph bgColor (5A.4)', () => {
  test('throws VALIDATION_ERROR for invalid bgColor', async () => {
    await expectError(
      () => render({ content: [{ type: 'paragraph', text: 'hi', bgColor: 'yellow' }] }),
      'VALIDATION_ERROR'
    )
  })

  test('accepts paragraph with valid bgColor', async () => {
    const pdf = await render({ content: [{ type: 'paragraph', text: 'hi', bgColor: '#ffffcc' }] })
    assert.ok(pdf instanceof Uint8Array)
  })

  test('throws VALIDATION_ERROR for negative spaceBefore on paragraph', async () => {
    await expectError(
      () => render({ content: [{ type: 'paragraph', text: 'hi', spaceBefore: -1 }] }),
      'VALIDATION_ERROR'
    )
  })
})

// ─── TableCell fontFamily 5A.3 ────────────────────────────────────────────────

describe('validate — TableCell fontFamily (5A.3)', () => {
  test('throws VALIDATION_ERROR for empty fontFamily on cell', async () => {
    await expectError(
      () => render({
        content: [{
          type: 'table',
          columns: [{ width: '*' }],
          // @ts-expect-error intentional
          rows: [{ cells: [{ text: 'hi', fontFamily: '' }] }],
        }],
      }),
      'VALIDATION_ERROR'
    )
  })

  test('throws FONT_NOT_LOADED for unknown cell fontFamily', async () => {
    await expectError(
      () => render({
        content: [{
          type: 'table',
          columns: [{ width: '*' }],
          rows: [
            { isHeader: true, cells: [{ text: 'Header' }] },
            { cells: [{ text: 'Cell', fontFamily: 'NotLoaded' }] },
          ],
        }],
      }),
      'FONT_NOT_LOADED'
    )
  })
})

// ─── HeaderFooterSpec color 5A.5 ─────────────────────────────────────────────

describe('validate — HeaderFooterSpec color (5A.5)', () => {
  test('throws VALIDATION_ERROR for invalid header color', async () => {
    await expectError(
      () => render({
        header: { text: 'Header', color: 'blue' },
        content: [{ type: 'paragraph', text: 'hi' }],
      }),
      'VALIDATION_ERROR'
    )
  })

  test('accepts header with valid color', async () => {
    const pdf = await render({
      header: { text: 'Header', color: '#336699' },
      content: [{ type: 'paragraph', text: 'hi' }],
    })
    assert.ok(pdf instanceof Uint8Array)
  })
})

// ─── Blockquote validation 5A.8 ───────────────────────────────────────────────

describe('validate — blockquote (5A.8)', () => {
  test('throws VALIDATION_ERROR for empty text', async () => {
    await expectError(
      () => render({ content: [{ type: 'blockquote', text: '' }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for invalid borderColor', async () => {
    await expectError(
      () => render({ content: [{ type: 'blockquote', text: 'hi', borderColor: 'blue' }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for invalid bgColor', async () => {
    await expectError(
      () => render({ content: [{ type: 'blockquote', text: 'hi', bgColor: 'white' }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for negative borderWidth', async () => {
    await expectError(
      () => render({ content: [{ type: 'blockquote', text: 'hi', borderWidth: -1 }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for negative paddingV', async () => {
    await expectError(
      () => render({ content: [{ type: 'blockquote', text: 'hi', paddingV: -1 }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for invalid align', async () => {
    await expectError(
      // @ts-expect-error intentional
      () => render({ content: [{ type: 'blockquote', text: 'hi', align: 'stretch' }] }),
      'VALIDATION_ERROR'
    )
  })

  test('accepts RTL blockquote text (now supported)', async () => {
    const result = await render({ content: [{ type: 'blockquote', text: 'مرحبا' }] })
    assert(result instanceof Uint8Array)
    assert(result.length > 0, 'PDF should have content')
  })

  test('throws FONT_NOT_LOADED for unknown fontFamily', async () => {
    await expectError(
      () => render({ content: [{ type: 'blockquote', text: 'hi', fontFamily: 'NotLoaded' }] }),
      'FONT_NOT_LOADED'
    )
  })

  test('accepts blockquote with all defaults', async () => {
    const pdf = await render({ content: [{ type: 'blockquote', text: 'A wise quote.' }] })
    assert.ok(pdf instanceof Uint8Array)
  })

  test('accepts blockquote with all custom fields', async () => {
    const pdf = await render({
      content: [{
        type: 'blockquote',
        text: 'A custom quote.',
        borderColor: '#cc0000',
        borderWidth: 5,
        bgColor: '#fff3cd',
        color: '#333333',
        fontSize: 11,
        paddingH: 20,
        paddingV: 12,
        align: 'left',
        spaceBefore: 8,
        spaceAfter: 16,
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
  })
})

// ─── Phase 10 — Wave 2 Features ───────────────────────────────────────────────

describe('Phase 10 — Wave 2: numeric bounds validation', () => {
  test('throws VALIDATION_ERROR for paragraph fontSize > 500', async () => {
    await expectError(
      () => render({ content: [{ type: 'paragraph', text: 'hi', fontSize: 501 }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for heading fontSize > 500', async () => {
    await expectError(
      () => render({ content: [{ type: 'heading', level: 1, text: 'hi', fontSize: 501 }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for paragraph lineHeight > 20', async () => {
    await expectError(
      () => render({ content: [{ type: 'paragraph', text: 'hi', fontSize: 12, lineHeight: 21 }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for heading lineHeight > 20', async () => {
    await expectError(
      () => render({ content: [{ type: 'heading', level: 1, text: 'hi', fontSize: 12, lineHeight: 21 }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for paragraph letterSpacing > 200', async () => {
    await expectError(
      () => render({ content: [{ type: 'paragraph', text: 'hi', letterSpacing: 201 }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for heading letterSpacing > 200', async () => {
    await expectError(
      () => render({ content: [{ type: 'heading', level: 1, text: 'hi', letterSpacing: 201 }] }),
      'VALIDATION_ERROR'
    )
  })
})

describe('Phase 10 — Wave 2: heading empty text', () => {
  test('throws VALIDATION_ERROR for heading with empty text string', async () => {
    await expectError(
      () => render({ content: [{ type: 'heading', level: 1, text: '' }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for heading with whitespace-only text', async () => {
    await expectError(
      () => render({ content: [{ type: 'heading', level: 1, text: '   ' }] }),
      'VALIDATION_ERROR'
    )
  })
})

describe('Phase 10 — Wave 2: InlineSpan url + href mutual exclusivity', () => {
  test('throws VALIDATION_ERROR for span with both url and href', async () => {
    await expectError(
      () => render({
        content: [{
          type: 'rich-paragraph',
          spans: [{ text: 'click me', url: 'https://example.com', href: '#section1' }],
        }],
      }),
      'VALIDATION_ERROR'
    )
  })
})

describe('Phase 10 — Wave 2: rich-paragraph dir and letterSpacing validation', () => {
  test('throws VALIDATION_ERROR for rich-paragraph with invalid dir', async () => {
    await expectError(
      // @ts-expect-error intentional
      () => render({ content: [{ type: 'rich-paragraph', spans: [{ text: 'hi' }], dir: 'sideways' }] }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for rich-paragraph with letterSpacing > 200', async () => {
    await expectError(
      () => render({ content: [{ type: 'rich-paragraph', spans: [{ text: 'hi' }], letterSpacing: 300 }] }),
      'VALIDATION_ERROR'
    )
  })
})

describe('Phase 10 — Wave 2: builder validates via render()', () => {
  test('render() with empty heading text throws VALIDATION_ERROR', async () => {
    await expectError(
      () => render({ content: [{ type: 'heading', level: 1, text: '' }] }),
      'VALIDATION_ERROR'
    )
  })
})

describe('Phase 10 — Wave 2: ordered list with 15 items smoke test', () => {
  test('ordered list with 15 items renders successfully', async () => {
    const items = Array.from({ length: 15 }, (_, i) => ({ text: `Item ${i + 1}` }))
    const pdf = await render({ content: [{ type: 'list', style: 'ordered', items }] })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })
})

describe('Phase 10 — Wave 2: defaultParagraphStyle', () => {
  test('doc with defaultParagraphStyle.fontSize = 14 renders successfully', async () => {
    const pdf = await render({
      defaultParagraphStyle: { fontSize: 14 },
      content: [{ type: 'paragraph', text: 'Uses default style' }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })
})

describe('Phase 10 — Wave 2: doc.sections', () => {
  test('doc with sections renders successfully', async () => {
    const pdf = await render({
      sections: [{ fromPage: 1, toPage: 1, header: { text: 'Page 1 only' } }],
      content: [{ type: 'paragraph', text: 'hello' }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })

  test('throws VALIDATION_ERROR for section with fromPage: 0', async () => {
    await expectError(
      () => render({
        sections: [{ fromPage: 0, toPage: 1, header: { text: 'bad' } }],
        content: [{ type: 'paragraph', text: 'hi' }],
      }),
      'VALIDATION_ERROR'
    )
  })

  test('throws VALIDATION_ERROR for section with fromPage > toPage', async () => {
    await expectError(
      () => render({
        sections: [{ fromPage: 3, toPage: 1, header: { text: 'bad' } }],
        content: [{ type: 'paragraph', text: 'hi' }],
      }),
      'VALIDATION_ERROR'
    )
  })
})

describe('Phase 10 — Wave 2: tabularNumbers on rich-paragraph', () => {
  test('rich-paragraph with tabularNumbers: true renders without error', async () => {
    const pdf = await render({
      content: [{
        type: 'rich-paragraph',
        spans: [{ text: '1234567890' }],
        tabularNumbers: true,
      }],
    })
    assert.ok(pdf instanceof Uint8Array)
    assert.ok(pdf.byteLength > 0)
  })
})
