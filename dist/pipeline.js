import { PDFDocument, PDFName, PDFString } from '@cantoo/pdf-lib';
import { PretextPdfError } from './errors.js';
import { resolvePageDimensions } from './page-sizes.js';
import { validate } from './validate.js';
import { loadFonts } from './fonts.js';
import { loadImages } from './assets.js';
import { measureAllBlocks, measureHeaderFooterHeight } from './measure.js';
import { LINE_HEIGHT_COMPACT } from './render-utils.js';
import { renderDocument } from './render.js';
import { runTocTwoPass } from './pipeline-toc.js';
import { runFootnoteTwoPass } from './pipeline-footnotes.js';
// ─── Stage 1: Validate ────────────────────────────────────────────────────────
export function stageValidate(doc, options) {
    validate(doc, options);
}
// ─── Stage 2a: Init (geometry + pdfDoc + metadata) ───────────────────────────
export async function stageInit(doc) {
    const [pageWidth, pageHeight] = resolvePageDimensions(doc.pageSize);
    const margins = {
        top: doc.margins?.top ?? 72,
        bottom: doc.margins?.bottom ?? 72,
        left: doc.margins?.left ?? 72,
        right: doc.margins?.right ?? 72,
    };
    const contentWidth = pageWidth - margins.left - margins.right;
    if (contentWidth <= 0) {
        throw new PretextPdfError('PAGE_TOO_SMALL', `Content width is ${contentWidth}pt after applying margins. Reduce margins or increase page size.`);
    }
    const pdfDoc = await PDFDocument.create();
    if (doc.metadata) {
        const m = doc.metadata;
        if (m.title)
            pdfDoc.setTitle(m.title);
        if (m.author)
            pdfDoc.setAuthor(m.author);
        if (m.subject)
            pdfDoc.setSubject(m.subject);
        if (m.keywords)
            pdfDoc.setKeywords(m.keywords);
        pdfDoc.setCreator(m.creator ?? 'pretext-pdf');
        if (m.producer)
            pdfDoc.setProducer(m.producer);
        if (m.language) {
            pdfDoc.catalog.set(PDFName.of('Lang'), PDFString.of(m.language));
        }
    }
    const creationDate = doc.renderDate
        ? (doc.renderDate instanceof Date ? doc.renderDate : new Date(doc.renderDate))
        : new Date();
    pdfDoc.setCreationDate(creationDate);
    pdfDoc.setModificationDate(creationDate);
    return {
        pdfDoc,
        geo: { pageWidth, pageHeight, margins, contentWidth },
        defaultFont: doc.defaultFont ?? 'Inter',
    };
}
// ─── Stage 2b: Load assets (fonts + images in parallel) ──────────────────────
export async function stageLoadAssets(doc, pdfDoc, contentWidth, plugins, logger) {
    const [fontMap, imageMap] = await Promise.all([
        loadFonts(doc, pdfDoc),
        loadImages(doc, pdfDoc, contentWidth, plugins, logger),
    ]);
    return { fontMap, imageMap };
}
// ─── Stage 2c: Finalize geometry (header/footer heights) ─────────────────────
export async function stageFinalizeGeo(doc, partialGeo, defaultFont) {
    const { pageHeight, margins, contentWidth } = partialGeo;
    const headerHeight = doc.header
        ? await measureHeaderFooterHeight(doc.header.text, doc.header.fontSize ?? 10, doc.header.fontFamily ?? defaultFont, contentWidth, (doc.header.fontSize ?? 10) * LINE_HEIGHT_COMPACT) + 8
        : 0;
    const footerHeight = doc.footer
        ? await measureHeaderFooterHeight(doc.footer.text, doc.footer.fontSize ?? 10, doc.footer.fontFamily ?? defaultFont, contentWidth, (doc.footer.fontSize ?? 10) * LINE_HEIGHT_COMPACT) + 8
        : 0;
    const contentHeight = pageHeight - margins.top - margins.bottom - headerHeight - footerHeight;
    if (contentHeight <= 0) {
        throw new PretextPdfError('PAGE_TOO_SMALL', `Content height is ${contentHeight}pt after applying margins + header/footer. Try reducing margins, header/footer font size, or increasing page size.`);
    }
    return { ...partialGeo, headerHeight, footerHeight, contentHeight };
}
// ─── Stage 3: Measure ─────────────────────────────────────────────────────────
export async function stageMeasure(doc, contentWidth, imageMap, contentHeight, plugins) {
    let measuredBlocks = await measureAllBlocks(doc, contentWidth, imageMap, contentHeight, plugins);
    measuredBlocks = await runTocTwoPass(measuredBlocks, doc, contentWidth, contentHeight);
    return measuredBlocks;
}
// ─── Stage 4: Paginate ────────────────────────────────────────────────────────
export function stagePaginate(measuredBlocks, contentHeight, doc) {
    const paginateConfig = { minOrphanLines: 2, minWidowLines: 2 };
    return runFootnoteTwoPass(measuredBlocks, contentHeight, paginateConfig, doc);
}
// ─── Stage 5: Render ──────────────────────────────────────────────────────────
export async function stageRender(paginatedDoc, doc, fontMap, imageMap, pdfDoc, geo, plugins, logger) {
    return renderDocument(paginatedDoc, doc, fontMap, imageMap, pdfDoc, geo, plugins, logger);
}
// ─── Composed pipeline ────────────────────────────────────────────────────────
/**
 * Run all 5 stages in sequence and return raw PDF bytes.
 * Post-processing (signature, encryption) is applied by the public render() in index.ts.
 */
export async function runPipeline(doc, options) {
    // Node canvas polyfill MUST be installed before any Pretext import (measure.ts uses it)
    if (typeof OffscreenCanvas === 'undefined' && typeof window === 'undefined') {
        const { installNodePolyfill } = await import('./node-polyfill.js');
        await installNodePolyfill();
    }
    const plugins = options?.plugins;
    const logger = options?.logger;
    stageValidate(doc, options);
    const { pdfDoc, geo: partialGeo, defaultFont } = await stageInit(doc);
    const { fontMap, imageMap } = await stageLoadAssets(doc, pdfDoc, partialGeo.contentWidth, plugins, logger);
    const geo = await stageFinalizeGeo(doc, partialGeo, defaultFont);
    const measuredBlocks = await stageMeasure(doc, geo.contentWidth, imageMap, geo.contentHeight, plugins);
    const paginatedDoc = stagePaginate(measuredBlocks, geo.contentHeight, doc);
    return stageRender(paginatedDoc, doc, fontMap, imageMap, pdfDoc, geo, plugins, logger);
}
//# sourceMappingURL=pipeline.js.map