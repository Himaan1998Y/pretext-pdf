/**
 * Batch C — Plugin Registry tests
 *
 * Covers the 4 injection points:
 *  1. validate.ts default arm
 *  2. assets.ts loadImages loop
 *  3. measure.ts else branch
 *  4. render.ts default arm
 *
 * Tests run against the full render() pipeline so the contract is end-to-end.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import type { PluginDefinition, PluginMeasureContext, PluginMeasureResult, PluginRenderContext } from '../src/plugin-types.js'
import { validate } from '../src/validate.js'
import { render } from '../src/index.js'
import type { PdfDocument, RenderOptions } from '../src/index.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minDoc(extraContent: unknown[] = []): PdfDocument {
  return {
    content: [
      { type: 'paragraph', text: 'hello' },
      ...extraContent as PdfDocument['content'],
    ],
  }
}

function makeBoxPlugin(
  overrides: Partial<PluginDefinition> = {}
): PluginDefinition {
  return {
    type: 'custom-box',
    measure: async (_el, _ctx: PluginMeasureContext): Promise<PluginMeasureResult> => ({
      height: 40,
      spaceBefore: 4,
      spaceAfter: 4,
    }),
    render: (_ctx: PluginRenderContext): void => {
      // intentionally empty — drawing on PDFPage not needed for most tests
    },
    ...overrides,
  }
}

// ─── PluginDefinition shape ───────────────────────────────────────────────────

describe('PluginDefinition interface', () => {
  test('a minimal plugin with measure+render compiles and is usable', () => {
    const plugin = makeBoxPlugin()
    assert.strictEqual(plugin.type, 'custom-box')
    assert.strictEqual(typeof plugin.measure, 'function')
    assert.strictEqual(typeof plugin.render, 'function')
  })

  test('optional fields (validate, loadAsset) default to undefined', () => {
    const plugin = makeBoxPlugin()
    assert.strictEqual(plugin.validate, undefined)
    assert.strictEqual(plugin.loadAsset, undefined)
  })

  test('validate hook is called with the raw element object', () => {
    let received: Record<string, unknown> | undefined
    const plugin = makeBoxPlugin({
      validate: (el) => {
        received = el
      },
    })
    plugin.validate!({ type: 'custom-box', label: 'hi' })
    assert.deepEqual(received, { type: 'custom-box', label: 'hi' })
  })

  test('validate hook can reject by returning a string', () => {
    const plugin = makeBoxPlugin({
      validate: () => 'label is required',
    })
    const result = plugin.validate!({ type: 'custom-box' })
    assert.strictEqual(result, 'label is required')
  })

  test('loadAsset is typed as optional async function', () => {
    const plugin = makeBoxPlugin({
      loadAsset: async (_el, _pdfDoc, _w) => undefined,
    })
    assert.strictEqual(typeof plugin.loadAsset, 'function')
  })
})

// ─── validate() injection point ───────────────────────────────────────────────

describe('validate() — plugin injection point', () => {
  test('unknown type with no plugins throws VALIDATION_ERROR', () => {
    const doc = minDoc([{ type: 'unknown-thing', data: 1 }])
    assert.throws(
      () => validate(doc),
      (err: unknown) => {
        assert.ok(err instanceof Error)
        assert.ok(err.message.includes("unknown element type 'unknown-thing'"))
        return true
      }
    )
  })

  test('plugin type passes validation when plugin is registered', () => {
    const plugin = makeBoxPlugin()
    const doc = minDoc([{ type: 'custom-box', label: 'hi' }])
    const options: RenderOptions = { plugins: [plugin] }
    // Must not throw
    assert.doesNotThrow(() => validate(doc, options))
  })

  test('plugin validate hook rejection propagates as VALIDATION_ERROR', () => {
    const plugin = makeBoxPlugin({
      validate: () => 'label is required',
    })
    const doc = minDoc([{ type: 'custom-box' }])
    const options: RenderOptions = { plugins: [plugin] }
    assert.throws(
      () => validate(doc, options),
      (err: unknown) => {
        assert.ok(err instanceof Error)
        assert.ok(err.message.includes('label is required'), `expected message to include 'label is required', got: ${(err as Error).message}`)
        return true
      }
    )
  })

  test('plugin validate hook returning void/undefined passes validation', () => {
    const plugin = makeBoxPlugin({
      validate: (_el) => undefined,
    })
    const doc = minDoc([{ type: 'custom-box', label: 'ok' }])
    const options: RenderOptions = { plugins: [plugin] }
    assert.doesNotThrow(() => validate(doc, options))
  })

  test('multiple plugins — only the matching type plugin is checked', () => {
    const pluginA = makeBoxPlugin({ type: 'type-a' })
    const pluginB: PluginDefinition = {
      type: 'type-b',
      validate: () => 'B always fails',
      measure: async () => ({ height: 10 }),
      render: () => {},
    }
    const doc = minDoc([{ type: 'type-a' }])
    const options: RenderOptions = { plugins: [pluginA, pluginB] }
    // type-b plugin's validate should not run for type-a elements
    assert.doesNotThrow(() => validate(doc, options))
  })
})

// ─── measure() + render() pipeline integration ────────────────────────────────

describe('Plugin pipeline integration', () => {
  test('render() with a plugin type produces valid PDF bytes', async () => {
    const plugin = makeBoxPlugin()
    const doc: PdfDocument = {
      content: [
        { type: 'paragraph', text: 'before' },
        { type: 'custom-box' } as unknown as PdfDocument['content'][0],
        { type: 'paragraph', text: 'after' },
      ],
    }
    const bytes = await render(doc, { plugins: [plugin] })
    assert.ok(bytes instanceof Uint8Array)
    assert.ok(bytes.length > 100, 'PDF should be larger than 100 bytes')
    // Check PDF magic bytes
    assert.strictEqual(bytes[0], 0x25) // %
    assert.strictEqual(bytes[1], 0x50) // P
    assert.strictEqual(bytes[2], 0x44) // D
    assert.strictEqual(bytes[3], 0x46) // F
  })

  test('measure hook receives correct context', async () => {
    let capturedCtx: PluginMeasureContext | undefined
    const plugin = makeBoxPlugin({
      measure: async (_el, ctx) => {
        capturedCtx = ctx
        return { height: 40 }
      },
    })
    const doc: PdfDocument = {
      content: [{ type: 'custom-box' } as unknown as PdfDocument['content'][0]],
    }
    await render(doc, { plugins: [plugin] })
    assert.ok(capturedCtx !== undefined)
    assert.ok(typeof capturedCtx!.contentWidth === 'number', 'contentWidth should be a number')
    assert.ok(capturedCtx!.contentWidth > 0, 'contentWidth should be positive')
    assert.ok(typeof capturedCtx!.contentHeight === 'number', 'contentHeight should be a number')
    assert.ok(capturedCtx!.contentHeight > 0, 'contentHeight should be positive')
    assert.ok(capturedCtx!.doc !== undefined, 'doc should be present')
  })

  test('pluginData flows from measure to render', async () => {
    let capturedRenderCtx: PluginRenderContext | undefined
    const plugin: PluginDefinition = {
      type: 'custom-box',
      measure: async (_el, _ctx) => ({
        height: 50,
        pluginData: { color: '#ff0000', radius: 8 },
      }),
      render: (ctx) => {
        capturedRenderCtx = ctx
      },
    }
    const doc: PdfDocument = {
      content: [{ type: 'custom-box' } as unknown as PdfDocument['content'][0]],
    }
    await render(doc, { plugins: [plugin] })
    assert.ok(capturedRenderCtx !== undefined)
    assert.deepEqual(capturedRenderCtx!.pluginData, { color: '#ff0000', radius: 8 })
  })

  test('render hook receives x/y/width/height geometry', async () => {
    let capturedRenderCtx: PluginRenderContext | undefined
    const plugin: PluginDefinition = {
      type: 'custom-box',
      measure: async () => ({ height: 50 }),
      render: (ctx) => { capturedRenderCtx = ctx },
    }
    const doc: PdfDocument = {
      content: [{ type: 'custom-box' } as unknown as PdfDocument['content'][0]],
    }
    await render(doc, { plugins: [plugin] })
    assert.ok(capturedRenderCtx !== undefined)
    assert.ok(typeof capturedRenderCtx!.x === 'number')
    assert.ok(typeof capturedRenderCtx!.y === 'number')
    assert.ok(typeof capturedRenderCtx!.width === 'number')
    assert.ok(capturedRenderCtx!.width > 0)
    assert.strictEqual(capturedRenderCtx!.height, 50)
  })

  test('render hook receives element and pdfDoc', async () => {
    let capturedRenderCtx: PluginRenderContext | undefined
    const plugin: PluginDefinition = {
      type: 'custom-box',
      measure: async () => ({ height: 30 }),
      render: (ctx) => { capturedRenderCtx = ctx },
    }
    const customElement = { type: 'custom-box', label: 'test-label' }
    const doc: PdfDocument = {
      content: [customElement as unknown as PdfDocument['content'][0]],
    }
    await render(doc, { plugins: [plugin] })
    assert.ok(capturedRenderCtx !== undefined)
    assert.ok(capturedRenderCtx!.pdfDoc !== undefined)
    assert.ok(capturedRenderCtx!.pdfPage !== undefined)
    assert.deepEqual(capturedRenderCtx!.element, customElement)
  })

  test('loadAsset hook embeds image into imageMap and pdfImage is provided to render', async () => {
    let renderReceivedImage = false
    const plugin: PluginDefinition = {
      type: 'custom-image-box',
      loadAsset: async (_el, pdfDoc, _w) => {
        // Create a minimal 1x1 PNG for embedding
        const pngBytes = new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
          0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk length + type
          0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
          0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // 8-bit RGB, CRC
          0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT
          0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, // compressed data
          0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, // CRC
          0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND
          0x44, 0xae, 0x42, 0x60, 0x82, // IEND CRC
        ])
        return pdfDoc.embedPng(pngBytes)
      },
      measure: async () => ({ height: 30 }),
      render: (ctx) => {
        renderReceivedImage = ctx.pdfImage !== undefined
      },
    }
    const doc: PdfDocument = {
      content: [{ type: 'custom-image-box' } as unknown as PdfDocument['content'][0]],
    }
    await render(doc, { plugins: [plugin] })
    assert.ok(renderReceivedImage, 'render should have received the embedded pdfImage')
  })

  test('plugin type without loadAsset has no pdfImage in render', async () => {
    let capturedImage: unknown = 'not-called'
    const plugin: PluginDefinition = {
      type: 'custom-box',
      measure: async () => ({ height: 20 }),
      render: (ctx) => { capturedImage = ctx.pdfImage },
    }
    const doc: PdfDocument = {
      content: [{ type: 'custom-box' } as unknown as PdfDocument['content'][0]],
    }
    await render(doc, { plugins: [plugin] })
    assert.strictEqual(capturedImage, undefined)
  })

  test('no plugins — render() still works normally', async () => {
    const doc: PdfDocument = {
      content: [{ type: 'paragraph', text: 'hello world' }],
    }
    const bytes = await render(doc)
    assert.ok(bytes instanceof Uint8Array)
    assert.ok(bytes.length > 100)
  })

  test('multiple plugin types in one document', async () => {
    const callLog: string[] = []
    const pluginA: PluginDefinition = {
      type: 'box-a',
      measure: async () => { callLog.push('measure-a'); return { height: 20 } },
      render: () => { callLog.push('render-a') },
    }
    const pluginB: PluginDefinition = {
      type: 'box-b',
      measure: async () => { callLog.push('measure-b'); return { height: 30 } },
      render: () => { callLog.push('render-b') },
    }
    const doc: PdfDocument = {
      content: [
        { type: 'box-a' } as unknown as PdfDocument['content'][0],
        { type: 'box-b' } as unknown as PdfDocument['content'][0],
        { type: 'box-a' } as unknown as PdfDocument['content'][0],
      ],
    }
    await render(doc, { plugins: [pluginA, pluginB] })
    assert.ok(callLog.includes('measure-a'), 'box-a measure called')
    assert.ok(callLog.includes('measure-b'), 'box-b measure called')
    assert.ok(callLog.includes('render-a'), 'box-a render called')
    assert.ok(callLog.includes('render-b'), 'box-b render called')
    assert.strictEqual(callLog.filter(x => x === 'measure-a').length, 2)
    assert.strictEqual(callLog.filter(x => x === 'render-a').length, 2)
  })
})

// ─── plugin-registry helpers (unit level) ─────────────────────────────────────

describe('plugin-registry helpers', () => {
  test('findPlugin returns the matching plugin by type', async () => {
    const { findPlugin } = await import('../src/plugin-registry.js')
    const plugins: PluginDefinition[] = [
      makeBoxPlugin({ type: 'type-a' }),
      makeBoxPlugin({ type: 'type-b' }),
    ]
    assert.strictEqual(findPlugin(plugins, 'type-a')!.type, 'type-a')
    assert.strictEqual(findPlugin(plugins, 'type-b')!.type, 'type-b')
    assert.strictEqual(findPlugin(plugins, 'type-c'), undefined)
  })

  test('findPlugin returns undefined for empty array', async () => {
    const { findPlugin } = await import('../src/plugin-registry.js')
    assert.strictEqual(findPlugin([], 'anything'), undefined)
  })
})

// ─── Edge cases and error paths ───────────────────────────────────────────────

describe('Plugin edge cases and error paths', () => {
  // ── validate ──

  test('validate: empty string return is treated as acceptance (not rejection)', () => {
    const plugin = makeBoxPlugin({ validate: () => '' as unknown as void })
    const doc = minDoc([{ type: 'custom-box' }])
    assert.doesNotThrow(() => validate(doc, { plugins: [plugin] }))
  })

  test('validate: undefined return accepts element', () => {
    const plugin = makeBoxPlugin({ validate: () => undefined })
    const doc = minDoc([{ type: 'custom-box' }])
    assert.doesNotThrow(() => validate(doc, { plugins: [plugin] }))
  })

  // ── Y coordinate ──

  test('render hook y is a pdf-lib coord (positive number within page height)', async () => {
    let capturedY: number | undefined
    const plugin: PluginDefinition = {
      type: 'custom-box',
      measure: async () => ({ height: 50 }),
      render: (ctx) => { capturedY = ctx.y },
    }
    const doc: PdfDocument = {
      content: [{ type: 'custom-box' } as unknown as PdfDocument['content'][0]],
    }
    await render(doc, { plugins: [plugin] })
    assert.ok(capturedY !== undefined)
    // pdf-lib page default is 792pt tall (US Letter); y must be within [0, pageHeight]
    assert.ok(capturedY! > 0, `y (${capturedY}) should be > 0`)
    assert.ok(capturedY! <= 792, `y (${capturedY}) should not exceed page height`)
    // The first element starts below the top margin (72pt default), so y < pageHeight - margin
    assert.ok(capturedY! < 792, `y (${capturedY}) must be below the page top`)
  })

  test('render hook y decreases for elements lower on the page', async () => {
    const yValues: number[] = []
    const plugin: PluginDefinition = {
      type: 'stack-box',
      measure: async () => ({ height: 60, spaceAfter: 0 }),
      render: (ctx) => { yValues.push(ctx.y) },
    }
    const doc: PdfDocument = {
      content: [
        { type: 'stack-box' } as unknown as PdfDocument['content'][0],
        { type: 'stack-box' } as unknown as PdfDocument['content'][0],
        { type: 'stack-box' } as unknown as PdfDocument['content'][0],
      ],
    }
    await render(doc, { plugins: [plugin] })
    assert.strictEqual(yValues.length, 3, 'render called once per element')
    // Each successive block is lower on the page → smaller pdf-lib y
    assert.ok(yValues[0]! > yValues[1]!, `first y (${yValues[0]}) should be above second (${yValues[1]})`)
    assert.ok(yValues[1]! > yValues[2]!, `second y (${yValues[1]}) should be above third (${yValues[2]})`)
  })

  // ── measure error paths ──

  test('measure hook throwing wraps error in RENDER_FAILED', async () => {
    const plugin: PluginDefinition = {
      type: 'bad-measure',
      measure: async () => { throw new Error('measure exploded') },
      render: () => {},
    }
    const doc: PdfDocument = {
      content: [{ type: 'bad-measure' } as unknown as PdfDocument['content'][0]],
    }
    await assert.rejects(
      () => render(doc, { plugins: [plugin] }),
      (err: unknown) => {
        assert.ok(err instanceof Error)
        assert.ok(err.message.includes('measure exploded'), `got: ${(err as Error).message}`)
        return true
      }
    )
  })

  test('measure hook returning negative height throws RENDER_FAILED', async () => {
    const plugin: PluginDefinition = {
      type: 'bad-height',
      measure: async () => ({ height: -1 }),
      render: () => {},
    }
    const doc: PdfDocument = {
      content: [{ type: 'bad-height' } as unknown as PdfDocument['content'][0]],
    }
    await assert.rejects(
      () => render(doc, { plugins: [plugin] }),
      (err: unknown) => {
        assert.ok(err instanceof Error)
        assert.ok(err.message.includes('invalid height'), `got: ${(err as Error).message}`)
        return true
      }
    )
  })

  test('measure hook returning height: 0 is accepted (zero-height spacer)', async () => {
    const plugin: PluginDefinition = {
      type: 'zero-box',
      measure: async () => ({ height: 0 }),
      render: () => {},
    }
    const doc: PdfDocument = {
      content: [{ type: 'zero-box' } as unknown as PdfDocument['content'][0]],
    }
    const bytes = await render(doc, { plugins: [plugin] })
    assert.ok(bytes instanceof Uint8Array && bytes.length > 100)
  })

  // ── render error paths ──

  test('render hook throwing wraps error in RENDER_FAILED', async () => {
    const plugin: PluginDefinition = {
      type: 'bad-render',
      measure: async () => ({ height: 30 }),
      render: () => { throw new Error('render exploded') },
    }
    const doc: PdfDocument = {
      content: [{ type: 'bad-render' } as unknown as PdfDocument['content'][0]],
    }
    await assert.rejects(
      () => render(doc, { plugins: [plugin] }),
      (err: unknown) => {
        assert.ok(err instanceof Error)
        assert.ok(err.message.includes('render exploded'), `got: ${(err as Error).message}`)
        return true
      }
    )
  })

  // ── duplicate type ──

  test('duplicate plugin types — first registration wins silently', async () => {
    const callLog: string[] = []
    const plugin1: PluginDefinition = {
      type: 'dupe-box',
      measure: async () => ({ height: 20 }),
      render: () => { callLog.push('first') },
    }
    const plugin2: PluginDefinition = {
      type: 'dupe-box',
      measure: async () => ({ height: 20 }),
      render: () => { callLog.push('second') },
    }
    const doc: PdfDocument = {
      content: [{ type: 'dupe-box' } as unknown as PdfDocument['content'][0]],
    }
    await render(doc, { plugins: [plugin1, plugin2] })
    assert.deepEqual(callLog, ['first'])
  })
})

// ─── loadAsset error handling ─────────────────────────────────────────────────

describe('loadAsset error paths', () => {
  test('loadAsset that throws a non-PretextPdfError is silently logged', async () => {
    const logWarnCalls: string[] = []
    const originalWarn = console.warn
    console.warn = (msg: string) => { logWarnCalls.push(msg) }
    try {
      const plugin: PluginDefinition = {
        type: 'bad-loader',
        loadAsset: async () => {
          throw new Error('PNG loading failed')
        },
        measure: async () => ({ height: 40 }),
        render: () => { },
      }
      const doc: PdfDocument = {
        content: [{ type: 'bad-loader' } as unknown as PdfDocument['content'][0]],
      }
      // Should not throw — error is logged instead
      const bytes = await render(doc, { plugins: [plugin] })
      assert.ok(bytes instanceof Uint8Array)
      // Verify the error was logged
      assert.ok(logWarnCalls.some(msg => msg.includes('PNG loading failed')))
    } finally {
      console.warn = originalWarn
    }
  })

  test('loadAsset returning undefined does not embed an image', async () => {
    let renderReceivedImage = false
    const plugin: PluginDefinition = {
      type: 'custom-no-image',
      loadAsset: async () => undefined,
      measure: async () => ({ height: 40 }),
      render: (ctx: PluginRenderContext) => {
        renderReceivedImage = ctx.pdfImage !== undefined
      },
    }
    const doc: PdfDocument = {
      content: [{ type: 'custom-no-image' } as unknown as PdfDocument['content'][0]],
    }
    await render(doc, { plugins: [plugin] })
    assert.strictEqual(renderReceivedImage, false)
  })

  test('loadAsset can conditionally load based on element properties', async () => {
    const loadedAssets: string[] = []
    const plugin: PluginDefinition = {
      type: 'conditional-image',
      loadAsset: async (el) => {
        const src = (el as { src?: string }).src
        if (src && src.endsWith('.png')) {
          loadedAssets.push(src)
          return undefined
        }
        return undefined
      },
      measure: async () => ({ height: 40 }),
      render: () => { },
    }
    const doc: PdfDocument = {
      content: [
        { type: 'conditional-image', src: 'image.png' } as unknown as PdfDocument['content'][0],
        { type: 'conditional-image', src: 'image.jpg' } as unknown as PdfDocument['content'][0],
      ],
    }
    await render(doc, { plugins: [plugin] })
    assert.deepEqual(loadedAssets, ['image.png'])
  })
})
