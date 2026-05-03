import { PretextPdfError } from './errors.js';
import { paginate } from './paginate.js';
const SEPARATOR_HEIGHT = 16; // separator line + padding above/below
/** Build document-order footnote numbering by scanning rich-paragraphs in content order. */
export function buildFootnoteNumbering(content) {
    const numbering = new Map();
    let counter = 1;
    for (const el of content) {
        if (el.type === 'rich-paragraph') {
            for (const span of el.spans) {
                if (span.footnoteRef && !numbering.has(span.footnoteRef)) {
                    numbering.set(span.footnoteRef, counter++);
                }
            }
        }
    }
    return numbering;
}
/**
 * Two-pass footnote pagination.
 *
 * Pass 1: paginate without zone reservation to find which refs land on which page.
 * Pass 2: paginate with per-page zones reserved at the bottom.
 * Returns the final PaginatedDocument with footnoteItems and footnoteZoneHeight annotated.
 */
export function runFootnoteTwoPass(measuredBlocks, contentHeight, paginateConfig, doc) {
    const footnoteDefElements = doc.content.filter(el => el.type === 'footnote-def');
    if (footnoteDefElements.length === 0) {
        return paginate(measuredBlocks, contentHeight, paginateConfig);
    }
    // Build a map of def id → measured height (already measured in measuredBlocks)
    const footnoteDefHeightMap = new Map();
    for (const block of measuredBlocks) {
        if (block.element.type === 'footnote-def') {
            const def = block.element;
            footnoteDefHeightMap.set(def.id, block.height + (block.spaceAfter ?? 0));
        }
    }
    // Strip footnote-def blocks from the block stream (defs are not placed in flow)
    const flowBlocks = measuredBlocks.filter(b => b.element.type !== 'footnote-def');
    // Build document-order footnote numbering before pagination (controls rendering order)
    const footnoteNumbering = buildFootnoteNumbering(doc.content);
    // PASS 1: Paginate without any footnote zone reservation
    const pass1 = paginate(flowBlocks, contentHeight, paginateConfig);
    // Determine which footnote refs land on which page
    const pageFootnoteRefs = new Map();
    for (let pageIdx = 0; pageIdx < pass1.pages.length; pageIdx++) {
        const page = pass1.pages[pageIdx];
        const refsOnPageSet = new Set();
        for (const pagedBlock of page.blocks) {
            const el = pagedBlock.measuredBlock.element;
            if (el.type === 'rich-paragraph') {
                for (const span of el.spans) {
                    if (span.footnoteRef)
                        refsOnPageSet.add(span.footnoteRef);
                }
            }
        }
        if (refsOnPageSet.size > 0) {
            pageFootnoteRefs.set(pageIdx, [...refsOnPageSet]);
        }
    }
    // Build per-page footnote zone heights
    const footnoteZones = new Map();
    for (const [pageIdx, refIds] of pageFootnoteRefs) {
        let zoneHeight = SEPARATOR_HEIGHT;
        for (const refId of refIds) {
            zoneHeight += footnoteDefHeightMap.get(refId) ?? 0;
        }
        footnoteZones.set(pageIdx, zoneHeight);
    }
    // PASS 2: Paginate with zones reserved
    const pass2Config = { ...paginateConfig, footnoteZones };
    const paginatedDoc = paginate(flowBlocks, contentHeight, pass2Config);
    paginatedDoc.footnoteNumbering = footnoteNumbering;
    // Annotate each RenderedPage with its footnote items
    for (const [pageIdx, refIds] of pageFootnoteRefs) {
        if (pageIdx >= paginatedDoc.pages.length) {
            throw new PretextPdfError('PAGINATION_FAILED', `Footnote zone computed for page ${pageIdx} but document only has ${paginatedDoc.pages.length} pages. This is a pagination bug.`);
        }
        const page = paginatedDoc.pages[pageIdx];
        if (!page) {
            throw new PretextPdfError('PAGINATION_FAILED', `Footnote zone computed for page ${pageIdx} but document only has ${paginatedDoc.pages.length} pages. This is a pagination bug.`);
        }
        page.footnoteItems = refIds
            .map(id => {
            const def = footnoteDefElements.find(d => d.id === id);
            const num = footnoteNumbering.get(id) ?? 0;
            return def ? { def, number: num } : null;
        })
            .filter(Boolean);
        const zoneHeight = footnoteZones.get(pageIdx);
        if (zoneHeight !== undefined)
            page.footnoteZoneHeight = zoneHeight;
    }
    return paginatedDoc;
}
//# sourceMappingURL=pipeline-footnotes.js.map