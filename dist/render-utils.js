/**
 * render-utils.ts — Pure utility functions for PDF rendering
 * No element-type knowledge. Used by all render modules.
 */
import { PDFName, PDFNull, PDFString, rgb } from '@cantoo/pdf-lib';
import { PretextPdfError } from './errors.js';
const SAFE_URL_SCHEME = /^(https?|mailto|ftp|#)/i;
/**
 * Draw a single line of text with justified alignment.
 * Spaces between words are stretched so the line fills availableWidth.
 * The last line of a paragraph is left-aligned (standard typographic convention).
 */
export function drawJustifiedLine(pdfPage, lineText, isLastLine, x, pdfY, availableWidth, fontSize, pdfFont, color) {
    const trimmed = lineText.trimEnd();
    // Last line or single word: left-align (can't stretch)
    if (isLastLine) {
        pdfPage.drawText(trimmed, { x, y: pdfY, size: fontSize, font: pdfFont, color });
        return;
    }
    const words = trimmed.split(' ').filter(w => w.length > 0);
    if (words.length <= 1) {
        pdfPage.drawText(trimmed, { x, y: pdfY, size: fontSize, font: pdfFont, color });
        return;
    }
    const wordWidths = words.map(w => pdfFont.widthOfTextAtSize(w, fontSize));
    const totalWordWidth = wordWidths.reduce((s, w) => s + w, 0);
    const gapSize = Math.max(0, (availableWidth - totalWordWidth) / (words.length - 1));
    let curX = x;
    for (let i = 0; i < words.length; i++) {
        pdfPage.drawText(words[i], { x: curX, y: pdfY, size: fontSize, font: pdfFont, color });
        curX += wordWidths[i] + gapSize;
    }
}
/**
 * Adds a clickable URI annotation over a rendered text region.
 * Must be called after drawText() — annotation sits above the text layer.
 */
export function addLinkAnnotation(pdfDoc, pdfPage, x, pdfY, width, fontSize, url) {
    if (!SAFE_URL_SCHEME.test(url)) {
        throw new PretextPdfError('VALIDATION_ERROR', `Unsafe URL scheme rejected at render time: "${url.slice(0, 60)}"`);
    }
    if (url.length > 2048) {
        process.stderr.write(`[pretext-pdf] Warning: link URL exceeds 2048 characters (${url.length}). Some PDF viewers may truncate it.\n`);
    }
    const rectBottom = pdfY - fontSize * 0.2;
    const rectTop = pdfY + fontSize * 0.8;
    const linkAnnot = pdfDoc.context.register(pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [x, rectBottom, x + width, rectTop],
        Border: [0, 0, 0],
        A: pdfDoc.context.obj({
            Type: 'Action',
            S: 'URI',
            URI: PDFString.of(url),
        }),
    }));
    const existingAnnots = pdfPage.node.get(PDFName.of('Annots'));
    if (existingAnnots) {
        // PDFArray.push() is now typed via augmentation (pdf-lib-augment.d.ts)
        const annots = pdfDoc.context.lookup(existingAnnots);
        annots.push(linkAnnot);
    }
    else {
        pdfPage.node.set(PDFName.of('Annots'), pdfDoc.context.obj([linkAnnot]));
    }
}
/**
 * Adds a clickable internal anchor link (GoTo) annotation over a rendered text region.
 * Jumps to a page with a named destination when clicked.
 * Must be called after drawText() — annotation sits above the text layer.
 */
export function addGoToAnnotation(pdfDoc, pdfPage, x, pdfY, width, fontSize, destPageRef, destPdfY) {
    const rectBottom = pdfY - fontSize * 0.2;
    const rectTop = pdfY + fontSize * 0.8;
    const goToAnnot = pdfDoc.context.register(pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [x, rectBottom, x + width, rectTop],
        Border: [0, 0, 0],
        Dest: pdfDoc.context.obj([destPageRef, PDFName.of('XYZ'), PDFNull, destPdfY, PDFNull]),
    }));
    const existingAnnots = pdfPage.node.get(PDFName.of('Annots'));
    if (existingAnnots) {
        // PDFArray.push() is now typed via augmentation (pdf-lib-augment.d.ts)
        const annots = pdfDoc.context.lookup(existingAnnots);
        annots.push(goToAnnot);
    }
    else {
        pdfPage.node.set(PDFName.of('Annots'), pdfDoc.context.obj([goToAnnot]));
    }
}
/**
 * Adds a sticky-note (Text) annotation at the given position.
 */
export function addStickyNoteAnnotation(pdfDoc, pdfPage, x, pdfY, contents, author, color, open) {
    const [r, g, b] = hexToRgb(color ?? '#FFFF00');
    const annotRef = pdfDoc.context.register(pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Text',
        Rect: [x, pdfY - 16, x + 16, pdfY],
        Contents: PDFString.of(contents),
        T: author ? PDFString.of(author) : PDFNull,
        Open: open === true,
        Name: 'Comment',
        C: [r, g, b],
    }));
    const existingAnnots = pdfPage.node.get(PDFName.of('Annots'));
    if (existingAnnots) {
        // PDFArray.push() is now typed via augmentation (pdf-lib-augment.d.ts)
        const annots = pdfDoc.context.lookup(existingAnnots);
        annots.push(annotRef);
    }
    else {
        pdfPage.node.set(PDFName.of('Annots'), pdfDoc.context.obj([annotRef]));
    }
}
/**
 * Draws underline and/or strikethrough lines for a rendered text segment.
 * Must be called AFTER drawText() so text renders on top of any decoration line.
 */
export function drawTextDecoration(pdfPage, x, width, pdfY, fontSize, pdfFont, color, decoration) {
    if (!decoration.underline && !decoration.strikethrough)
        return;
    // Prefer font-designed metrics via fontkit embedder; fall back to height math.
    // embedder is private in pdf-lib; accessing it via private field access
    const embedder = pdfFont.embedder;
    const fkFont = embedder?.font; // fontkit Font object (undefined for standard fonts)
    const scale = embedder?.scale ?? 1;
    const ascentPt = pdfFont.heightAtSize(fontSize, { descender: false });
    const thickness = fkFont
        ? Math.max(0.5, (fkFont.underlineThickness * scale / 1000) * fontSize)
        : Math.max(0.5, fontSize / 16);
    const [r, g, b] = color;
    const lineColor = rgb(r, g, b);
    if (decoration.underline) {
        const ulY = fkFont
            ? pdfY + (fkFont.underlinePosition * scale / 1000) * fontSize
            : pdfY - ascentPt * 0.12;
        pdfPage.drawLine({
            start: { x, y: ulY },
            end: { x: x + width, y: ulY },
            thickness,
            color: lineColor,
        });
    }
    if (decoration.strikethrough) {
        const strikeY = fkFont
            ? pdfY + (fkFont.xHeight * scale / 1000) * fontSize * 0.5
            : pdfY + ascentPt * 0.38;
        pdfPage.drawLine({
            start: { x, y: strikeY },
            end: { x: x + width, y: strikeY },
            thickness,
            color: lineColor,
        });
    }
}
const DIGIT_CHARS = '0123456789';
/**
 * Draw text with tabular (monospaced) digit spacing.
 * Each digit occupies a fixed slot = widest digit glyph in the font at the given size.
 * Non-digit characters render at their natural width.
 *
 * First-principle rationale: proportional fonts vary digit widths (1 is narrower than 0).
 * Tabular mode normalises all digits to the same advance, so columns of numbers
 * align perfectly with no font-specific OpenType tables required.
 */
export function drawTabularText(pdfPage, text, x, pdfY, fontSize, pdfFont, color) {
    let slotWidth = 0;
    for (const d of DIGIT_CHARS) {
        const w = pdfFont.widthOfTextAtSize(d, fontSize);
        if (w > slotWidth)
            slotWidth = w;
    }
    let curX = x;
    for (const ch of text) {
        if (DIGIT_CHARS.includes(ch)) {
            const charW = pdfFont.widthOfTextAtSize(ch, fontSize);
            pdfPage.drawText(ch, { x: curX + (slotWidth - charW) / 2, y: pdfY, size: fontSize, font: pdfFont, color });
            curX += slotWidth;
        }
        else {
            pdfPage.drawText(ch, { x: curX, y: pdfY, size: fontSize, font: pdfFont, color });
            curX += pdfFont.widthOfTextAtSize(ch, fontSize);
        }
    }
}
/**
 * THE ONLY place where top-down coords are converted to pdf-lib bottom-up coords.
 * @param yFromTop - distance from top of page in pt
 * @param elementHeight - height of the element (font baseline offset, image height, etc.)
 * @param pageHeight - total page height in pt
 */
export function toPdfY(yFromTop, elementHeight, pageHeight) {
    return pageHeight - yFromTop - elementHeight;
}
/** Resolve text horizontal position based on alignment */
export function resolveX(align, startX, availableWidth, lineWidth) {
    switch (align) {
        case 'left':
            return startX;
        case 'center':
            return startX + (availableWidth - lineWidth) / 2;
        case 'right':
            return startX + availableWidth - lineWidth;
    }
}
/** Default body line height multiplier — paragraphs, lists, blockquotes, footnotes, TOC */
export const LINE_HEIGHT_BODY = 1.5;
/** Default compact line height multiplier — headings, code blocks, callout titles */
export const LINE_HEIGHT_COMPACT = 1.4;
/** Replace {{pageNumber}}, {{totalPages}}, {{date}}, and {{author}} tokens */
export function resolveTokens(text, pageNumber, totalPages, extra) {
    return text
        .replaceAll('{{pageNumber}}', String(pageNumber))
        .replaceAll('{{totalPages}}', String(totalPages))
        .replaceAll('{{date}}', extra?.date ?? '')
        .replaceAll('{{author}}', extra?.author ?? '');
}
/** Parse a 6-digit hex color string to normalized RGB [0,1] triple.
 *  Falls back to black on invalid/missing input to prevent NaN from reaching pdf-lib. */
export function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string')
        return [0, 0, 0];
    const clean = hex.startsWith('#') ? hex.slice(1) : hex;
    if (!/^[0-9a-fA-F]{6}$/.test(clean))
        return [0, 0, 0];
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return [r, g, b];
}
//# sourceMappingURL=render-utils.js.map