import { PretextPdfError } from './errors.js';
/**
 * Convert a Markdown string into an array of pretext-pdf ContentElement objects.
 *
 * Requires the `marked` package (optional peer dep). Install: npm install marked
 *
 * Supported Markdown:
 *   - Headings h1–h4 (h5/h6 collapse to h4)
 *   - Paragraphs with inline bold / italic / strikethrough / code / links
 *   - Ordered and unordered lists, recursive nesting
 *   - GFM task lists: `- [x] done` and `- [ ] todo` render as ☑ / ☐
 *   - GFM tables (with column alignment from `:---:`/`---:` markers)
 *   - Fenced code blocks (requires codeFontFamily option for styled rendering)
 *   - Blockquotes
 *   - Horizontal rules
 *
 * HTML tokens and unknown token types are silently skipped.
 */
export async function markdownToContent(markdown, options = {}) {
    let markedModule;
    try {
        markedModule = await import('marked');
    }
    catch {
        throw new PretextPdfError('MARKDOWN_DEP_MISSING', 'markdownToContent() requires the marked package. Install it: npm install marked');
    }
    const tokens = markedModule.marked.lexer(markdown);
    const elements = [];
    for (const token of tokens) {
        const converted = convertToken(token, options);
        if (converted === null)
            continue;
        if (Array.isArray(converted))
            elements.push(...converted);
        else
            elements.push(converted);
    }
    return elements;
}
// ─── Token converters ─────────────────────────────────────────────────────────
function convertToken(token, options) {
    switch (token.type) {
        case 'heading': return convertHeading(token);
        case 'paragraph': return convertParagraph(token, options);
        case 'list': return convertList(token);
        case 'table': return convertTable(token);
        case 'code': return convertCode(token, options);
        case 'blockquote': return convertBlockquote(token);
        case 'hr': return { type: 'hr' };
        case 'space': return null;
        case 'html': return null;
        default: return null;
    }
}
function convertHeading(token) {
    const level = Math.min(Math.max(token.depth, 1), 4);
    return { type: 'heading', level, text: extractPlainText(token.tokens ?? []) };
}
function convertParagraph(token, options) {
    const inline = token.tokens ?? [];
    if (isAllPlainText(inline)) {
        const el = { type: 'paragraph', text: extractPlainText(inline) };
        if (options.spaceAfter !== undefined)
            el.spaceAfter = options.spaceAfter;
        return el;
    }
    const spans = inlineTokensToSpans(inline);
    const el = { type: 'rich-paragraph', spans };
    if (options.spaceAfter !== undefined)
        el.spaceAfter = options.spaceAfter;
    return el;
}
function convertList(token) {
    return {
        type: 'list',
        style: token.ordered ? 'ordered' : 'unordered',
        items: token.items.map(item => convertListItem(item)),
    };
}
function convertListItem(item) {
    let text = '';
    const nestedItems = [];
    for (const token of item.tokens) {
        if (token.type === 'text') {
            const t = token;
            text += t.tokens ? extractPlainText(t.tokens) : t.text;
        }
        else if (token.type === 'paragraph') {
            // Marked emits paragraph tokens (not text) for list items separated by
            // blank lines. Extract the plain text so that content isn't dropped.
            const p = token;
            text += (text ? ' ' : '') + (p.tokens ? extractPlainText(p.tokens) : p.text);
        }
        else if (token.type === 'list') {
            // Recurse so deeper-than-2-level nesting is preserved instead of being
            // silently flattened to a single text-only leaf.
            const nested = token;
            for (const nestedItem of nested.items) {
                nestedItems.push(convertListItem(nestedItem));
            }
        }
    }
    // GFM task list: `- [x] done` / `- [ ] todo` → ☑ / ☐ prefix.
    // marked sets `task: true` and `checked: boolean` on the item.
    if (item.task) {
        const marker = item.checked ? '\u2611' : '\u2610'; // ☑ ☐
        text = `${marker} ${text}`;
    }
    const result = { text: text.trim() };
    if (nestedItems.length > 0)
        result.items = nestedItems;
    return result;
}
function convertTable(token) {
    // GFM tables. Header alignment from `:---:`/`---:` markers ends up in
    // token.align as 'left' | 'center' | 'right' | null per column.
    const colCount = token.header.length;
    const columns = token.header.map((_, i) => {
        const align = token.align[i];
        const col = { width: '1*' };
        if (align === 'left' || align === 'center' || align === 'right')
            col.align = align;
        return col;
    });
    const headerRow = {
        isHeader: true,
        cells: token.header.map(h => ({
            text: extractPlainText(h.tokens ?? []),
            fontWeight: 700,
        })),
    };
    const bodyRows = token.rows.map(row => ({
        cells: row.map(cell => ({
            text: extractPlainText(cell.tokens ?? []),
        })),
    }));
    // Pad short rows so every row has colCount cells (markdown sometimes emits
    // ragged rows on malformed input).
    for (const row of bodyRows) {
        while (row.cells.length < colCount)
            row.cells.push({ text: '' });
        row.cells.length = colCount;
    }
    return {
        type: 'table',
        columns,
        rows: [headerRow, ...bodyRows],
    };
}
function convertCode(token, options) {
    if (options.codeFontFamily) {
        return {
            type: 'code',
            text: token.text,
            fontFamily: options.codeFontFamily,
            ...(token.lang ? { language: token.lang } : {}),
        };
    }
    return { type: 'paragraph', text: token.text };
}
function convertBlockquote(token) {
    let text = '';
    if (token.tokens) {
        for (const t of token.tokens) {
            if (t.type === 'paragraph') {
                text += (text ? ' ' : '') + extractPlainText(t.tokens ?? []);
            }
        }
    }
    if (!text)
        text = token.text;
    return { type: 'blockquote', text };
}
// ─── Inline token helpers ─────────────────────────────────────────────────────
function isAllPlainText(tokens) {
    return tokens.every(t => t.type === 'text' || t.type === 'space' || t.type === 'escape' || t.type === 'br');
}
function extractPlainText(tokens) {
    return tokens.map(t => {
        if (t.type === 'text')
            return t.text;
        if (t.type === 'strong')
            return extractPlainText(t.tokens ?? []);
        if (t.type === 'em')
            return extractPlainText(t.tokens ?? []);
        if (t.type === 'codespan')
            return t.text;
        if (t.type === 'link')
            return extractPlainText(t.tokens ?? []);
        if (t.type === 'del')
            return extractPlainText(t.tokens ?? []);
        if (t.type === 'escape')
            return t.text;
        if (t.type === 'br')
            return ' ';
        if (t.type === 'image')
            return t.text || '';
        if (t.type === 'space')
            return ' ';
        return '';
    }).join('');
}
function inlineTokensToSpans(tokens) {
    const spans = [];
    for (const token of tokens) {
        if (token.type === 'text') {
            const text = token.text;
            if (text)
                spans.push({ text });
        }
        else if (token.type === 'strong') {
            const t = token;
            const inner = t.tokens ?? [];
            if (inner.length === 1 && inner[0].type === 'text') {
                spans.push({ text: inner[0].text, fontWeight: 700 });
            }
            else {
                for (const s of inlineTokensToSpans(inner))
                    spans.push({ ...s, fontWeight: 700 });
            }
        }
        else if (token.type === 'em') {
            const t = token;
            const inner = t.tokens ?? [];
            if (inner.length === 1 && inner[0].type === 'text') {
                spans.push({ text: inner[0].text, fontStyle: 'italic' });
            }
            else {
                for (const s of inlineTokensToSpans(inner))
                    spans.push({ ...s, fontStyle: 'italic' });
            }
        }
        else if (token.type === 'codespan') {
            spans.push({ text: token.text });
        }
        else if (token.type === 'link') {
            const t = token;
            const text = extractPlainText(t.tokens ?? []);
            if (text)
                spans.push({ text, href: t.href });
        }
        else if (token.type === 'del') {
            const inner = token.tokens ?? [];
            for (const s of inlineTokensToSpans(inner))
                spans.push({ ...s, strikethrough: true });
        }
        else if (token.type === 'escape') {
            const text = token.text;
            if (text)
                spans.push({ text });
        }
        else if (token.type === 'br') {
            spans.push({ text: ' ' });
        }
        else if (token.type === 'image') {
            const altText = token.text;
            if (altText)
                spans.push({ text: altText });
        }
        else if (token.type === 'space') {
            spans.push({ text: ' ' });
        }
    }
    return spans;
}
//# sourceMappingURL=markdown.js.map