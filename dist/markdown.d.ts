import type { ContentElement } from './types.js';
export interface MarkdownOptions {
    /** Font family for body text. Default: document default */
    fontFamily?: string;
    /** Font size for body text in pt. Default: document default */
    fontSize?: number;
    /** Font family for code blocks — required to emit CodeBlockElement; omit to render code as plain text. */
    codeFontFamily?: string;
    /** Space below each converted element in pt. Default: 0 (uses document defaults) */
    spaceAfter?: number;
}
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
export declare function markdownToContent(markdown: string, options?: MarkdownOptions): Promise<ContentElement[]>;
//# sourceMappingURL=markdown.d.ts.map