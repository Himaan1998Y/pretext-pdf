import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { PretextPdfError } from './errors.js';
import { buildFontKey } from './measure.js';
import { assertPathAllowed } from './assets.js';
// Browser detection. The bundled-font paths below depend on Node-only APIs
// (fileURLToPath, createRequire, fs). In a browser, these are guarded so that
// import-time evaluation never throws and consumers must supply fonts via doc.fonts.
const IS_NODE = typeof window === 'undefined' && typeof process !== 'undefined' && !!(process.versions?.node);
const __dirname = IS_NODE ? path.dirname(fileURLToPath(import.meta.url)) : '';
const _require = IS_NODE ? createRequire(import.meta.url) : null;
/**
 * Font loading strategy:
 * - TTF files for pdf-lib embedding (fontkit handles TTF natively, woff2 has glyph corruption bugs)
 * - woff2 for @napi-rs/canvas measurement (canvas handles woff2 perfectly via Skia)
 *
 * TTF priority: bundled fonts/ dir first, then @fontsource woff2 as fallback
 *
 * NOTE: @fontsource/inter is resolved via createRequire to handle npm hoisting correctly.
 * When pretext-pdf is installed as a package, @fontsource/inter is hoisted to the
 * consumer's node_modules, NOT to node_modules/pretext-pdf/node_modules/@fontsource/inter.
 * path.join(__dirname, '..', 'node_modules', ...) would fail in that case.
 */
function resolveInterFile(filename) {
    if (!_require)
        return null;
    try {
        const pkgJson = _require.resolve('@fontsource/inter/package.json');
        return path.join(path.dirname(pkgJson), 'files', filename);
    }
    catch {
        return null;
    }
}
/** Path to bundled Inter 400 normal font — TTF preferred for pdf-lib (Node only) */
const BUNDLED_INTER_PATHS = IS_NODE ? [
    path.join(__dirname, '..', 'fonts', 'Inter-Regular.ttf'),
    resolveInterFile('inter-latin-400-normal.woff2'),
    resolveInterFile('inter-all-400-normal.woff2'),
].filter(Boolean) : [];
/** Path to bundled Inter 700 (bold) font — TTF preferred for pdf-lib (Node only) */
const BUNDLED_INTER_BOLD_PATHS = IS_NODE ? [
    path.join(__dirname, '..', 'fonts', 'Inter-Bold.ttf'),
    resolveInterFile('inter-latin-700-normal.woff2'),
    resolveInterFile('inter-all-700-normal.woff2'),
].filter(Boolean) : [];
/** Path to bundled Inter 400 italic font */
const BUNDLED_INTER_ITALIC_PATHS = IS_NODE ? [
    path.join(__dirname, '..', 'fonts', 'Inter-Italic.ttf'),
    resolveInterFile('inter-latin-400-italic.woff2'),
    resolveInterFile('inter-all-400-italic.woff2'),
].filter(Boolean) : [];
/** Path to bundled Inter 700 italic font */
const BUNDLED_INTER_BOLD_ITALIC_PATHS = IS_NODE ? [
    path.join(__dirname, '..', 'fonts', 'Inter-BoldItalic.ttf'),
    resolveInterFile('inter-latin-700-italic.woff2'),
    resolveInterFile('inter-all-700-italic.woff2'),
].filter(Boolean) : [];
/**
 * Stage 2: Load and embed all fonts.
 * - Scans document for all font references
 * - Loads font bytes (file system or Uint8Array)
 * - Embeds each into pdfDoc via fontkit
 * - Returns FontMap for use in measure + render stages
 *
 * NOTE: pdfDoc is already created by the caller. Fonts are embedded into it here.
 * The same pdfDoc is used in Stage 5 (render).
 */
export async function loadFonts(doc, pdfDoc) {
    pdfDoc.registerFontkit(fontkit);
    const fontMap = new Map();
    const defaultFamily = doc.defaultFont ?? 'Inter';
    // Collect all font variants referenced in the document
    const needed = collectNeededFonts(doc);
    // Always ensure Inter 400 is available as the default fallback
    if (!needed.has(buildFontKey('Inter', 400, 'normal'))) {
        needed.set(buildFontKey('Inter', 400, 'normal'), {
            family: 'Inter', weight: 400, style: 'normal', src: 'bundled'
        });
    }
    if (!needed.has(buildFontKey('Inter', 700, 'normal'))) {
        needed.set(buildFontKey('Inter', 700, 'normal'), {
            family: 'Inter', weight: 700, style: 'normal', src: 'bundled'
        });
    }
    // Load all font bytes in parallel
    const loadPromises = Array.from(needed.entries()).map(async ([key, spec]) => {
        const bytes = await loadFontBytes(spec, doc.allowedFileDirs);
        return { key, bytes, spec };
    });
    const loaded = await Promise.all(loadPromises);
    // Embed each font into pdfDoc (must be sequential — pdf-lib limitation)
    for (const { key, bytes, spec } of loaded) {
        try {
            // Use fontkit's built-in subsetting for TTF fonts.
            // TTF magic bytes: 0x00010000 (TrueType) or 0x74727565 ('true').
            // woff2 starts with 0x774F4632 — fontkit has a known subsetting bug for woff2.
            const isTTF = bytes.length >= 4 && ((bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) ||
                (bytes[0] === 0x74 && bytes[1] === 0x72 && bytes[2] === 0x75 && bytes[3] === 0x65));
            const pdfFont = await pdfDoc.embedFont(bytes, { subset: isTTF });
            fontMap.set(key, pdfFont);
        }
        catch (err) {
            throw new PretextPdfError('FONT_EMBED_FAILED', `Failed to embed font "${spec.family ?? key}": ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    // Pre-compute font subsets by encoding all document text.
    // Calling pdfFont.encodeText() registers glyph IDs into the subset table
    // before pdfDoc.save(), producing smaller and faster-to-save PDFs.
    const textByFont = collectTextByFont(doc);
    for (const [key, text] of textByFont) {
        const pdfFont = fontMap.get(key);
        if (pdfFont && text.length > 0) {
            try {
                pdfFont.encodeText(text);
            }
            catch (err) {
                throw new PretextPdfError('FONT_ENCODE_FAIL', `Font subset failed for "${key}": ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    }
    // Set default font
    const defaultKey = buildFontKey(defaultFamily, 400, 'normal');
    if (!fontMap.has(defaultKey)) {
        // Default font wasn't explicitly added — try Inter as fallback
        const interKey = buildFontKey('Inter', 400, 'normal');
        const interFont = fontMap.get(interKey);
        if (interFont) {
            fontMap.set(defaultKey, interFont);
        }
    }
    return fontMap;
}
/**
 * Scan document to collect every unique font variant needed.
 * Returns a Map from fontKey → FontSpec-like descriptor.
 */
function collectNeededFonts(doc) {
    const needed = new Map();
    const defaultFamily = doc.defaultFont ?? 'Inter';
    // Build lookup from user-provided fonts
    const userFonts = new Map();
    for (const f of doc.fonts ?? []) {
        const key = buildFontKey(f.family, f.weight ?? 400, f.style ?? 'normal');
        userFonts.set(key, f);
    }
    const addFont = (family, weight, style) => {
        const key = buildFontKey(family, weight, style);
        if (needed.has(key))
            return;
        const userFont = userFonts.get(key);
        if (userFont) {
            needed.set(key, { ...userFont, src: userFont.src });
        }
        else if (family === 'Inter') {
            needed.set(key, { family, weight, style, src: 'bundled' });
        }
        else {
            // Font variant referenced but not in doc.fonts.
            // validate() should have caught this — if we reach here it's a bug in the validation layer.
            throw new PretextPdfError('FONT_EMBED_FAILED', `Font variant "${key}" is required by the document but was not found in doc.fonts and is not a bundled variant. This is a bug — font validation should have caught this.`);
        }
    };
    // Default font always needed
    addFont(defaultFamily, 400, 'normal');
    // Scan content — collect every font variant referenced by every element type
    for (const el of doc.content) {
        if (el.type === 'paragraph') {
            const family = el.fontFamily ?? defaultFamily;
            const weight = el.fontWeight ?? 400;
            addFont(family, weight, 'normal');
        }
        else if (el.type === 'heading') {
            const family = el.fontFamily ?? defaultFamily;
            const weight = el.fontWeight ?? 700;
            addFont(family, weight, 'normal');
        }
        else if (el.type === 'code') {
            addFont(el.fontFamily, 400, 'normal');
        }
        else if (el.type === 'rich-paragraph') {
            for (const span of el.spans) {
                addFont(span.fontFamily ?? defaultFamily, span.fontWeight ?? 400, span.fontStyle ?? 'normal');
            }
        }
        else if (el.type === 'list') {
            for (const item of el.items) {
                if ((item.fontWeight ?? 400) === 700)
                    addFont(defaultFamily, 700, 'normal');
                for (const nested of item.items ?? []) {
                    if ((nested.fontWeight ?? 400) === 700)
                        addFont(defaultFamily, 700, 'normal');
                }
            }
        }
        else if (el.type === 'table') {
            // Table cells can use bold (headers) or custom weights
            addFont(defaultFamily, 400, 'normal');
            for (const row of el.rows) {
                for (const cell of row.cells) {
                    const cellFamily = cell.fontFamily ?? defaultFamily;
                    const cellWeight = cell.fontWeight ?? (row.isHeader ? 700 : 400);
                    addFont(cellFamily, cellWeight, 'normal');
                }
                if (row.isHeader)
                    addFont(defaultFamily, 700, 'normal');
            }
        }
        else if (el.type === 'blockquote') {
            const family = el.fontFamily ?? defaultFamily;
            const weight = el.fontWeight ?? 400;
            const style = el.fontStyle ?? 'normal';
            addFont(family, weight, style);
        }
        else if (el.type === 'image' && el.floatFontFamily) {
            addFont(el.floatFontFamily, 400, 'normal');
        }
        else if (el.type === 'footnote-def') {
            const family = el.fontFamily ?? defaultFamily;
            addFont(family, 400, 'normal');
        }
        // spacer, image, hr, page-break use default font (already added)
    }
    // Header/footer fonts
    if (doc.header) {
        const family = doc.header.fontFamily ?? defaultFamily;
        addFont(family, doc.header.fontWeight ?? 400, 'normal');
    }
    if (doc.footer) {
        const family = doc.footer.fontFamily ?? defaultFamily;
        addFont(family, doc.footer.fontWeight ?? 400, 'normal');
    }
    // Watermark font (text watermark only)
    if (doc.watermark?.text) {
        const family = doc.watermark.fontFamily ?? defaultFamily;
        addFont(family, doc.watermark.fontWeight ?? 400, 'normal');
    }
    return needed;
}
/** Load font bytes from file path, Uint8Array, or bundled Inter */
async function loadFontBytes(spec, allowedFileDirs) {
    if (spec.src instanceof Uint8Array) {
        return spec.src;
    }
    if (spec.src === 'bundled') {
        if (!IS_NODE) {
            throw new PretextPdfError('FONT_LOAD_FAILED', `Bundled Inter font is not available in the browser. Supply font bytes via doc.fonts: [{ family: 'Inter', weight: 400, src: <Uint8Array> }, { family: 'Inter', weight: 700, src: <Uint8Array> }]`);
        }
        const weight = spec.weight ?? 400;
        const style = spec.style ?? 'normal';
        let paths;
        if (style === 'italic') {
            paths = weight >= 600 ? BUNDLED_INTER_BOLD_ITALIC_PATHS : BUNDLED_INTER_ITALIC_PATHS;
        }
        else {
            paths = weight >= 600 ? BUNDLED_INTER_BOLD_PATHS : BUNDLED_INTER_PATHS;
        }
        for (const p of paths) {
            if (fs.existsSync(p)) {
                try {
                    const buffer = fs.readFileSync(p);
                    return new Uint8Array(buffer);
                }
                catch {
                    // Try next
                }
            }
        }
        throw new PretextPdfError('FONT_LOAD_FAILED', `Bundled Inter font not found. Make sure @fontsource/inter is installed: npm install @fontsource/inter`);
    }
    // Browser context cannot read local file paths — only Uint8Array is supported
    if (!IS_NODE) {
        throw new PretextPdfError('FONT_LOAD_FAILED', `Font path "${spec.src}" is a string, but file paths cannot be read in the browser. Fetch the font yourself and pass the bytes as a Uint8Array in doc.fonts[].src.`);
    }
    // String path — relative paths will likely fail on different working directories
    if (!path.isAbsolute(spec.src)) {
        throw new PretextPdfError('FONT_LOAD_FAILED', `Font path "${spec.src}" is relative. Use an absolute path (e.g. path.join(__dirname, 'fonts/Roboto.ttf')) to avoid resolution issues.`);
    }
    const resolvedSrc = path.resolve(spec.src);
    // Path traversal guard — delegates to shared assertPathAllowed (assets.ts)
    assertPathAllowed(resolvedSrc, allowedFileDirs, 'Font');
    if (!fs.existsSync(resolvedSrc)) {
        throw new PretextPdfError('FONT_LOAD_FAILED', `Font file not found: "${path.basename(spec.src)}". Check the path in doc.fonts[].src.`);
    }
    try {
        const buffer = fs.readFileSync(resolvedSrc);
        return new Uint8Array(buffer);
    }
    catch (err) {
        throw new PretextPdfError('FONT_LOAD_FAILED', `Failed to read font file "${path.basename(spec.src)}": ${err instanceof Error ? err.message : String(err)}`);
    }
}
/**
 * Walk all content elements + header/footer and collect text strings grouped by font key.
 * Used by font subsetting to determine which glyphs each font needs.
 *
 * Returns: Map<fontKey, concatenated text string>
 */
export function collectTextByFont(doc) {
    const defaultFont = doc.defaultFont ?? 'Inter';
    const textSets = new Map();
    function addText(fontKey, text) {
        if (!textSets.has(fontKey))
            textSets.set(fontKey, new Set());
        textSets.get(fontKey).add(text);
    }
    for (const el of doc.content) {
        switch (el.type) {
            case 'paragraph': {
                const key = buildFontKey(el.fontFamily ?? defaultFont, el.fontWeight ?? 400, 'normal');
                addText(key, el.text);
                break;
            }
            case 'heading': {
                const key = buildFontKey(el.fontFamily ?? defaultFont, el.fontWeight ?? 700, 'normal');
                addText(key, el.text);
                break;
            }
            case 'blockquote': {
                const key = buildFontKey(el.fontFamily ?? defaultFont, el.fontWeight ?? 400, el.fontStyle ?? 'normal');
                addText(key, el.text);
                break;
            }
            case 'code': {
                const key = buildFontKey(el.fontFamily, 400, 'normal');
                addText(key, el.text);
                break;
            }
            case 'rich-paragraph': {
                for (const span of el.spans) {
                    const key = buildFontKey(span.fontFamily ?? defaultFont, span.fontWeight ?? 400, span.fontStyle ?? 'normal');
                    addText(key, span.text);
                }
                break;
            }
            case 'table': {
                for (const row of el.rows) {
                    for (const cell of row.cells) {
                        const key = buildFontKey(cell.fontFamily ?? defaultFont, cell.fontWeight ?? (row.isHeader ? 700 : 400), 'normal');
                        addText(key, cell.text);
                    }
                }
                break;
            }
            case 'list': {
                // List marker characters: bullets (•, ◦) for unordered, digits+dot for ordered
                const listFont = buildFontKey(defaultFont, 400, 'normal');
                if (el.style === 'ordered') {
                    addText(listFont, '0123456789.');
                }
                else {
                    addText(listFont, el.marker ?? '•');
                    addText(listFont, '◦'); // nested unordered uses hollow bullet
                }
                const collectItems = (items) => {
                    for (const item of items) {
                        const key = buildFontKey(defaultFont, item.fontWeight ?? 400, 'normal');
                        addText(key, item.text);
                        if (item.items)
                            collectItems(item.items);
                    }
                };
                collectItems(el.items);
                break;
            }
            case 'footnote-def': {
                const key = buildFontKey(el.fontFamily ?? defaultFont, 400, 'normal');
                addText(key, el.text);
                break;
            }
            // Note: 'toc-entry' is intentionally not handled here. TocEntryElement is an
            // internal synthesized type (not in the public ContentElement union) and
            // never appears in user-supplied doc.content. TOC entry glyphs (digits,
            // leader chars) are collected separately during the measurement pass.
            case 'callout': {
                const key = buildFontKey(el.fontFamily ?? defaultFont, el.fontWeight ?? 400, 'normal');
                addText(key, el.content);
                if (el.title) {
                    const titleKey = buildFontKey(el.fontFamily ?? defaultFont, 700, 'normal');
                    addText(titleKey, el.title);
                }
                break;
            }
            case 'form-field': {
                const key = buildFontKey(defaultFont, 400, 'normal');
                if (el.label)
                    addText(key, el.label);
                if (el.placeholder)
                    addText(key, el.placeholder);
                if (typeof el.defaultValue === 'string')
                    addText(key, el.defaultValue);
                if (el.options) {
                    for (const opt of el.options)
                        addText(key, opt.label);
                }
                break;
            }
            case 'float-group': {
                // Float-group contains multiple content elements — collect text from each
                for (const contentEl of el.content) {
                    if (contentEl.type === 'paragraph') {
                        const key = buildFontKey(contentEl.fontFamily ?? defaultFont, contentEl.fontWeight ?? 400, 'normal');
                        addText(key, contentEl.text);
                    }
                    else if (contentEl.type === 'heading') {
                        const key = buildFontKey(contentEl.fontFamily ?? defaultFont, contentEl.fontWeight ?? 700, 'normal');
                        addText(key, contentEl.text);
                    }
                    else if (contentEl.type === 'rich-paragraph') {
                        for (const span of contentEl.spans) {
                            const key = buildFontKey(span.fontFamily ?? defaultFont, span.fontWeight ?? 400, span.fontStyle ?? 'normal');
                            addText(key, span.text);
                        }
                    }
                }
                break;
            }
            // spacer, hr, page-break, image, comment: no text to collect
        }
    }
    // Header/footer: include static text + digits for {{pageNumber}}/{{totalPages}} expansion
    const DIGITS = '0123456789';
    if (doc.header) {
        const key = buildFontKey(doc.header.fontFamily ?? defaultFont, doc.header.fontWeight ?? 400, 'normal');
        addText(key, doc.header.text + DIGITS);
    }
    if (doc.footer) {
        const key = buildFontKey(doc.footer.fontFamily ?? defaultFont, doc.footer.fontWeight ?? 400, 'normal');
        addText(key, doc.footer.text + DIGITS);
    }
    // Section-specific header/footer overrides (per-page-range)
    if (doc.sections) {
        for (const section of doc.sections) {
            if (section.header) {
                const key = buildFontKey(section.header.fontFamily ?? defaultFont, section.header.fontWeight ?? 400, 'normal');
                addText(key, section.header.text + DIGITS);
            }
            if (section.footer) {
                const key = buildFontKey(section.footer.fontFamily ?? defaultFont, section.footer.fontWeight ?? 400, 'normal');
                addText(key, section.footer.text + DIGITS);
            }
        }
    }
    // Watermark text (if present)
    if (doc.watermark?.text) {
        const key = buildFontKey(doc.watermark.fontFamily ?? defaultFont, doc.watermark.fontWeight ?? 400, 'normal');
        addText(key, doc.watermark.text);
    }
    // Signature placeholder (renders labels + user text using Inter-400-normal)
    if (doc.signature) {
        const sigKey = buildFontKey(defaultFont, 400, 'normal');
        addText(sigKey, 'Signed by: Signature Date');
        if (doc.signature.signerName)
            addText(sigKey, doc.signature.signerName);
        if (doc.signature.reason)
            addText(sigKey, doc.signature.reason);
        if (doc.signature.location)
            addText(sigKey, doc.signature.location);
    }
    // Concatenate all text for each font key into one string
    const result = new Map();
    for (const [key, texts] of textSets) {
        result.set(key, Array.from(texts).join(''));
    }
    return result;
}
//# sourceMappingURL=fonts.js.map