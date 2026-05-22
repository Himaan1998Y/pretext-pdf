/**
 * render-blocks/index.ts — Barrel re-export for element-level rendering functions.
 * All 14 render functions previously lived in src/render-blocks.ts.
 */

export { renderTextBlock } from './text.js'
export { renderListItem } from './list-item.js'
export { renderTable } from './table.js'
export { renderImage, renderFloatBlock, renderFloatGroup } from './image.js'
export { renderHR } from './hr.js'
export { renderCodeBlock } from './code.js'
export { renderBlockquote } from './blockquote.js'
export { renderCallout } from './callout.js'
export { renderRichParagraph } from './rich.js'
export { renderFootnoteZone } from './footnote.js'
export { renderHeaderFooter } from './header-footer.js'
export { renderWatermark } from './watermark.js'
