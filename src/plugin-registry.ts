/**
 * Plugin registry — orchestration helpers for the 4 injection points.
 *
 * All functions are pure (no module-level state). The plugin list is
 * threaded through the pipeline via RenderOptions and passed explicitly.
 */

import type { PluginDefinition, PluginMeasureContext, PluginMeasureResult, PluginRenderContext } from './plugin-types.js'
import type { MeasuredBlock, PageGeometry } from './types-internal.js'
import { PretextPdfError } from './errors.js'

// ─── Lookup ───────────────────────────────────────────────────────────────────

/**
 * Return the first plugin whose `type` matches `elementType`, or `undefined`.
 * @public
 */
export function findPlugin(
  plugins: PluginDefinition[],
  elementType: string
): PluginDefinition | undefined {
  return plugins.find(p => p.type === elementType)
}

// ─── Stage 1: validate ────────────────────────────────────────────────────────

/**
 * Run a plugin's optional `validate` hook.
 * Returns the rejection message if the hook rejects, or `undefined` if accepted.
 */
export function runPluginValidate(
  plugin: PluginDefinition,
  element: Record<string, unknown>
): string | undefined {
  if (!plugin.validate) return undefined
  const result = plugin.validate(element)
  return typeof result === 'string' ? result : undefined
}

// ─── Stage 2b: load assets ────────────────────────────────────────────────────

/**
 * Run a plugin's optional `loadAsset` hook and return the resulting PDFImage key
 * if an image was embedded.
 *
 * Callers are responsible for setting `imageMap.set(key, image)` with the returned image.
 */
export async function runPluginLoadAsset(
  plugin: PluginDefinition,
  element: Record<string, unknown>,
  pdfDoc: import('@cantoo/pdf-lib').PDFDocument,
  contentWidth: number,
  contentIndex: number
): Promise<{ key: string; image: import('@cantoo/pdf-lib').PDFImage } | undefined> {
  if (!plugin.loadAsset) return undefined
  const image = await plugin.loadAsset(element, pdfDoc, contentWidth)
  if (!image) return undefined
  const key = `${plugin.type}-${contentIndex}`
  return { key, image }
}

// ─── Stage 3: measure ─────────────────────────────────────────────────────────

/**
 * Run a plugin's `measure` hook and wrap the result into a `MeasuredBlock`.
 */
export async function runPluginMeasure(
  plugin: PluginDefinition,
  element: Record<string, unknown>,
  context: PluginMeasureContext,
  pluginImageKey?: string
): Promise<MeasuredBlock> {
  let result: PluginMeasureResult
  try {
    result = await plugin.measure(element, context)
  } catch (err) {
    throw new PretextPdfError(
      'RENDER_FAILED',
      `Plugin '${plugin.type}' measure hook threw: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (typeof result.height !== 'number' || !isFinite(result.height) || result.height < 0) {
    throw new PretextPdfError(
      'RENDER_FAILED',
      `Plugin '${plugin.type}' measure hook returned invalid height: ${result.height}. Must be a finite non-negative number.`
    )
  }

  const block: MeasuredBlock = {
    element: element as unknown as MeasuredBlock['element'],
    height: result.height,
    lines: [],
    fontSize: 0,
    lineHeight: 0,
    fontKey: '',
    spaceAfter: result.spaceAfter ?? 0,
    spaceBefore: result.spaceBefore ?? 0,
    pluginData: result.pluginData,
  }
  if (pluginImageKey !== undefined) block.pluginImageKey = pluginImageKey
  return block
}

// ─── Stage 5: render ──────────────────────────────────────────────────────────

/**
 * Run a plugin's `render` hook with the fully-assembled render context.
 */
export function runPluginRender(
  plugin: PluginDefinition,
  block: MeasuredBlock,
  pdfPage: import('@cantoo/pdf-lib').PDFPage,
  pdfDoc: import('@cantoo/pdf-lib').PDFDocument,
  x: number,
  y: number,
  geo: PageGeometry,
  imageMap: import('./types-internal.js').ImageMap
): void {
  const pdfImage = block.pluginImageKey ? imageMap.get(block.pluginImageKey) : undefined
  const ctx: PluginRenderContext = {
    element: block.element as unknown as Record<string, unknown>,
    pdfPage,
    pdfDoc,
    pageWidth: geo.pageWidth,
    pageHeight: geo.pageHeight,
    margins: geo.margins,
    x,
    y,
    width: geo.contentWidth,
    height: block.height,
    pluginData: block.pluginData,
    ...(pdfImage !== undefined ? { pdfImage } : {}),
  }
  try {
    plugin.render(ctx)
  } catch (err) {
    throw new PretextPdfError(
      'RENDER_FAILED',
      `Plugin '${plugin.type}' render hook threw: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}
