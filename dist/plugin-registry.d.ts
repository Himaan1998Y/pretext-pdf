/**
 * Plugin registry — orchestration helpers for the 4 injection points.
 *
 * All functions are pure (no module-level state). The plugin list is
 * threaded through the pipeline via RenderOptions and passed explicitly.
 *
 * @internal Not part of the public API. Import PluginDefinition from plugin-types.ts.
 */
import type { PluginDefinition, PluginMeasureContext } from './plugin-types.js';
import type { MeasuredBlock, PageGeometry } from './types-internal.js';
/**
 * Return the first plugin whose `type` matches `elementType`, or `undefined`.
 * @internal
 */
export declare function findPlugin(plugins: PluginDefinition[], elementType: string): PluginDefinition | undefined;
/**
 * Run a plugin's optional `validate` hook.
 * Returns the rejection message if the hook rejects, or `undefined` if accepted.
 */
export declare function runPluginValidate(plugin: PluginDefinition, element: Record<string, unknown>): string | undefined;
/**
 * Run a plugin's optional `loadAsset` hook and return the resulting PDFImage key
 * if an image was embedded.
 *
 * Callers are responsible for setting `imageMap.set(key, image)` with the returned image.
 */
export declare function runPluginLoadAsset(plugin: PluginDefinition, element: Record<string, unknown>, pdfDoc: import('@cantoo/pdf-lib').PDFDocument, contentWidth: number, contentIndex: number): Promise<{
    key: string;
    image: import('@cantoo/pdf-lib').PDFImage;
} | undefined>;
/**
 * Run a plugin's `measure` hook and wrap the result into a `MeasuredBlock`.
 */
export declare function runPluginMeasure(plugin: PluginDefinition, element: Record<string, unknown>, context: PluginMeasureContext, pluginImageKey?: string): Promise<MeasuredBlock>;
/**
 * Run a plugin's `render` hook with the fully-assembled render context.
 * Wraps thrown errors in RENDER_FAILED so callers see a consistent error type.
 */
export declare function runPluginRender(plugin: PluginDefinition, block: MeasuredBlock, pdfPage: import('@cantoo/pdf-lib').PDFPage, pdfDoc: import('@cantoo/pdf-lib').PDFDocument, x: number, y: number, geo: PageGeometry, imageMap: import('./types-internal.js').ImageMap): void;
//# sourceMappingURL=plugin-registry.d.ts.map