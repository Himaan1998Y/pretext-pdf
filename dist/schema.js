/**
 * pretext-pdf — Machine-readable JSON Schema for PdfDocument
 *
 * Exported via the `pretext-pdf/schema` entry point. Intended for editor
 * tooling, MCP clients, and Smithery UI form generation. Not exhaustive —
 * covers the most-used fields and all element types.
 *
 * Usage:
 *   import { pdfDocumentSchema } from 'pretext-pdf/schema'
 */
// ─── Shared sub-schemas ────────────────────────────────────────────────────────
const alignSchema = { type: 'string', enum: ['left', 'center', 'right', 'justify'] };
const alignNoJustify = { type: 'string', enum: ['left', 'center', 'right'] };
const fontWeightSchema = { type: 'number', enum: [400, 700] };
const colorSchema = { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$', description: '6-digit hex color e.g. #FF0000' };
const dirSchema = { type: 'string', enum: ['ltr', 'rtl', 'auto'] };
const spaceSchema = { type: 'number', description: 'Space in points (pt)' };
const inlineSpanSchema = {
    type: 'object',
    required: ['text'],
    properties: {
        text: { type: 'string' },
        dir: dirSchema,
        fontFamily: { type: 'string' },
        fontWeight: fontWeightSchema,
        fontStyle: { type: 'string', enum: ['normal', 'italic'] },
        color: colorSchema,
        fontSize: { type: 'number' },
        underline: { type: 'boolean' },
        strikethrough: { type: 'boolean' },
        url: { type: 'string' },
        href: { type: 'string' },
        verticalAlign: { type: 'string', enum: ['superscript', 'subscript'] },
        smallCaps: { type: 'boolean' },
        letterSpacing: { type: 'number' },
        footnoteRef: { type: 'string' },
    },
};
// ─── Element schemas ──────────────────────────────────────────────────────────
const paragraphSchema = {
    type: 'object',
    required: ['type', 'text'],
    properties: {
        type: { type: 'string', const: 'paragraph' },
        text: { type: 'string' },
        dir: dirSchema,
        fontSize: { type: 'number' },
        lineHeight: { type: 'number' },
        fontFamily: { type: 'string' },
        fontWeight: fontWeightSchema,
        color: colorSchema,
        align: alignSchema,
        bgColor: colorSchema,
        spaceAfter: spaceSchema,
        spaceBefore: spaceSchema,
        keepTogether: { type: 'boolean' },
        underline: { type: 'boolean' },
        strikethrough: { type: 'boolean' },
        url: { type: 'string', format: 'uri' },
        letterSpacing: { type: 'number' },
        smallCaps: { type: 'boolean' },
        tabularNumbers: { type: 'boolean', description: 'Render digits at fixed slot width for aligned numeric columns.' },
        columns: { type: 'number', description: 'Number of columns for multi-column layout. Default: 1' },
        columnGap: { type: 'number', description: 'Gap between columns in pt. Default: 24' },
        hyphenate: { type: 'boolean', const: false, description: 'Set to false to disable hyphenation for this element.' },
        annotation: {
            type: 'object',
            required: ['contents'],
            properties: {
                contents: { type: 'string' },
                author: { type: 'string' },
                color: colorSchema,
                open: { type: 'boolean' },
            },
        },
    },
};
const headingSchema = {
    type: 'object',
    required: ['type', 'level', 'text'],
    properties: {
        type: { type: 'string', const: 'heading' },
        level: { type: 'number', enum: [1, 2, 3, 4] },
        text: { type: 'string' },
        dir: dirSchema,
        fontFamily: { type: 'string' },
        fontWeight: fontWeightSchema,
        fontSize: { type: 'number' },
        lineHeight: { type: 'number' },
        align: alignSchema,
        color: colorSchema,
        bgColor: colorSchema,
        spaceBefore: spaceSchema,
        spaceAfter: spaceSchema,
        keepTogether: { type: 'boolean' },
        underline: { type: 'boolean' },
        strikethrough: { type: 'boolean' },
        bookmark: { type: 'boolean', const: false },
        anchor: { type: 'string' },
        url: { type: 'string', format: 'uri' },
        letterSpacing: { type: 'number' },
        smallCaps: { type: 'boolean' },
        tabularNumbers: { type: 'boolean', description: 'Render digits at fixed slot width for aligned numeric columns.' },
        hyphenate: { type: 'boolean', const: false, description: 'Set to false to disable hyphenation for this element.' },
        annotation: {
            type: 'object',
            required: ['contents'],
            properties: {
                contents: { type: 'string' },
                author: { type: 'string' },
                color: colorSchema,
                open: { type: 'boolean' },
            },
        },
    },
};
const spacerSchema = {
    type: 'object',
    required: ['type', 'height'],
    properties: {
        type: { type: 'string', const: 'spacer' },
        height: { type: 'number', description: 'Height in pt' },
    },
};
const hrSchema = {
    type: 'object',
    required: ['type'],
    properties: {
        type: { type: 'string', const: 'hr' },
        thickness: { type: 'number' },
        color: colorSchema,
        spaceAbove: { type: 'number', description: 'Space above line in pt. Default: 12. Primary field.' },
        spaceBelow: { type: 'number', description: 'Space below line in pt. Default: 12. Primary field.' },
        spaceBefore: { type: 'number', description: 'Alias for spaceAbove (primary).' },
        spaceAfter: { type: 'number', description: 'Alias for spaceBelow (primary).' },
    },
};
const pageBreakSchema = {
    type: 'object',
    required: ['type'],
    properties: {
        type: { type: 'string', const: 'page-break' },
    },
};
const imageSchema = {
    type: 'object',
    required: ['type', 'src'],
    properties: {
        type: { type: 'string', const: 'image' },
        src: { type: 'string', description: 'Absolute file path or URL' },
        format: { type: 'string', enum: ['png', 'jpg', 'auto'] },
        width: { type: 'number' },
        height: { type: 'number' },
        align: alignNoJustify,
        spaceAfter: spaceSchema,
        spaceBefore: spaceSchema,
        float: { type: 'string', enum: ['left', 'right'] },
        floatText: { type: 'string' },
        floatWidth: { type: 'number', description: 'Image column width in pt. Default: 35% of content width.' },
        floatGap: { type: 'number', description: 'Gap between image and text columns in pt. Default: 12' },
        floatSpans: { type: 'array', items: inlineSpanSchema, description: 'Rich-text spans rendered alongside the image. Alternative to floatText.' },
        floatFontSize: { type: 'number', description: 'Font size for floatText in pt.' },
        floatFontFamily: { type: 'string', description: 'Font family for floatText.' },
        floatColor: colorSchema,
    },
};
const svgSchema = {
    type: 'object',
    required: ['type'],
    properties: {
        type: { type: 'string', const: 'svg' },
        svg: { type: 'string', description: 'Inline SVG markup string' },
        src: { type: 'string', description: 'Absolute path or https:// URL to an SVG file' },
        width: { type: 'number' },
        height: { type: 'number' },
        align: alignNoJustify,
        spaceBefore: spaceSchema,
        spaceAfter: spaceSchema,
    },
};
const tableSchema = {
    type: 'object',
    required: ['type', 'columns', 'rows'],
    properties: {
        type: { type: 'string', const: 'table' },
        columns: {
            type: 'array',
            items: {
                type: 'object',
                required: ['width'],
                properties: {
                    width: { oneOf: [{ type: 'number' }, { type: 'string', description: "Fraction e.g. '2*', '*', or 'auto'" }] },
                    align: alignNoJustify,
                },
            },
        },
        rows: {
            type: 'array',
            items: {
                type: 'object',
                required: ['cells'],
                properties: {
                    cells: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['text'],
                            properties: {
                                text: { type: 'string' },
                                align: alignNoJustify,
                                fontWeight: fontWeightSchema,
                                fontFamily: { type: 'string' },
                                fontSize: { type: 'number' },
                                color: colorSchema,
                                bgColor: colorSchema,
                                colspan: { type: 'number' },
                                rowspan: { type: 'number' },
                                dir: dirSchema,
                                tabularNumbers: { type: 'boolean', description: 'Render digits at fixed slot width.' },
                            },
                        },
                    },
                    isHeader: { type: 'boolean' },
                },
            },
        },
        borderColor: colorSchema,
        borderWidth: { type: 'number' },
        headerBgColor: colorSchema,
        fontSize: { type: 'number' },
        cellPaddingH: { type: 'number', description: 'Horizontal cell padding in pt. Default: 8' },
        cellPaddingV: { type: 'number', description: 'Vertical cell padding in pt. Default: 6' },
        spaceAfter: spaceSchema,
        spaceBefore: spaceSchema,
        dir: dirSchema,
        headerRows: { type: 'number', description: 'Number of header rows (repeated on continuation pages).' },
    },
};
const listSchema = {
    type: 'object',
    required: ['type', 'style', 'items'],
    properties: {
        type: { type: 'string', const: 'list' },
        style: { type: 'string', enum: ['ordered', 'unordered'] },
        items: {
            type: 'array',
            items: {
                type: 'object',
                required: ['text'],
                properties: {
                    text: { type: 'string' },
                    dir: dirSchema,
                    fontWeight: fontWeightSchema,
                    items: {
                        type: 'array',
                        description: 'Nested list items (up to 2 levels)',
                        items: {
                            type: 'object',
                            required: ['text'],
                            properties: {
                                text: { type: 'string' },
                                dir: dirSchema,
                                fontWeight: fontWeightSchema,
                            },
                        },
                    },
                },
            },
        },
        marker: { type: 'string' },
        indent: { type: 'number' },
        markerWidth: { type: 'number', description: 'Width reserved for marker column in pt. Default: 20' },
        fontSize: { type: 'number' },
        lineHeight: { type: 'number' },
        itemSpaceAfter: { type: 'number', description: 'Space between list items in pt. Default: 4' },
        nestedNumberingStyle: { type: 'string', enum: ['continue', 'restart'], description: 'How nested ordered counters behave. Default: continue' },
        color: colorSchema,
        spaceAfter: spaceSchema,
        spaceBefore: spaceSchema,
    },
};
const blockquoteSchema = {
    type: 'object',
    required: ['type', 'text'],
    properties: {
        type: { type: 'string', const: 'blockquote' },
        text: { type: 'string' },
        dir: dirSchema,
        borderColor: colorSchema,
        borderWidth: { type: 'number' },
        bgColor: colorSchema,
        color: colorSchema,
        fontFamily: { type: 'string' },
        fontWeight: fontWeightSchema,
        fontStyle: { type: 'string', enum: ['normal', 'italic'] },
        fontSize: { type: 'number' },
        lineHeight: { type: 'number' },
        padding: { type: 'number', description: 'Shorthand for paddingH and paddingV.' },
        paddingH: { type: 'number', description: 'Horizontal padding inside box in pt. Default: 16' },
        paddingV: { type: 'number', description: 'Vertical padding inside box in pt. Default: 10' },
        align: alignSchema,
        spaceBefore: spaceSchema,
        spaceAfter: spaceSchema,
        keepTogether: { type: 'boolean' },
        underline: { type: 'boolean' },
        strikethrough: { type: 'boolean' },
    },
};
const codeSchema = {
    type: 'object',
    required: ['type', 'text', 'fontFamily'],
    properties: {
        type: { type: 'string', const: 'code' },
        text: { type: 'string' },
        fontFamily: { type: 'string', description: 'Monospace font family (must be loaded in doc.fonts)' },
        fontSize: { type: 'number' },
        lineHeight: { type: 'number' },
        bgColor: colorSchema,
        color: colorSchema,
        padding: { type: 'number' },
        spaceAfter: spaceSchema,
        spaceBefore: spaceSchema,
        keepTogether: { type: 'boolean' },
        language: { type: 'string', description: "e.g. 'javascript', 'typescript', 'python'" },
        dir: dirSchema,
        highlightTheme: {
            type: 'object',
            description: 'Custom syntax highlight colors (6-digit hex). Overrides default GitHub-light theme.',
            properties: {
                keyword: colorSchema,
                string: colorSchema,
                comment: colorSchema,
                number: colorSchema,
                function: colorSchema,
                punctuation: colorSchema,
                type: colorSchema,
                built_in: colorSchema,
                literal: colorSchema,
            },
        },
    },
};
const calloutSchema = {
    type: 'object',
    required: ['type', 'content'],
    properties: {
        type: { type: 'string', const: 'callout' },
        content: { type: 'string' },
        style: { type: 'string', enum: ['info', 'warning', 'tip', 'note'] },
        title: { type: 'string' },
        backgroundColor: colorSchema,
        borderColor: colorSchema,
        color: colorSchema,
        titleColor: colorSchema,
        fontFamily: { type: 'string' },
        fontWeight: fontWeightSchema,
        fontSize: { type: 'number' },
        lineHeight: { type: 'number' },
        padding: { type: 'number', description: 'Shorthand for paddingH and paddingV. Default: 12' },
        paddingH: { type: 'number', description: 'Horizontal padding inside box in pt. Default: 16' },
        paddingV: { type: 'number', description: 'Vertical padding inside box in pt. Default: 10' },
        spaceBefore: spaceSchema,
        spaceAfter: spaceSchema,
        keepTogether: { type: 'boolean' },
        dir: dirSchema,
    },
};
const richParagraphSchema = {
    type: 'object',
    required: ['type', 'spans'],
    properties: {
        type: { type: 'string', const: 'rich-paragraph' },
        spans: { type: 'array', items: inlineSpanSchema },
        dir: dirSchema,
        fontSize: { type: 'number' },
        lineHeight: { type: 'number' },
        align: alignSchema,
        bgColor: colorSchema,
        spaceBefore: spaceSchema,
        spaceAfter: spaceSchema,
        keepTogether: { type: 'boolean' },
        letterSpacing: { type: 'number' },
        smallCaps: { type: 'boolean' },
        tabularNumbers: { type: 'boolean', description: 'Render digits at fixed slot width for aligned numeric columns.' },
        columns: { type: 'number', description: 'Number of columns for multi-column layout. Default: 1' },
        columnGap: { type: 'number', description: 'Gap between columns in pt. Default: 24' },
    },
};
const tocSchema = {
    type: 'object',
    required: ['type'],
    properties: {
        type: { type: 'string', const: 'toc' },
        title: { type: 'string' },
        showTitle: { type: 'boolean' },
        minLevel: { type: 'number', enum: [1, 2, 3, 4] },
        maxLevel: { type: 'number', enum: [1, 2, 3, 4] },
        fontSize: { type: 'number' },
        titleFontSize: { type: 'number', description: 'Font size for TOC title. Default: fontSize + 4' },
        levelIndent: { type: 'number', description: 'Indentation per level in pt. Default: 16' },
        leader: { type: 'string', description: 'Leader character between entry and page number. Default: .' },
        entrySpacing: { type: 'number', description: 'Space after each entry line in pt. Default: 4' },
        fontFamily: { type: 'string' },
        spaceBefore: spaceSchema,
        spaceAfter: spaceSchema,
    },
};
const footnoteDefSchema = {
    type: 'object',
    required: ['type', 'id', 'text'],
    properties: {
        type: { type: 'string', const: 'footnote-def' },
        id: { type: 'string' },
        text: { type: 'string' },
        fontSize: { type: 'number' },
        fontFamily: { type: 'string' },
        spaceAfter: spaceSchema,
    },
};
const qrCodeSchema = {
    type: 'object',
    required: ['type', 'data'],
    properties: {
        type: { type: 'string', const: 'qr-code' },
        data: { type: 'string' },
        size: { type: 'number' },
        errorCorrectionLevel: { type: 'string', enum: ['L', 'M', 'Q', 'H'] },
        foreground: colorSchema,
        background: colorSchema,
        margin: { type: 'number', description: 'Quiet-zone modules around the symbol. Default: 4' },
        align: alignNoJustify,
        spaceBefore: spaceSchema,
        spaceAfter: spaceSchema,
    },
};
const barcodeSchema = {
    type: 'object',
    required: ['type', 'symbology', 'data'],
    properties: {
        type: { type: 'string', const: 'barcode' },
        symbology: { type: 'string', description: "e.g. 'code128', 'ean13', 'qrcode'" },
        data: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' },
        includeText: { type: 'boolean' },
        align: alignNoJustify,
        spaceBefore: spaceSchema,
        spaceAfter: spaceSchema,
    },
};
const commentSchema = {
    type: 'object',
    required: ['type', 'contents'],
    properties: {
        type: { type: 'string', const: 'comment' },
        contents: { type: 'string' },
        author: { type: 'string' },
        color: colorSchema,
        open: { type: 'boolean' },
        spaceAfter: spaceSchema,
    },
};
const formFieldSchema = {
    type: 'object',
    required: ['type', 'fieldType', 'name'],
    properties: {
        type: { type: 'string', const: 'form-field' },
        fieldType: { type: 'string', enum: ['text', 'checkbox', 'radio', 'dropdown', 'button'] },
        name: { type: 'string' },
        label: { type: 'string' },
        placeholder: { type: 'string' },
        defaultValue: { type: 'string' },
        multiline: { type: 'boolean' },
        maxLength: { type: 'number' },
        checked: { type: 'boolean' },
        options: {
            type: 'array',
            items: {
                type: 'object',
                required: ['value', 'label'],
                properties: {
                    value: { type: 'string' },
                    label: { type: 'string' },
                },
            },
        },
        width: { type: 'number' },
        height: { type: 'number' },
        fontSize: { type: 'number' },
        borderColor: colorSchema,
        backgroundColor: colorSchema,
        defaultSelected: { type: 'string', description: 'Pre-selected value for radio groups and dropdowns.' },
        keepTogether: { type: 'boolean', description: 'If true, never break this element across pages. Default: true' },
        spaceAfter: spaceSchema,
        spaceBefore: spaceSchema,
    },
};
const floatGroupSchema = {
    type: 'object',
    required: ['type', 'image', 'float', 'content'],
    properties: {
        type: { type: 'string', const: 'float-group' },
        image: {
            type: 'object',
            required: ['src'],
            properties: {
                src: { type: 'string', description: 'Absolute file path or URL' },
                format: { type: 'string', enum: ['png', 'jpg', 'auto'] },
                height: { type: 'number' },
            },
        },
        float: { type: 'string', enum: ['left', 'right'] },
        floatWidth: { type: 'number', description: 'Image column width in pt. Default: 35% of content width.' },
        floatGap: { type: 'number', description: 'Gap between image and text columns in pt. Default: 12' },
        content: {
            type: 'array',
            description: 'Content elements rendered in the text column (paragraph, heading, rich-paragraph).',
            items: { type: 'object' },
        },
        spaceBefore: spaceSchema,
        spaceAfter: spaceSchema,
    },
};
const chartSchema = {
    type: 'object',
    required: ['type', 'spec'],
    properties: {
        type: { type: 'string', const: 'chart' },
        spec: { type: 'object', description: 'Vega-Lite JSON specification. Requires vega and vega-lite peer deps.' },
        width: { type: 'number' },
        height: { type: 'number' },
        caption: { type: 'string', description: 'Optional figure caption rendered below the chart.' },
        align: alignNoJustify,
        spaceBefore: spaceSchema,
        spaceAfter: spaceSchema,
    },
};
// ─── Top-level document schema ────────────────────────────────────────────────
export const pdfDocumentSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'PdfDocument',
    description: 'Top-level descriptor for a pretext-pdf document.',
    type: 'object',
    required: ['content'],
    properties: {
        content: {
            type: 'array',
            description: 'Document content elements rendered top-to-bottom.',
            items: {
                anyOf: [
                    paragraphSchema,
                    headingSchema,
                    spacerSchema,
                    hrSchema,
                    pageBreakSchema,
                    imageSchema,
                    svgSchema,
                    tableSchema,
                    listSchema,
                    blockquoteSchema,
                    codeSchema,
                    calloutSchema,
                    richParagraphSchema,
                    tocSchema,
                    footnoteDefSchema,
                    qrCodeSchema,
                    barcodeSchema,
                    commentSchema,
                    formFieldSchema,
                    floatGroupSchema,
                    chartSchema,
                ],
            },
        },
        pageSize: {
            description: 'Page size. Default: A4 (595×842 pt). Custom: [width, height] in pt.',
            oneOf: [
                {
                    type: 'string',
                    enum: ['A4', 'Letter', 'Legal', 'A3', 'A5', 'Tabloid'],
                },
                {
                    type: 'array',
                    items: { type: 'number' },
                    minItems: 2,
                    maxItems: 2,
                    description: '[width, height] in points',
                },
            ],
        },
        margins: {
            type: 'object',
            description: 'Page margins in pt. Default: all 72pt (1 inch).',
            properties: {
                top: { type: 'number' },
                bottom: { type: 'number' },
                left: { type: 'number' },
                right: { type: 'number' },
            },
        },
        defaultFont: {
            type: 'string',
            description: 'Default font family for body text. Default: Inter',
        },
        defaultFontSize: {
            type: 'number',
            description: 'Default font size in pt. Default: 12',
        },
        defaultLineHeight: {
            type: 'number',
            description: 'Default line height in pt. Default: fontSize * 1.5',
        },
        fonts: {
            type: 'array',
            description: 'Custom fonts to load and embed.',
            items: {
                type: 'object',
                required: ['family', 'src'],
                properties: {
                    family: { type: 'string' },
                    weight: fontWeightSchema,
                    style: { type: 'string', enum: ['normal', 'italic'] },
                    src: { type: 'string', description: 'Absolute file path to a TTF/OTF font file' },
                },
            },
        },
        header: {
            type: 'object',
            description: 'Header rendered at top of every page. Supports {{pageNumber}} and {{totalPages}}.',
            required: ['text'],
            properties: {
                text: { type: 'string', description: 'Use {{pageNumber}} and {{totalPages}} as tokens' },
                fontSize: { type: 'number' },
                align: alignNoJustify,
                fontFamily: { type: 'string' },
                fontWeight: fontWeightSchema,
                color: colorSchema,
            },
        },
        footer: {
            type: 'object',
            description: 'Footer rendered at bottom of every page. Supports {{pageNumber}} and {{totalPages}}.',
            required: ['text'],
            properties: {
                text: { type: 'string', description: 'Use {{pageNumber}} and {{totalPages}} as tokens' },
                fontSize: { type: 'number' },
                align: alignNoJustify,
                fontFamily: { type: 'string' },
                fontWeight: fontWeightSchema,
                color: colorSchema,
            },
        },
        sections: {
            type: 'array',
            description: 'Page-range overrides for header/footer. First matching section wins. Falls back to doc.header/footer.',
            items: {
                type: 'object',
                properties: {
                    fromPage: { type: 'number', description: 'First page (1-based, inclusive). Default: 1' },
                    toPage: { type: 'number', description: 'Last page (1-based, inclusive). Default: Infinity' },
                    header: {
                        type: 'object',
                        properties: {
                            text: { type: 'string' },
                            fontSize: { type: 'number' },
                            align: alignNoJustify,
                            fontFamily: { type: 'string' },
                            fontWeight: fontWeightSchema,
                            color: colorSchema,
                        },
                    },
                    footer: {
                        type: 'object',
                        properties: {
                            text: { type: 'string' },
                            fontSize: { type: 'number' },
                            align: alignNoJustify,
                            fontFamily: { type: 'string' },
                            fontWeight: fontWeightSchema,
                            color: colorSchema,
                        },
                    },
                },
            },
        },
        watermark: {
            type: 'object',
            description: 'Watermark overlay rendered on every page behind content.',
            properties: {
                text: { type: 'string' },
                fontFamily: { type: 'string' },
                fontWeight: fontWeightSchema,
                fontSize: { type: 'number' },
                color: colorSchema,
                opacity: { type: 'number', minimum: 0, maximum: 1 },
                rotation: { type: 'number', description: 'Rotation in degrees (counter-clockwise). Default: -45' },
            },
        },
        encryption: {
            type: 'object',
            description: 'Password protection and permission control for the output PDF.',
            properties: {
                userPassword: { type: 'string', description: 'Password required to open the document.' },
                ownerPassword: { type: 'string', description: 'Password for full unrestricted access.' },
                permissions: {
                    type: 'object',
                    properties: {
                        printing: { type: 'boolean' },
                        copying: { type: 'boolean' },
                        modifying: { type: 'boolean' },
                        annotating: { type: 'boolean' },
                    },
                },
            },
        },
        metadata: {
            type: 'object',
            description: 'PDF document metadata written into file properties.',
            properties: {
                title: { type: 'string' },
                author: { type: 'string' },
                subject: { type: 'string' },
                keywords: { type: 'array', items: { type: 'string' } },
                creator: { type: 'string' },
                language: { type: 'string', description: "BCP47 language tag e.g. 'en-US', 'hi', 'ar'" },
                producer: { type: 'string' },
            },
        },
        defaultParagraphStyle: {
            type: 'object',
            description: 'Default style applied to every paragraph and heading that does not set the field explicitly.',
            properties: {
                fontSize: { type: 'number' },
                lineHeight: { type: 'number' },
                fontFamily: { type: 'string' },
                fontWeight: fontWeightSchema,
                color: colorSchema,
                align: alignSchema,
                letterSpacing: { type: 'number' },
                spaceBefore: spaceSchema,
                spaceAfter: spaceSchema,
            },
        },
        bookmarks: {
            description: 'PDF bookmark outline. Set to false to disable, or provide config object.',
            oneOf: [
                { type: 'boolean', const: false },
                {
                    type: 'object',
                    properties: {
                        minLevel: { type: 'number', enum: [1, 2, 3, 4] },
                        maxLevel: { type: 'number', enum: [1, 2, 3, 4] },
                    },
                },
            ],
        },
        hyphenation: {
            type: 'object',
            description: 'Automatic word hyphenation. Requires installing the matching hyphenation.XX npm package.',
            required: ['language'],
            properties: {
                language: { type: 'string', description: "Language code e.g. 'en-us', 'de', 'fr'" },
                minWordLength: { type: 'number' },
                leftMin: { type: 'number' },
                rightMin: { type: 'number' },
            },
        },
        signature: {
            type: 'object',
            description: 'Visual signature placeholder drawn on a specified page.',
            properties: {
                signerName: { type: 'string' },
                reason: { type: 'string' },
                location: { type: 'string' },
                x: { type: 'number' },
                y: { type: 'number' },
                width: { type: 'number' },
                height: { type: 'number' },
                page: { type: 'number', description: 'Page index (0-based). Default: last page.' },
                borderColor: colorSchema,
                fontSize: { type: 'number' },
                invisible: { type: 'boolean' },
            },
        },
        flattenForms: {
            type: 'boolean',
            description: 'If true, flatten all form fields into static content. Default: false',
        },
        allowedFileDirs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Restrict filesystem access to these absolute directory paths.',
        },
    },
};
//# sourceMappingURL=schema.js.map