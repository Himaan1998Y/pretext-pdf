/**
 * Plugin extension points for pretext-pdf.
 *
 * Register custom element types by passing an array of `PluginDefinition` objects
 * in `RenderOptions.plugins`. Each definition handles one `type` string.
 *
 * @example
 * ```ts
 * import { render } from 'pretext-pdf'
 * import type { PluginDefinition } from 'pretext-pdf/plugin-types'
 *
 * const boxPlugin: PluginDefinition = {
 *   type: 'highlight-box',
 *   measure: async (el, { contentWidth }) => ({ height: 50, spaceBefore: 8, spaceAfter: 8 }),
 *   render: ({ pdfPage, x, y, width, height }) => {
 *     pdfPage.drawRectangle({ x, y: y - height, width, height, color: rgb(1, 0.9, 0.8) })
 *   },
 * }
 *
 * const bytes = await render(doc, { plugins: [boxPlugin] })
 * ```
 *
 * @module
 * @beta
 */
export {};
//# sourceMappingURL=plugin-types.js.map