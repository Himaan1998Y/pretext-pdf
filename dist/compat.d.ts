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
    allowedFileDirs?: string[];
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
/**
 * Subset of pdfmake style properties translated by this shim.
 *
 * @remarks
 * **What pdfmake's style system looks like.** A pdfmake document has two
 * style surfaces:
 *
 * 1. `styles: Record<string, PdfmakeStyle>` — a named-style map. Nodes
 *    reference styles via `{ text, style: 'h1' }` or
 *    `{ text, style: ['h1', 'bold'] }` (later names override earlier).
 * 2. `defaultStyle: PdfmakeStyle` — applied to **every** node unless
 *    overridden by a named style or inline property.
 *
 * Style resolution order in pdfmake: `defaultStyle` → named styles (in array
 * order) → inline node properties. This shim implements the same precedence
 * inside `mergeStyles()`.
 *
 * **Properties that map into pretext-pdf:**
 * - `font` → element `font` (only on rich-paragraph spans) and, on
 *   `defaultStyle`, the document-level `defaultFont`.
 * - `fontSize` → element `fontSize` and, on `defaultStyle`, document-level
 *   `defaultFontSize`.
 * - `bold` → rich-paragraph span `bold`.
 * - `italics` → rich-paragraph span `italic` (note the rename).
 * - `color` → element `color`.
 * - `alignment` → paragraph/heading `align`.
 *
 * **Properties pdfmake supports that this shim silently drops:**
 * - `lineHeight` / `leading`
 * - `marginLeft` / `marginRight` / `marginTop` / `marginBottom` (named-style
 *   margins; node-level margins are also dropped)
 * - `decoration` (underline / lineThrough / overline) and `decorationStyle`
 * - `background` (highlight color)
 * - `characterSpacing`
 * - `preserveLeadingSpaces` / `noWrap`
 * - `link`, `linkToPage`, `linkToDestination` outside the dedicated `link`
 *   shorthand
 * - Anything else not listed in the `Properties that map` list above
 *
 * If you migrate from pdfmake and notice a missing visual property, it is
 * almost certainly one of the silently-dropped ones above. File an issue
 * with the property name if it is load-bearing for your output.
 *
 * @public
 */
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
 * Translate a pdfmake document descriptor into a pretext-pdf {@link PdfDocument}.
 * The result can be passed straight to `render()` from the main entry point.
 *
 * @remarks
 * **defaultStyle handling.** pdfmake's `defaultStyle` field (note: singular —
 * the plural `styles` field is the named-style map) maps onto two
 * document-level pretext-pdf properties:
 *
 * - `defaultStyle.font` → `PdfDocument.defaultFont`
 * - `defaultStyle.fontSize` → `PdfDocument.defaultFontSize`
 *
 * Other `defaultStyle` properties (`bold`, `italics`, `color`, `alignment`)
 * still flow into per-node style merging via `mergeStyles()`, so a document
 * with `defaultStyle: { color: '#444' }` produces nodes whose effective text
 * color is `#444` unless overridden. See {@link PdfmakeStyle} for the full
 * list of supported and silently-dropped properties.
 *
 * @public
 */
export declare function fromPdfmake(doc: PdfmakeDocument, options?: CompatOptions): PdfDocument;
//# sourceMappingURL=compat.d.ts.map