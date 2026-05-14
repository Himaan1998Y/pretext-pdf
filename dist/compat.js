// ─── Public entry point ───────────────────────────────────────────────────────
const DEFAULT_HEADING_MAP = {
    header: 1, h1: 1, title: 1,
    subheader: 2, h2: 2,
    h3: 3,
    h4: 4,
};
/**
 * Translate a pdfmake document descriptor into a pretext-pdf PdfDocument.
 * The result can be passed straight to `render()` from the main entry point.
 */
export function fromPdfmake(doc, options = {}) {
    const headingMap = options.headingMap ?? DEFAULT_HEADING_MAP;
    const onUnsupported = options.onUnsupported ?? (() => { });
    const styles = doc.styles ?? {};
    const defaultStyle = doc.defaultStyle ?? {};
    const ctx = { styles, defaultStyle, headingMap, onUnsupported };
    const contentArr = Array.isArray(doc.content) ? doc.content : [doc.content];
    const content = [];
    for (const node of contentArr) {
        const els = translateNode(node, ctx);
        for (const el of els)
            content.push(el);
    }
    const result = { content };
    // pageSize
    if (doc.pageSize !== undefined) {
        if (typeof doc.pageSize === 'string') {
            const normalized = normalizePageSize(doc.pageSize);
            if (normalized)
                result.pageSize = normalized;
        }
        else if (typeof doc.pageSize === 'object' && doc.pageSize.width && doc.pageSize.height) {
            const [w, h] = doc.pageOrientation === 'landscape'
                ? [doc.pageSize.height, doc.pageSize.width]
                : [doc.pageSize.width, doc.pageSize.height];
            result.pageSize = [w, h];
        }
    }
    else if (doc.pageOrientation === 'landscape') {
        // Default A4 swapped to landscape
        result.pageSize = [842, 595];
    }
    // pageMargins ([left, top, right, bottom] OR [horizontal, vertical] OR scalar)
    if (doc.pageMargins !== undefined) {
        const m = normalizeMargins(doc.pageMargins);
        if (m)
            result.margins = m;
    }
    // defaultStyle → defaultFont / defaultFontSize
    if (defaultStyle.font)
        result.defaultFont = defaultStyle.font;
    if (typeof defaultStyle.fontSize === 'number')
        result.defaultFontSize = defaultStyle.fontSize;
    // header / footer — only string-form supported
    const header = normalizeHeaderFooter(doc.header, onUnsupported, 'header');
    if (header)
        result.header = header;
    const footer = normalizeHeaderFooter(doc.footer, onUnsupported, 'footer');
    if (footer)
        result.footer = footer;
    // info → metadata
    if (doc.info) {
        const m = {};
        if (doc.info.title)
            m.title = doc.info.title;
        if (doc.info.author)
            m.author = doc.info.author;
        if (doc.info.subject)
            m.subject = doc.info.subject;
        if (doc.info.keywords)
            m.keywords = doc.info.keywords.split(',').map(k => k.trim()).filter(Boolean);
        if (Object.keys(m).length > 0)
            result.metadata = m;
    }
    return result;
}
function translateNode(node, ctx) {
    if (typeof node === 'string') {
        return [{ type: 'paragraph', text: node }];
    }
    if (!node || typeof node !== 'object')
        return [];
    // Stack: recurse and inline.
    if (node.stack) {
        const out = [];
        for (const child of node.stack) {
            for (const el of translateNode(child, ctx))
                out.push(el);
        }
        return out;
    }
    // Page break (before or after) becomes a sibling page-break element.
    if (node.pageBreak === 'before') {
        const inner = translateNodeInner(node, ctx);
        return [{ type: 'page-break' }, ...inner];
    }
    if (node.pageBreak === 'after') {
        const inner = translateNodeInner(node, ctx);
        return [...inner, { type: 'page-break' }];
    }
    return translateNodeInner(node, ctx);
}
/** Translate a single pdfmake object node, ignoring stack/pageBreak (handled above). */
function translateNodeInner(node, ctx) {
    // Lists
    if (node.ul) {
        return [{
                type: 'list',
                style: 'unordered',
                items: node.ul.map(item => pdfmakeNodeToListItem(item, ctx)),
            }];
    }
    if (node.ol) {
        return [{
                type: 'list',
                style: 'ordered',
                items: node.ol.map(item => pdfmakeNodeToListItem(item, ctx)),
            }];
    }
    // Table
    if (node.table) {
        return [translateTable(node.table, ctx)];
    }
    // Image — pretext-pdf supports data URIs and absolute paths/URLs the same
    // way pdfmake does for src.
    if (typeof node.image === 'string') {
        const img = { type: 'image', src: node.image };
        if (typeof node.width === 'number')
            img.width = node.width;
        if (typeof node.height === 'number')
            img.height = node.height;
        return [img];
    }
    // QR code
    if (typeof node.qr === 'string') {
        const qr = { type: 'qr-code', data: node.qr };
        if (typeof node.fit === 'number')
            qr.size = node.fit;
        else if (Array.isArray(node.fit) && typeof node.fit[0] === 'number')
            qr.size = node.fit[0];
        return [qr];
    }
    // Columns — pretext-pdf doesn't render multi-column at the document layout
    // level (only paragraph.columns for text columns), so we flatten and warn
    // once. Existing pdfmake docs that use columns mostly do so for layout
    // tweaks that aren't load-bearing.
    if (node.columns) {
        ctx.onUnsupported('columns (flattened into a stack of children)');
        const out = [];
        for (const child of node.columns) {
            for (const el of translateNode(child, ctx))
                out.push(el);
        }
        return out;
    }
    if (node.canvas) {
        ctx.onUnsupported('canvas (skipped)');
        return [];
    }
    // Text node — paragraph, rich-paragraph, or heading depending on style/structure
    if (node.text !== undefined) {
        return [translateTextNode(node, ctx)];
    }
    return [];
}
// ─── Text / heading translation ───────────────────────────────────────────────
function translateTextNode(node, ctx) {
    const styleNames = normalizeStyleNames(node.style);
    const merged = mergeStyles(ctx, styleNames, node);
    // Heading detection: first matching style name in headingMap wins.
    let headingLevel;
    for (const name of styleNames) {
        if (ctx.headingMap[name] !== undefined) {
            headingLevel = ctx.headingMap[name];
            break;
        }
    }
    // Flatten the text payload into either a single string or an array of spans.
    const flatText = typeof node.text === 'string' ? node.text : null;
    const childArray = Array.isArray(node.text) ? node.text : (node.text && typeof node.text === 'object' ? [node.text] : []);
    if (headingLevel !== undefined) {
        const heading = {
            type: 'heading',
            level: headingLevel,
            text: flatText ?? extractFlatText(childArray, ctx),
        };
        if (merged.fontSize !== undefined)
            heading.fontSize = merged.fontSize;
        if (merged.color)
            heading.color = merged.color;
        const headingAlign = pdfmakeAlignToPretext(merged.alignment);
        if (headingAlign)
            heading.align = headingAlign;
        if (merged.font)
            heading.fontFamily = merged.font;
        return heading;
    }
    // Plain paragraph: text is a single string and no nested span styling needed.
    if (flatText !== null) {
        const para = { type: 'paragraph', text: flatText };
        applyStyleToParagraph(para, merged);
        return para;
    }
    // Rich paragraph: text is an array of (potentially styled) child nodes.
    const spans = [];
    for (const child of childArray)
        collectSpans(child, ctx, merged, spans);
    // If every span is identical-style and just text, downgrade to paragraph.
    if (spans.length === 1 && !spans[0].fontWeight && !spans[0].fontStyle && !spans[0].color && !spans[0].href && !spans[0].fontSize) {
        const para = { type: 'paragraph', text: spans[0].text };
        applyStyleToParagraph(para, merged);
        return para;
    }
    const rich = { type: 'rich-paragraph', spans };
    if (merged.fontSize !== undefined)
        rich.fontSize = merged.fontSize;
    const richAlign = pdfmakeAlignToPretext(merged.alignment);
    if (richAlign)
        rich.align = richAlign;
    return rich;
}
function applyStyleToParagraph(para, s) {
    if (s.fontSize !== undefined)
        para.fontSize = s.fontSize;
    if (s.color)
        para.color = s.color;
    if (s.bold)
        para.fontWeight = 700;
    const paraAlign = pdfmakeAlignToPretext(s.alignment);
    if (paraAlign)
        para.align = paraAlign;
    if (s.font)
        para.fontFamily = s.font;
}
function collectSpans(child, ctx, parent, out) {
    if (typeof child === 'string') {
        const span = { text: child };
        if (parent.bold)
            span.fontWeight = 700;
        if (parent.italics)
            span.fontStyle = 'italic';
        if (parent.color)
            span.color = parent.color;
        if (parent.fontSize !== undefined)
            span.fontSize = parent.fontSize;
        if (parent.font)
            span.fontFamily = parent.font;
        out.push(span);
        return;
    }
    if (!child || typeof child !== 'object')
        return;
    const styleNames = normalizeStyleNames(child.style);
    const merged = mergeStyles(ctx, styleNames, child, parent);
    // Recurse into nested arrays
    if (Array.isArray(child.text)) {
        for (const grand of child.text)
            collectSpans(grand, ctx, merged, out);
        return;
    }
    if (typeof child.text === 'string') {
        const span = { text: child.text };
        if (merged.bold)
            span.fontWeight = 700;
        if (merged.italics)
            span.fontStyle = 'italic';
        if (merged.color)
            span.color = merged.color;
        if (merged.fontSize !== undefined)
            span.fontSize = merged.fontSize;
        if (merged.font)
            span.fontFamily = merged.font;
        if (typeof child.link === 'string')
            span.href = child.link;
        out.push(span);
    }
}
function extractFlatText(children, ctx) {
    const buf = [];
    for (const c of children) {
        if (typeof c === 'string') {
            buf.push(c);
            continue;
        }
        if (typeof c.text === 'string') {
            buf.push(c.text);
            continue;
        }
        if (Array.isArray(c.text))
            buf.push(extractFlatText(c.text, ctx));
    }
    return buf.join('');
}
// ─── Table ────────────────────────────────────────────────────────────────────
function translateTable(t, ctx) {
    const colCount = t.body[0]?.length ?? 0;
    const widths = t.widths ?? new Array(colCount).fill('*');
    const columns = widths.map((w) => {
        if (typeof w === 'number')
            return { width: w };
        if (w === '*')
            return { width: '1*' };
        if (w === 'auto')
            return { width: 'auto' }; // pretext-pdf's 'auto' is still a string in the type
        if (typeof w === 'string' && /^\d*\.?\d+\*$/.test(w))
            return { width: w };
        return { width: '1*' };
    });
    const headerRows = t.headerRows ?? 0;
    const rows = t.body.map((row, idx) => {
        const isHeader = idx < headerRows;
        const cells = row.map(cell => {
            if (typeof cell === 'string')
                return { text: cell, ...(isHeader ? { fontWeight: 700 } : {}) };
            if (cell && typeof cell === 'object') {
                const styleNames = normalizeStyleNames(cell.style);
                const merged = mergeStyles(ctx, styleNames, cell);
                const text = typeof cell.text === 'string' ? cell.text : (Array.isArray(cell.text) ? extractFlatText(cell.text, ctx) : '');
                const tcell = { text };
                if (merged.bold || isHeader)
                    tcell.fontWeight = 700;
                if (merged.color)
                    tcell.color = merged.color;
                if (merged.alignment && merged.alignment !== 'justify')
                    tcell.align = merged.alignment;
                if (merged.fontSize !== undefined)
                    tcell.fontSize = merged.fontSize;
                return tcell;
            }
            return { text: '' };
        });
        return isHeader ? { isHeader: true, cells } : { cells };
    });
    return { type: 'table', columns, rows };
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
function pdfmakeAlignToPretext(a) {
    if (a === 'left' || a === 'center' || a === 'right' || a === 'justify')
        return a;
    return undefined;
}
function normalizeStyleNames(s) {
    if (!s)
        return [];
    return Array.isArray(s) ? s : [s];
}
function mergeStyles(ctx, styleNames, node, parent) {
    const merged = { ...ctx.defaultStyle, ...(parent ?? {}) };
    for (const name of styleNames) {
        const s = ctx.styles[name];
        if (s)
            copySafeStyleProperties(merged, s);
    }
    // Inline node-level overrides win
    if (node.bold !== undefined)
        merged.bold = node.bold;
    if (node.italics !== undefined)
        merged.italics = node.italics;
    if (node.color !== undefined)
        merged.color = node.color;
    if (node.fontSize !== undefined)
        merged.fontSize = node.fontSize;
    if (node.alignment !== undefined)
        merged.alignment = node.alignment;
    if (node.font !== undefined)
        merged.font = node.font;
    return merged;
}
/** Copy only known-safe style properties, preventing prototype pollution */
function copySafeStyleProperties(target, source) {
    const safeKeys = ['fontSize', 'bold', 'italics', 'color', 'alignment', 'font'];
    for (const key of safeKeys) {
        if (key in source && source[key] !== undefined) {
            target[key] = source[key];
        }
    }
}
function pdfmakeNodeToListItem(node, ctx) {
    if (typeof node === 'string')
        return { text: node };
    if (node && typeof node === 'object') {
        if (node.ul || node.ol) {
            // Nested list — pdfmake nests via { ul: [...] } as a child item.
            const items = (node.ul ?? node.ol ?? []).map(i => pdfmakeNodeToListItem(i, ctx));
            return { text: '', items };
        }
        if (typeof node.text === 'string')
            return { text: node.text };
        if (Array.isArray(node.text))
            return { text: extractFlatText(node.text, ctx) };
    }
    return { text: '' };
}
function normalizePageSize(name) {
    const n = name.trim();
    // pdfmake commonly uses uppercase ('LETTER', 'A4'); pretext-pdf uses 'Letter', 'A4'.
    const map = {
        A3: 'A3', A4: 'A4', A5: 'A5',
        LETTER: 'Letter', Letter: 'Letter', letter: 'Letter',
        LEGAL: 'Legal', Legal: 'Legal', legal: 'Legal',
        TABLOID: 'Tabloid', Tabloid: 'Tabloid', tabloid: 'Tabloid',
    };
    return map[n] ?? null;
}
function normalizeMargins(m) {
    if (typeof m === 'number')
        return { top: m, bottom: m, left: m, right: m };
    if (Array.isArray(m)) {
        if (m.length === 2)
            return { left: m[0], top: m[1], right: m[0], bottom: m[1] };
        if (m.length === 4)
            return { left: m[0], top: m[1], right: m[2], bottom: m[3] };
    }
    return null;
}
function normalizeHeaderFooter(hf, onUnsupported, label) {
    if (hf === undefined)
        return null;
    if (typeof hf === 'function') {
        onUnsupported(`${label} (function form not supported — pass a string instead)`);
        return null;
    }
    if (typeof hf === 'string')
        return { text: hf };
    if (typeof hf === 'object' && typeof hf.text === 'string') {
        const out = { text: hf.text };
        if (hf.alignment === 'left' || hf.alignment === 'center' || hf.alignment === 'right')
            out.align = hf.alignment;
        if (typeof hf.fontSize === 'number')
            out.fontSize = hf.fontSize;
        if (hf.color)
            out.color = hf.color;
        return out;
    }
    return null;
}
//# sourceMappingURL=compat.js.map