/**
 * Plugin registry — orchestration helpers for the 4 injection points.
 *
 * All functions are pure (no module-level state). The plugin list is
 * threaded through the pipeline via RenderOptions and passed explicitly.
 *
 * @internal Not part of the public API. Import PluginDefinition from plugin-types.ts.
 */
import { PretextPdfError } from './errors.js';
// ─── Lookup ───────────────────────────────────────────────────────────────────
/**
 * Return the first plugin whose `type` matches `elementType`, or `undefined`.
 * @internal
 */
export function findPlugin(plugins, elementType) {
    return plugins.find(p => p.type === elementType);
}
// ─── Stage 1: validate ────────────────────────────────────────────────────────
/**
 * Run a plugin's optional `validate` hook.
 * Returns the rejection message if the hook rejects, or `undefined` if accepted.
 */
export function runPluginValidate(plugin, element) {
    if (!plugin.validate)
        return undefined;
    const result = plugin.validate(element);
    // Normalize: only non-empty strings are rejections; '' and void are acceptance
    return typeof result === 'string' && result.length > 0 ? result : undefined;
}
// ─── Stage 2b: load assets ────────────────────────────────────────────────────
/**
 * Run a plugin's optional `loadAsset` hook and return the resulting PDFImage key
 * if an image was embedded.
 *
 * Callers are responsible for setting `imageMap.set(key, image)` with the returned image.
 */
export async function runPluginLoadAsset(plugin, element, pdfDoc, contentWidth, contentIndex) {
    if (!plugin.loadAsset)
        return undefined;
    const image = await plugin.loadAsset(element, pdfDoc, contentWidth);
    if (!image)
        return undefined;
    const key = `${plugin.type}-${contentIndex}`;
    return { key, image };
}
// ─── Stage 3: measure ─────────────────────────────────────────────────────────
/**
 * Run a plugin's `measure` hook and wrap the result into a `MeasuredBlock`.
 */
export async function runPluginMeasure(plugin, element, context, pluginImageKey) {
    let result;
    try {
        result = await plugin.measure(element, context);
    }
    catch (err) {
        throw new PretextPdfError('RENDER_FAILED', `Plugin '${plugin.type}' measure hook threw: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (typeof result.height !== 'number' || !isFinite(result.height) || result.height < 0) {
        throw new PretextPdfError('RENDER_FAILED', `Plugin '${plugin.type}' measure hook returned invalid height: ${result.height}. Must be a finite non-negative number.`);
    }
    const block = {
        element: element,
        height: result.height,
        lines: [],
        fontSize: 0,
        lineHeight: 0,
        fontKey: '',
        spaceAfter: result.spaceAfter ?? 0,
        spaceBefore: result.spaceBefore ?? 0,
        pluginData: result.pluginData,
    };
    if (pluginImageKey !== undefined)
        block.pluginImageKey = pluginImageKey;
    return block;
}
// ─── Stage 5: render ──────────────────────────────────────────────────────────
/**
 * Run a plugin's `render` hook with the fully-assembled render context.
 * Wraps thrown errors in RENDER_FAILED so callers see a consistent error type.
 */
export function runPluginRender(plugin, block, pdfPage, pdfDoc, x, y, geo, imageMap) {
    const pdfImage = block.pluginImageKey ? imageMap.get(block.pluginImageKey) : undefined;
    const ctx = {
        element: block.element,
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
    };
    try {
        plugin.render(ctx);
    }
    catch (err) {
        throw new PretextPdfError('RENDER_FAILED', `Plugin '${plugin.type}' render hook threw: ${err instanceof Error ? err.message : String(err)}`);
    }
}
//# sourceMappingURL=plugin-registry.js.map