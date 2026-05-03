/**
 * pretext-pdf/compat — translate a pdfmake document descriptor into a
 * pretext-pdf PdfDocument so existing pdfmake codebases can switch with
 * a one-line change at the entry point.
 *
 *   import { fromPdfmake } from 'pretext-pdf/compat'
 *   import { render } from 'pretext-pdf'
 *
 *   const pdfmakeDoc = { content: [...], styles: {...} }
 *   const pdf = await render(fromPdfmake(pdfmakeDoc))
 *
 * What's translated:
 *   - pageSize ('A4', 'LETTER', { width, height }), pageOrientation, pageMargins
 *   - defaultStyle + styles map (style names referenced via { text, style: 'h1' })
 *   - String content → paragraph
 *   - { text }            → paragraph or rich-paragraph (depends on inline styling)
 *   - { ul } / { ol }     → list (recursive)
 *   - { table: {body, widths, headerRows} } → table
 *   - { image }           → image
 *   - { qr, fit }         → qr-code (requires the `qrcode` peer dep at render time)
 *   - { pageBreak }       → page-break
 *   - { stack }           → recurse children inline
 *   - header / footer (string forms only — pdfmake function-style headers are not supported)
 *
 * What's NOT translated (skipped, optionally warns):
 *   - { columns } — flattened into a stack with a console warning
 *   - { canvas } — drawing primitives are unsupported
 *   - Function-style headers/footers
 *   - styles[name].marginX / marginY / decoration
 *
 * Heading detection:
 *   By default style names like 'header', 'h1'..'h4', 'title', 'subheader' map
 *   to pretext-pdf heading levels 1..4. Override with `options.headingMap`.
 */
import type { PdfDocument } from './types.js';
/** A pdfmake-style document descriptor, stripped to the fields this shim handles. */
export interface PdfmakeDocument {
    content: PdfmakeNode | PdfmakeNode[];
    styles?: Record<string, PdfmakeStyle>;
    defaultStyle?: PdfmakeStyle;
    pageSize?: string | {
        width: number;
        height: number;
    };
    pageOrientation?: 'portrait' | 'landscape';
    pageMargins?: number | [number, number] | [number, number, number, number];
    header?: string | {
        text: string;
        alignment?: PdfmakeStyle['alignment'];
        fontSize?: number;
        color?: string;
    };
    footer?: string | {
        text: string;
        alignment?: PdfmakeStyle['alignment'];
        fontSize?: number;
        color?: string;
    };
    info?: {
        title?: string;
        author?: string;
        subject?: string;
        keywords?: string;
    };
}
export type PdfmakeNode = string | PdfmakeObjectNode;
export interface PdfmakeObjectNode {
    text?: string | PdfmakeNode | PdfmakeNode[];
    style?: string | string[];
    bold?: boolean;
    italics?: boolean;
    color?: string;
    fontSize?: number;
    alignment?: 'left' | 'center' | 'right' | 'justify';
    font?: string;
    ul?: PdfmakeNode[];
    ol?: PdfmakeNode[];
    table?: {
        body: PdfmakeNode[][];
        widths?: Array<number | string>;
        headerRows?: number;
    };
    image?: string;
    width?: number | string;
    height?: number;
    qr?: string;
    fit?: number | [number, number];
    pageBreak?: 'before' | 'after';
    stack?: PdfmakeNode[];
    columns?: PdfmakeNode[];
    link?: string;
    canvas?: unknown[];
}
export interface PdfmakeStyle {
    fontSize?: number;
    bold?: boolean;
    italics?: boolean;
    color?: string;
    alignment?: 'left' | 'center' | 'right' | 'justify';
    font?: string;
}
export interface CompatOptions {
    /**
     * Map of pdfmake style names to pretext-pdf heading levels (1–4).
     * Default: { header: 1, h1: 1, title: 1, subheader: 2, h2: 2, h3: 3, h4: 4 }
     * Pass `{}` to disable heading detection entirely (everything becomes paragraphs).
     */
    headingMap?: Record<string, 1 | 2 | 3 | 4>;
    /**
     * Called when a pdfmake feature is encountered that the shim doesn't translate
     * (canvas, function-style headers, etc.). Default: log a one-time warning.
     */
    onUnsupported?: (feature: string) => void;
}
/**
 * Translate a pdfmake document descriptor into a pretext-pdf PdfDocument.
 * The result can be passed straight to `render()` from the main entry point.
 */
export declare function fromPdfmake(doc: PdfmakeDocument, options?: CompatOptions): PdfDocument;
//# sourceMappingURL=compat.d.ts.map