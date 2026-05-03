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
export declare const pdfDocumentSchema: {
    readonly $schema: "https://json-schema.org/draft/2020-12/schema";
    readonly title: "PdfDocument";
    readonly description: "Top-level descriptor for a pretext-pdf document.";
    readonly type: "object";
    readonly required: readonly ["content"];
    readonly properties: {
        readonly content: {
            readonly type: "array";
            readonly description: "Document content elements rendered top-to-bottom.";
            readonly items: {
                readonly anyOf: readonly [{
                    readonly type: "object";
                    readonly required: readonly ["type", "text"];
                    readonly properties: {
                        readonly type: {
                            readonly type: "string";
                            readonly const: "paragraph";
                        };
                        readonly text: {
                            readonly type: "string";
                        };
                        readonly dir: {
                            readonly type: "string";
                            readonly enum: readonly ["ltr", "rtl", "auto"];
                        };
                        readonly fontSize: {
                            readonly type: "number";
                        };
                        readonly lineHeight: {
                            readonly type: "number";
                        };
                        readonly fontFamily: {
                            readonly type: "string";
                        };
                        readonly fontWeight: {
                            readonly type: "number";
                            readonly enum: readonly [400, 700];
                        };
                        readonly color: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly align: {
                            readonly type: "string";
                            readonly enum: readonly ["left", "center", "right", "justify"];
                        };
                        readonly bgColor: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly spaceAfter: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly spaceBefore: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly keepTogether: {
                            readonly type: "boolean";
                        };
                        readonly underline: {
                            readonly type: "boolean";
                        };
                        readonly strikethrough: {
                            readonly type: "boolean";
                        };
                        readonly url: {
                            readonly type: "string";
                            readonly format: "uri";
                        };
                        readonly letterSpacing: {
                            readonly type: "number";
                        };
                        readonly smallCaps: {
                            readonly type: "boolean";
                        };
                        readonly tabularNumbers: {
                            readonly type: "boolean";
                            readonly description: "Render digits at fixed slot width for aligned numeric columns.";
                        };
                        readonly columns: {
                            readonly type: "number";
                            readonly description: "Number of columns for multi-column layout. Default: 1";
                        };
                        readonly columnGap: {
                            readonly type: "number";
                            readonly description: "Gap between columns in pt. Default: 24";
                        };
                        readonly hyphenate: {
                            readonly type: "boolean";
                            readonly const: false;
                            readonly description: "Set to false to disable hyphenation for this element.";
                        };
                        readonly annotation: {
                            readonly type: "object";
                            readonly required: readonly ["contents"];
                            readonly properties: {
                                readonly contents: {
                                    readonly type: "string";
                                };
                                readonly author: {
                                    readonly type: "string";
                                };
                                readonly color: {
                                    readonly type: "string";
                                    readonly pattern: "^#[0-9A-Fa-f]{6}$";
                                    readonly description: "6-digit hex color e.g. #FF0000";
                                };
                                readonly open: {
                                    readonly type: "boolean";
                                };
                            };
                        };
                    };
                }, {
                    readonly type: "object";
                    readonly required: readonly ["type", "level", "text"];
                    readonly properties: {
                        readonly type: {
                            readonly type: "string";
                            readonly const: "heading";
                        };
                        readonly level: {
                            readonly type: "number";
                            readonly enum: readonly [1, 2, 3, 4];
                        };
                        readonly text: {
                            readonly type: "string";
                        };
                        readonly dir: {
                            readonly type: "string";
                            readonly enum: readonly ["ltr", "rtl", "auto"];
                        };
                        readonly fontFamily: {
                            readonly type: "string";
                        };
                        readonly fontWeight: {
                            readonly type: "number";
                            readonly enum: readonly [400, 700];
                        };
                        readonly fontSize: {
                            readonly type: "number";
                        };
                        readonly lineHeight: {
                            readonly type: "number";
                        };
                        readonly align: {
                            readonly type: "string";
                            readonly enum: readonly ["left", "center", "right", "justify"];
                        };
                        readonly color: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly bgColor: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly spaceBefore: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly spaceAfter: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly keepTogether: {
                            readonly type: "boolean";
                        };
                        readonly underline: {
                            readonly type: "boolean";
                        };
                        readonly strikethrough: {
                            readonly type: "boolean";
                        };
                        readonly bookmark: {
                            readonly type: "boolean";
                            readonly const: false;
                        };
                        readonly anchor: {
                            readonly type: "string";
                        };
                        readonly url: {
                            readonly type: "string";
                            readonly format: "uri";
                        };
                        readonly letterSpacing: {
                            readonly type: "number";
                        };
                        readonly smallCaps: {
                            readonly type: "boolean";
                        };
                        readonly tabularNumbers: {
                            readonly type: "boolean";
                            readonly description: "Render digits at fixed slot width for aligned numeric columns.";
                        };
                        readonly hyphenate: {
                            readonly type: "boolean";
                            readonly const: false;
                            readonly description: "Set to false to disable hyphenation for this element.";
                        };
                        readonly annotation: {
                            readonly type: "object";
                            readonly required: readonly ["contents"];
                            readonly properties: {
                                readonly contents: {
                                    readonly type: "string";
                                };
                                readonly author: {
                                    readonly type: "string";
                                };
                                readonly color: {
                                    readonly type: "string";
                                    readonly pattern: "^#[0-9A-Fa-f]{6}$";
                                    readonly description: "6-digit hex color e.g. #FF0000";
                                };
                                readonly open: {
                                    readonly type: "boolean";
                                };
                            };
                        };
                    };
                }, {
                    readonly type: "object";
                    readonly required: readonly ["type", "height"];
                    readonly properties: {
                        readonly type: {
                            readonly type: "string";
                            readonly const: "spacer";
                        };
                        readonly height: {
                            readonly type: "number";
                            readonly description: "Height in pt";
                        };
                    };
                }, {
                    readonly type: "object";
                    readonly required: readonly ["type"];
                    readonly properties: {
                        readonly type: {
                            readonly type: "string";
                            readonly const: "hr";
                        };
                        readonly thickness: {
                            readonly type: "number";
                        };
                        readonly color: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly spaceAbove: {
                            readonly type: "number";
                            readonly description: "Space above line in pt. Default: 12. Primary field.";
                        };
                        readonly spaceBelow: {
                            readonly type: "number";
                            readonly description: "Space below line in pt. Default: 12. Primary field.";
                        };
                        readonly spaceBefore: {
                            readonly type: "number";
                            readonly description: "Alias for spaceAbove (primary).";
                        };
                        readonly spaceAfter: {
                            readonly type: "number";
                            readonly description: "Alias for spaceBelow (primary).";
                        };
                    };
                }, {
                    readonly type: "object";
                    readonly required: readonly ["type"];
                    readonly properties: {
                        readonly type: {
                            readonly type: "string";
                            readonly const: "page-break";
                        };
                    };
                }, {
                    readonly type: "object";
                    readonly required: readonly ["type", "src"];
                    readonly properties: {
                        readonly type: {
                            readonly type: "string";
                            readonly const: "image";
                        };
                        readonly src: {
                            readonly type: "string";
                            readonly description: "Absolute file path or URL";
                        };
                        readonly format: {
                            readonly type: "string";
                            readonly enum: readonly ["png", "jpg", "auto"];
                        };
                        readonly width: {
                            readonly type: "number";
                        };
                        readonly height: {
                            readonly type: "number";
                        };
                        readonly align: {
                            readonly type: "string";
                            readonly enum: readonly ["left", "center", "right"];
                        };
                        readonly spaceAfter: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly spaceBefore: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly float: {
                            readonly type: "string";
                            readonly enum: readonly ["left", "right"];
                        };
                        readonly floatText: {
                            readonly type: "string";
                        };
                        readonly floatWidth: {
                            readonly type: "number";
                            readonly description: "Image column width in pt. Default: 35% of content width.";
                        };
                        readonly floatGap: {
                            readonly type: "number";
                            readonly description: "Gap between image and text columns in pt. Default: 12";
                        };
                        readonly floatSpans: {
                            readonly type: "array";
                            readonly items: {
                                readonly type: "object";
                                readonly required: readonly ["text"];
                                readonly properties: {
                                    readonly text: {
                                        readonly type: "string";
                                    };
                                    readonly dir: {
                                        readonly type: "string";
                                        readonly enum: readonly ["ltr", "rtl", "auto"];
                                    };
                                    readonly fontFamily: {
                                        readonly type: "string";
                                    };
                                    readonly fontWeight: {
                                        readonly type: "number";
                                        readonly enum: readonly [400, 700];
                                    };
                                    readonly fontStyle: {
                                        readonly type: "string";
                                        readonly enum: readonly ["normal", "italic"];
                                    };
                                    readonly color: {
                                        readonly type: "string";
                                        readonly pattern: "^#[0-9A-Fa-f]{6}$";
                                        readonly description: "6-digit hex color e.g. #FF0000";
                                    };
                                    readonly fontSize: {
                                        readonly type: "number";
                                    };
                                    readonly underline: {
                                        readonly type: "boolean";
                                    };
                                    readonly strikethrough: {
                                        readonly type: "boolean";
                                    };
                                    readonly url: {
                                        readonly type: "string";
                                    };
                                    readonly href: {
                                        readonly type: "string";
                                    };
                                    readonly verticalAlign: {
                                        readonly type: "string";
                                        readonly enum: readonly ["superscript", "subscript"];
                                    };
                                    readonly smallCaps: {
                                        readonly type: "boolean";
                                    };
                                    readonly letterSpacing: {
                                        readonly type: "number";
                                    };
                                    readonly footnoteRef: {
                                        readonly type: "string";
                                    };
                                };
                            };
                            readonly description: "Rich-text spans rendered alongside the image. Alternative to floatText.";
                        };
                    };
                }, {
                    readonly type: "object";
                    readonly required: readonly ["type"];
                    readonly properties: {
                        readonly type: {
                            readonly type: "string";
                            readonly const: "svg";
                        };
                        readonly svg: {
                            readonly type: "string";
                            readonly description: "Inline SVG markup string";
                        };
                        readonly src: {
                            readonly type: "string";
                            readonly description: "Absolute path or https:// URL to an SVG file";
                        };
                        readonly width: {
                            readonly type: "number";
                        };
                        readonly height: {
                            readonly type: "number";
                        };
                        readonly align: {
                            readonly type: "string";
                            readonly enum: readonly ["left", "center", "right"];
                        };
                        readonly spaceBefore: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly spaceAfter: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                    };
                }, {
                    readonly type: "object";
                    readonly required: readonly ["type", "columns", "rows"];
                    readonly properties: {
                        readonly type: {
                            readonly type: "string";
                            readonly const: "table";
                        };
                        readonly columns: {
                            readonly type: "array";
                            readonly items: {
                                readonly type: "object";
                                readonly required: readonly ["width"];
                                readonly properties: {
                                    readonly width: {
                                        readonly oneOf: readonly [{
                                            readonly type: "number";
                                        }, {
                                            readonly type: "string";
                                            readonly description: "Fraction e.g. '2*', '*', or 'auto'";
                                        }];
                                    };
                                    readonly align: {
                                        readonly type: "string";
                                        readonly enum: readonly ["left", "center", "right"];
                                    };
                                };
                            };
                        };
                        readonly rows: {
                            readonly type: "array";
                            readonly items: {
                                readonly type: "object";
                                readonly required: readonly ["cells"];
                                readonly properties: {
                                    readonly cells: {
                                        readonly type: "array";
                                        readonly items: {
                                            readonly type: "object";
                                            readonly required: readonly ["text"];
                                            readonly properties: {
                                                readonly text: {
                                                    readonly type: "string";
                                                };
                                                readonly align: {
                                                    readonly type: "string";
                                                    readonly enum: readonly ["left", "center", "right"];
                                                };
                                                readonly fontWeight: {
                                                    readonly type: "number";
                                                    readonly enum: readonly [400, 700];
                                                };
                                                readonly color: {
                                                    readonly type: "string";
                                                    readonly pattern: "^#[0-9A-Fa-f]{6}$";
                                                    readonly description: "6-digit hex color e.g. #FF0000";
                                                };
                                                readonly bgColor: {
                                                    readonly type: "string";
                                                    readonly pattern: "^#[0-9A-Fa-f]{6}$";
                                                    readonly description: "6-digit hex color e.g. #FF0000";
                                                };
                                                readonly colspan: {
                                                    readonly type: "number";
                                                };
                                                readonly rowspan: {
                                                    readonly type: "number";
                                                };
                                            };
                                        };
                                    };
                                    readonly isHeader: {
                                        readonly type: "boolean";
                                    };
                                };
                            };
                        };
                        readonly borderColor: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly borderWidth: {
                            readonly type: "number";
                        };
                        readonly headerBgColor: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly fontSize: {
                            readonly type: "number";
                        };
                        readonly cellPaddingH: {
                            readonly type: "number";
                            readonly description: "Horizontal cell padding in pt. Default: 8";
                        };
                        readonly cellPaddingV: {
                            readonly type: "number";
                            readonly description: "Vertical cell padding in pt. Default: 6";
                        };
                        readonly spaceAfter: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly spaceBefore: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                    };
                }, {
                    readonly type: "object";
                    readonly required: readonly ["type", "style", "items"];
                    readonly properties: {
                        readonly type: {
                            readonly type: "string";
                            readonly const: "list";
                        };
                        readonly style: {
                            readonly type: "string";
                            readonly enum: readonly ["ordered", "unordered"];
                        };
                        readonly items: {
                            readonly type: "array";
                            readonly items: {
                                readonly type: "object";
                                readonly required: readonly ["text"];
                                readonly properties: {
                                    readonly text: {
                                        readonly type: "string";
                                    };
                                    readonly dir: {
                                        readonly type: "string";
                                        readonly enum: readonly ["ltr", "rtl", "auto"];
                                    };
                                    readonly fontWeight: {
                                        readonly type: "number";
                                        readonly enum: readonly [400, 700];
                                    };
                                    readonly items: {
                                        readonly type: "array";
                                        readonly description: "Nested list items (up to 2 levels)";
                                        readonly items: {
                                            readonly type: "object";
                                            readonly required: readonly ["text"];
                                            readonly properties: {
                                                readonly text: {
                                                    readonly type: "string";
                                                };
                                                readonly dir: {
                                                    readonly type: "string";
                                                    readonly enum: readonly ["ltr", "rtl", "auto"];
                                                };
                                                readonly fontWeight: {
                                                    readonly type: "number";
                                                    readonly enum: readonly [400, 700];
                                                };
                                            };
                                        };
                                    };
                                };
                            };
                        };
                        readonly marker: {
                            readonly type: "string";
                        };
                        readonly indent: {
                            readonly type: "number";
                        };
                        readonly markerWidth: {
                            readonly type: "number";
                            readonly description: "Width reserved for marker column in pt. Default: 20";
                        };
                        readonly fontSize: {
                            readonly type: "number";
                        };
                        readonly lineHeight: {
                            readonly type: "number";
                        };
                        readonly itemSpaceAfter: {
                            readonly type: "number";
                            readonly description: "Space between list items in pt. Default: 4";
                        };
                        readonly nestedNumberingStyle: {
                            readonly type: "string";
                            readonly enum: readonly ["continue", "restart"];
                            readonly description: "How nested ordered counters behave. Default: continue";
                        };
                        readonly color: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly spaceAfter: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly spaceBefore: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                    };
                }, {
                    readonly type: "object";
                    readonly required: readonly ["type", "text"];
                    readonly properties: {
                        readonly type: {
                            readonly type: "string";
                            readonly const: "blockquote";
                        };
                        readonly text: {
                            readonly type: "string";
                        };
                        readonly dir: {
                            readonly type: "string";
                            readonly enum: readonly ["ltr", "rtl", "auto"];
                        };
                        readonly borderColor: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly borderWidth: {
                            readonly type: "number";
                        };
                        readonly bgColor: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly color: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly fontFamily: {
                            readonly type: "string";
                        };
                        readonly fontWeight: {
                            readonly type: "number";
                            readonly enum: readonly [400, 700];
                        };
                        readonly fontStyle: {
                            readonly type: "string";
                            readonly enum: readonly ["normal", "italic"];
                        };
                        readonly fontSize: {
                            readonly type: "number";
                        };
                        readonly lineHeight: {
                            readonly type: "number";
                        };
                        readonly padding: {
                            readonly type: "number";
                            readonly description: "Shorthand for paddingH and paddingV.";
                        };
                        readonly paddingH: {
                            readonly type: "number";
                            readonly description: "Horizontal padding inside box in pt. Default: 16";
                        };
                        readonly paddingV: {
                            readonly type: "number";
                            readonly description: "Vertical padding inside box in pt. Default: 10";
                        };
                        readonly align: {
                            readonly type: "string";
                            readonly enum: readonly ["left", "center", "right", "justify"];
                        };
                        readonly spaceBefore: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly spaceAfter: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly keepTogether: {
                            readonly type: "boolean";
                        };
                        readonly underline: {
                            readonly type: "boolean";
                        };
                        readonly strikethrough: {
                            readonly type: "boolean";
                        };
                    };
                }, {
                    readonly type: "object";
                    readonly required: readonly ["type", "text", "fontFamily"];
                    readonly properties: {
                        readonly type: {
                            readonly type: "string";
                            readonly const: "code";
                        };
                        readonly text: {
                            readonly type: "string";
                        };
                        readonly fontFamily: {
                            readonly type: "string";
                            readonly description: "Monospace font family (must be loaded in doc.fonts)";
                        };
                        readonly fontSize: {
                            readonly type: "number";
                        };
                        readonly lineHeight: {
                            readonly type: "number";
                        };
                        readonly bgColor: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly color: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly padding: {
                            readonly type: "number";
                        };
                        readonly spaceAfter: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly spaceBefore: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly keepTogether: {
                            readonly type: "boolean";
                        };
                        readonly language: {
                            readonly type: "string";
                            readonly description: "e.g. 'javascript', 'typescript', 'python'";
                        };
                    };
                }, {
                    readonly type: "object";
                    readonly required: readonly ["type", "content"];
                    readonly properties: {
                        readonly type: {
                            readonly type: "string";
                            readonly const: "callout";
                        };
                        readonly content: {
                            readonly type: "string";
                        };
                        readonly style: {
                            readonly type: "string";
                            readonly enum: readonly ["info", "warning", "tip", "note"];
                        };
                        readonly title: {
                            readonly type: "string";
                        };
                        readonly backgroundColor: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly borderColor: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly color: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly titleColor: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly fontFamily: {
                            readonly type: "string";
                        };
                        readonly fontWeight: {
                            readonly type: "number";
                            readonly enum: readonly [400, 700];
                        };
                        readonly fontSize: {
                            readonly type: "number";
                        };
                        readonly lineHeight: {
                            readonly type: "number";
                        };
                        readonly padding: {
                            readonly type: "number";
                            readonly description: "Shorthand for paddingH and paddingV. Default: 12";
                        };
                        readonly paddingH: {
                            readonly type: "number";
                            readonly description: "Horizontal padding inside box in pt. Default: 16";
                        };
                        readonly paddingV: {
                            readonly type: "number";
                            readonly description: "Vertical padding inside box in pt. Default: 10";
                        };
                        readonly spaceBefore: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly spaceAfter: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly keepTogether: {
                            readonly type: "boolean";
                        };
                        readonly dir: {
                            readonly type: "string";
                            readonly enum: readonly ["ltr", "rtl", "auto"];
                        };
                    };
                }, {
                    readonly type: "object";
                    readonly required: readonly ["type", "spans"];
                    readonly properties: {
                        readonly type: {
                            readonly type: "string";
                            readonly const: "rich-paragraph";
                        };
                        readonly spans: {
                            readonly type: "array";
                            readonly items: {
                                readonly type: "object";
                                readonly required: readonly ["text"];
                                readonly properties: {
                                    readonly text: {
                                        readonly type: "string";
                                    };
                                    readonly dir: {
                                        readonly type: "string";
                                        readonly enum: readonly ["ltr", "rtl", "auto"];
                                    };
                                    readonly fontFamily: {
                                        readonly type: "string";
                                    };
                                    readonly fontWeight: {
                                        readonly type: "number";
                                        readonly enum: readonly [400, 700];
                                    };
                                    readonly fontStyle: {
                                        readonly type: "string";
                                        readonly enum: readonly ["normal", "italic"];
                                    };
                                    readonly color: {
                                        readonly type: "string";
                                        readonly pattern: "^#[0-9A-Fa-f]{6}$";
                                        readonly description: "6-digit hex color e.g. #FF0000";
                                    };
                                    readonly fontSize: {
                                        readonly type: "number";
                                    };
                                    readonly underline: {
                                        readonly type: "boolean";
                                    };
                                    readonly strikethrough: {
                                        readonly type: "boolean";
                                    };
                                    readonly url: {
                                        readonly type: "string";
                                    };
                                    readonly href: {
                                        readonly type: "string";
                                    };
                                    readonly verticalAlign: {
                                        readonly type: "string";
                                        readonly enum: readonly ["superscript", "subscript"];
                                    };
                                    readonly smallCaps: {
                                        readonly type: "boolean";
                                    };
                                    readonly letterSpacing: {
                                        readonly type: "number";
                                    };
                                    readonly footnoteRef: {
                                        readonly type: "string";
                                    };
                                };
                            };
                        };
                        readonly dir: {
                            readonly type: "string";
                            readonly enum: readonly ["ltr", "rtl", "auto"];
                        };
                        readonly fontSize: {
                            readonly type: "number";
                        };
                        readonly lineHeight: {
                            readonly type: "number";
                        };
                        readonly align: {
                            readonly type: "string";
                            readonly enum: readonly ["left", "center", "right", "justify"];
                        };
                        readonly bgColor: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly spaceBefore: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly spaceAfter: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly keepTogether: {
                            readonly type: "boolean";
                        };
                        readonly letterSpacing: {
                            readonly type: "number";
                        };
                        readonly smallCaps: {
                            readonly type: "boolean";
                        };
                        readonly tabularNumbers: {
                            readonly type: "boolean";
                            readonly description: "Render digits at fixed slot width for aligned numeric columns.";
                        };
                        readonly columns: {
                            readonly type: "number";
                            readonly description: "Number of columns for multi-column layout. Default: 1";
                        };
                        readonly columnGap: {
                            readonly type: "number";
                            readonly description: "Gap between columns in pt. Default: 24";
                        };
                    };
                }, {
                    readonly type: "object";
                    readonly required: readonly ["type"];
                    readonly properties: {
                        readonly type: {
                            readonly type: "string";
                            readonly const: "toc";
                        };
                        readonly title: {
                            readonly type: "string";
                        };
                        readonly showTitle: {
                            readonly type: "boolean";
                        };
                        readonly minLevel: {
                            readonly type: "number";
                            readonly enum: readonly [1, 2, 3, 4];
                        };
                        readonly maxLevel: {
                            readonly type: "number";
                            readonly enum: readonly [1, 2, 3, 4];
                        };
                        readonly fontSize: {
                            readonly type: "number";
                        };
                        readonly titleFontSize: {
                            readonly type: "number";
                            readonly description: "Font size for TOC title. Default: fontSize + 4";
                        };
                        readonly levelIndent: {
                            readonly type: "number";
                            readonly description: "Indentation per level in pt. Default: 16";
                        };
                        readonly leader: {
                            readonly type: "string";
                            readonly description: "Leader character between entry and page number. Default: .";
                        };
                        readonly entrySpacing: {
                            readonly type: "number";
                            readonly description: "Space after each entry line in pt. Default: 4";
                        };
                        readonly fontFamily: {
                            readonly type: "string";
                        };
                        readonly spaceBefore: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly spaceAfter: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                    };
                }, {
                    readonly type: "object";
                    readonly required: readonly ["type", "id", "text"];
                    readonly properties: {
                        readonly type: {
                            readonly type: "string";
                            readonly const: "footnote-def";
                        };
                        readonly id: {
                            readonly type: "string";
                        };
                        readonly text: {
                            readonly type: "string";
                        };
                        readonly fontSize: {
                            readonly type: "number";
                        };
                        readonly fontFamily: {
                            readonly type: "string";
                        };
                        readonly spaceAfter: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                    };
                }, {
                    readonly type: "object";
                    readonly required: readonly ["type", "data"];
                    readonly properties: {
                        readonly type: {
                            readonly type: "string";
                            readonly const: "qr-code";
                        };
                        readonly data: {
                            readonly type: "string";
                        };
                        readonly size: {
                            readonly type: "number";
                        };
                        readonly errorCorrectionLevel: {
                            readonly type: "string";
                            readonly enum: readonly ["L", "M", "Q", "H"];
                        };
                        readonly foreground: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly background: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly align: {
                            readonly type: "string";
                            readonly enum: readonly ["left", "center", "right"];
                        };
                        readonly spaceBefore: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly spaceAfter: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                    };
                }, {
                    readonly type: "object";
                    readonly required: readonly ["type", "symbology", "data"];
                    readonly properties: {
                        readonly type: {
                            readonly type: "string";
                            readonly const: "barcode";
                        };
                        readonly symbology: {
                            readonly type: "string";
                            readonly description: "e.g. 'code128', 'ean13', 'qrcode'";
                        };
                        readonly data: {
                            readonly type: "string";
                        };
                        readonly width: {
                            readonly type: "number";
                        };
                        readonly height: {
                            readonly type: "number";
                        };
                        readonly includeText: {
                            readonly type: "boolean";
                        };
                        readonly align: {
                            readonly type: "string";
                            readonly enum: readonly ["left", "center", "right"];
                        };
                        readonly spaceBefore: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly spaceAfter: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                    };
                }, {
                    readonly type: "object";
                    readonly required: readonly ["type", "contents"];
                    readonly properties: {
                        readonly type: {
                            readonly type: "string";
                            readonly const: "comment";
                        };
                        readonly contents: {
                            readonly type: "string";
                        };
                        readonly author: {
                            readonly type: "string";
                        };
                        readonly color: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly open: {
                            readonly type: "boolean";
                        };
                        readonly spaceAfter: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                    };
                }, {
                    readonly type: "object";
                    readonly required: readonly ["type", "fieldType", "name"];
                    readonly properties: {
                        readonly type: {
                            readonly type: "string";
                            readonly const: "form-field";
                        };
                        readonly fieldType: {
                            readonly type: "string";
                            readonly enum: readonly ["text", "checkbox", "radio", "dropdown", "button"];
                        };
                        readonly name: {
                            readonly type: "string";
                        };
                        readonly label: {
                            readonly type: "string";
                        };
                        readonly placeholder: {
                            readonly type: "string";
                        };
                        readonly defaultValue: {
                            readonly type: "string";
                        };
                        readonly multiline: {
                            readonly type: "boolean";
                        };
                        readonly maxLength: {
                            readonly type: "number";
                        };
                        readonly checked: {
                            readonly type: "boolean";
                        };
                        readonly options: {
                            readonly type: "array";
                            readonly items: {
                                readonly type: "object";
                                readonly required: readonly ["value", "label"];
                                readonly properties: {
                                    readonly value: {
                                        readonly type: "string";
                                    };
                                    readonly label: {
                                        readonly type: "string";
                                    };
                                };
                            };
                        };
                        readonly width: {
                            readonly type: "number";
                        };
                        readonly height: {
                            readonly type: "number";
                        };
                        readonly fontSize: {
                            readonly type: "number";
                        };
                        readonly borderColor: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly backgroundColor: {
                            readonly type: "string";
                            readonly pattern: "^#[0-9A-Fa-f]{6}$";
                            readonly description: "6-digit hex color e.g. #FF0000";
                        };
                        readonly defaultSelected: {
                            readonly type: "string";
                            readonly description: "Pre-selected value for radio groups and dropdowns.";
                        };
                        readonly keepTogether: {
                            readonly type: "boolean";
                            readonly description: "If true, never break this element across pages. Default: true";
                        };
                        readonly spaceAfter: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly spaceBefore: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                    };
                }, {
                    readonly type: "object";
                    readonly required: readonly ["type", "image", "float", "content"];
                    readonly properties: {
                        readonly type: {
                            readonly type: "string";
                            readonly const: "float-group";
                        };
                        readonly image: {
                            readonly type: "object";
                            readonly required: readonly ["src"];
                            readonly properties: {
                                readonly src: {
                                    readonly type: "string";
                                    readonly description: "Absolute file path or URL";
                                };
                                readonly format: {
                                    readonly type: "string";
                                    readonly enum: readonly ["png", "jpg", "auto"];
                                };
                                readonly height: {
                                    readonly type: "number";
                                };
                            };
                        };
                        readonly float: {
                            readonly type: "string";
                            readonly enum: readonly ["left", "right"];
                        };
                        readonly floatWidth: {
                            readonly type: "number";
                            readonly description: "Image column width in pt. Default: 35% of content width.";
                        };
                        readonly floatGap: {
                            readonly type: "number";
                            readonly description: "Gap between image and text columns in pt. Default: 12";
                        };
                        readonly content: {
                            readonly type: "array";
                            readonly description: "Content elements rendered in the text column (paragraph, heading, rich-paragraph).";
                            readonly items: {
                                readonly type: "object";
                            };
                        };
                        readonly spaceBefore: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly spaceAfter: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                    };
                }, {
                    readonly type: "object";
                    readonly required: readonly ["type", "spec"];
                    readonly properties: {
                        readonly type: {
                            readonly type: "string";
                            readonly const: "chart";
                        };
                        readonly spec: {
                            readonly type: "object";
                            readonly description: "Vega-Lite JSON specification. Requires vega and vega-lite peer deps.";
                        };
                        readonly width: {
                            readonly type: "number";
                        };
                        readonly height: {
                            readonly type: "number";
                        };
                        readonly caption: {
                            readonly type: "string";
                            readonly description: "Optional figure caption rendered below the chart.";
                        };
                        readonly align: {
                            readonly type: "string";
                            readonly enum: readonly ["left", "center", "right"];
                        };
                        readonly spaceBefore: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                        readonly spaceAfter: {
                            readonly type: "number";
                            readonly description: "Space in points (pt)";
                        };
                    };
                }];
            };
        };
        readonly pageSize: {
            readonly description: "Page size. Default: A4 (595×842 pt). Custom: [width, height] in pt.";
            readonly oneOf: readonly [{
                readonly type: "string";
                readonly enum: readonly ["A4", "Letter", "Legal", "A3", "A5", "Tabloid"];
            }, {
                readonly type: "array";
                readonly items: {
                    readonly type: "number";
                };
                readonly minItems: 2;
                readonly maxItems: 2;
                readonly description: "[width, height] in points";
            }];
        };
        readonly margins: {
            readonly type: "object";
            readonly description: "Page margins in pt. Default: all 72pt (1 inch).";
            readonly properties: {
                readonly top: {
                    readonly type: "number";
                };
                readonly bottom: {
                    readonly type: "number";
                };
                readonly left: {
                    readonly type: "number";
                };
                readonly right: {
                    readonly type: "number";
                };
            };
        };
        readonly defaultFont: {
            readonly type: "string";
            readonly description: "Default font family for body text. Default: Inter";
        };
        readonly defaultFontSize: {
            readonly type: "number";
            readonly description: "Default font size in pt. Default: 12";
        };
        readonly defaultLineHeight: {
            readonly type: "number";
            readonly description: "Default line height in pt. Default: fontSize * 1.5";
        };
        readonly fonts: {
            readonly type: "array";
            readonly description: "Custom fonts to load and embed.";
            readonly items: {
                readonly type: "object";
                readonly required: readonly ["family", "src"];
                readonly properties: {
                    readonly family: {
                        readonly type: "string";
                    };
                    readonly weight: {
                        readonly type: "number";
                        readonly enum: readonly [400, 700];
                    };
                    readonly style: {
                        readonly type: "string";
                        readonly enum: readonly ["normal", "italic"];
                    };
                    readonly src: {
                        readonly type: "string";
                        readonly description: "Absolute file path to a TTF/OTF font file";
                    };
                };
            };
        };
        readonly header: {
            readonly type: "object";
            readonly description: "Header rendered at top of every page. Supports {{pageNumber}} and {{totalPages}}.";
            readonly required: readonly ["text"];
            readonly properties: {
                readonly text: {
                    readonly type: "string";
                    readonly description: "Use {{pageNumber}} and {{totalPages}} as tokens";
                };
                readonly fontSize: {
                    readonly type: "number";
                };
                readonly align: {
                    readonly type: "string";
                    readonly enum: readonly ["left", "center", "right"];
                };
                readonly fontFamily: {
                    readonly type: "string";
                };
                readonly fontWeight: {
                    readonly type: "number";
                    readonly enum: readonly [400, 700];
                };
                readonly color: {
                    readonly type: "string";
                    readonly pattern: "^#[0-9A-Fa-f]{6}$";
                    readonly description: "6-digit hex color e.g. #FF0000";
                };
            };
        };
        readonly footer: {
            readonly type: "object";
            readonly description: "Footer rendered at bottom of every page. Supports {{pageNumber}} and {{totalPages}}.";
            readonly required: readonly ["text"];
            readonly properties: {
                readonly text: {
                    readonly type: "string";
                    readonly description: "Use {{pageNumber}} and {{totalPages}} as tokens";
                };
                readonly fontSize: {
                    readonly type: "number";
                };
                readonly align: {
                    readonly type: "string";
                    readonly enum: readonly ["left", "center", "right"];
                };
                readonly fontFamily: {
                    readonly type: "string";
                };
                readonly fontWeight: {
                    readonly type: "number";
                    readonly enum: readonly [400, 700];
                };
                readonly color: {
                    readonly type: "string";
                    readonly pattern: "^#[0-9A-Fa-f]{6}$";
                    readonly description: "6-digit hex color e.g. #FF0000";
                };
            };
        };
        readonly sections: {
            readonly type: "array";
            readonly description: "Page-range overrides for header/footer. First matching section wins. Falls back to doc.header/footer.";
            readonly items: {
                readonly type: "object";
                readonly properties: {
                    readonly fromPage: {
                        readonly type: "number";
                        readonly description: "First page (1-based, inclusive). Default: 1";
                    };
                    readonly toPage: {
                        readonly type: "number";
                        readonly description: "Last page (1-based, inclusive). Default: Infinity";
                    };
                    readonly header: {
                        readonly type: "object";
                        readonly properties: {
                            readonly text: {
                                readonly type: "string";
                            };
                            readonly fontSize: {
                                readonly type: "number";
                            };
                            readonly align: {
                                readonly type: "string";
                                readonly enum: readonly ["left", "center", "right"];
                            };
                            readonly fontFamily: {
                                readonly type: "string";
                            };
                            readonly fontWeight: {
                                readonly type: "number";
                                readonly enum: readonly [400, 700];
                            };
                            readonly color: {
                                readonly type: "string";
                                readonly pattern: "^#[0-9A-Fa-f]{6}$";
                                readonly description: "6-digit hex color e.g. #FF0000";
                            };
                        };
                    };
                    readonly footer: {
                        readonly type: "object";
                        readonly properties: {
                            readonly text: {
                                readonly type: "string";
                            };
                            readonly fontSize: {
                                readonly type: "number";
                            };
                            readonly align: {
                                readonly type: "string";
                                readonly enum: readonly ["left", "center", "right"];
                            };
                            readonly fontFamily: {
                                readonly type: "string";
                            };
                            readonly fontWeight: {
                                readonly type: "number";
                                readonly enum: readonly [400, 700];
                            };
                            readonly color: {
                                readonly type: "string";
                                readonly pattern: "^#[0-9A-Fa-f]{6}$";
                                readonly description: "6-digit hex color e.g. #FF0000";
                            };
                        };
                    };
                };
            };
        };
        readonly watermark: {
            readonly type: "object";
            readonly description: "Watermark overlay rendered on every page behind content.";
            readonly properties: {
                readonly text: {
                    readonly type: "string";
                };
                readonly fontFamily: {
                    readonly type: "string";
                };
                readonly fontWeight: {
                    readonly type: "number";
                    readonly enum: readonly [400, 700];
                };
                readonly fontSize: {
                    readonly type: "number";
                };
                readonly color: {
                    readonly type: "string";
                    readonly pattern: "^#[0-9A-Fa-f]{6}$";
                    readonly description: "6-digit hex color e.g. #FF0000";
                };
                readonly opacity: {
                    readonly type: "number";
                    readonly minimum: 0;
                    readonly maximum: 1;
                };
                readonly rotation: {
                    readonly type: "number";
                    readonly description: "Rotation in degrees (counter-clockwise). Default: -45";
                };
            };
        };
        readonly encryption: {
            readonly type: "object";
            readonly description: "Password protection and permission control for the output PDF.";
            readonly properties: {
                readonly userPassword: {
                    readonly type: "string";
                    readonly description: "Password required to open the document.";
                };
                readonly ownerPassword: {
                    readonly type: "string";
                    readonly description: "Password for full unrestricted access.";
                };
                readonly permissions: {
                    readonly type: "object";
                    readonly properties: {
                        readonly printing: {
                            readonly type: "boolean";
                        };
                        readonly copying: {
                            readonly type: "boolean";
                        };
                        readonly modifying: {
                            readonly type: "boolean";
                        };
                        readonly annotating: {
                            readonly type: "boolean";
                        };
                    };
                };
            };
        };
        readonly metadata: {
            readonly type: "object";
            readonly description: "PDF document metadata written into file properties.";
            readonly properties: {
                readonly title: {
                    readonly type: "string";
                };
                readonly author: {
                    readonly type: "string";
                };
                readonly subject: {
                    readonly type: "string";
                };
                readonly keywords: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "string";
                    };
                };
                readonly creator: {
                    readonly type: "string";
                };
                readonly language: {
                    readonly type: "string";
                    readonly description: "BCP47 language tag e.g. 'en-US', 'hi', 'ar'";
                };
                readonly producer: {
                    readonly type: "string";
                };
            };
        };
        readonly defaultParagraphStyle: {
            readonly type: "object";
            readonly description: "Default style applied to every paragraph and heading that does not set the field explicitly.";
            readonly properties: {
                readonly fontSize: {
                    readonly type: "number";
                };
                readonly lineHeight: {
                    readonly type: "number";
                };
                readonly fontFamily: {
                    readonly type: "string";
                };
                readonly fontWeight: {
                    readonly type: "number";
                    readonly enum: readonly [400, 700];
                };
                readonly color: {
                    readonly type: "string";
                    readonly pattern: "^#[0-9A-Fa-f]{6}$";
                    readonly description: "6-digit hex color e.g. #FF0000";
                };
                readonly align: {
                    readonly type: "string";
                    readonly enum: readonly ["left", "center", "right", "justify"];
                };
                readonly letterSpacing: {
                    readonly type: "number";
                };
                readonly spaceBefore: {
                    readonly type: "number";
                    readonly description: "Space in points (pt)";
                };
                readonly spaceAfter: {
                    readonly type: "number";
                    readonly description: "Space in points (pt)";
                };
            };
        };
        readonly bookmarks: {
            readonly description: "PDF bookmark outline. Set to false to disable, or provide config object.";
            readonly oneOf: readonly [{
                readonly type: "boolean";
                readonly const: false;
            }, {
                readonly type: "object";
                readonly properties: {
                    readonly minLevel: {
                        readonly type: "number";
                        readonly enum: readonly [1, 2, 3, 4];
                    };
                    readonly maxLevel: {
                        readonly type: "number";
                        readonly enum: readonly [1, 2, 3, 4];
                    };
                };
            }];
        };
        readonly hyphenation: {
            readonly type: "object";
            readonly description: "Automatic word hyphenation. Requires installing the matching hyphenation.XX npm package.";
            readonly required: readonly ["language"];
            readonly properties: {
                readonly language: {
                    readonly type: "string";
                    readonly description: "Language code e.g. 'en-us', 'de', 'fr'";
                };
                readonly minWordLength: {
                    readonly type: "number";
                };
                readonly leftMin: {
                    readonly type: "number";
                };
                readonly rightMin: {
                    readonly type: "number";
                };
            };
        };
        readonly signature: {
            readonly type: "object";
            readonly description: "Visual signature placeholder drawn on a specified page.";
            readonly properties: {
                readonly signerName: {
                    readonly type: "string";
                };
                readonly reason: {
                    readonly type: "string";
                };
                readonly location: {
                    readonly type: "string";
                };
                readonly x: {
                    readonly type: "number";
                };
                readonly y: {
                    readonly type: "number";
                };
                readonly width: {
                    readonly type: "number";
                };
                readonly height: {
                    readonly type: "number";
                };
                readonly page: {
                    readonly type: "number";
                    readonly description: "Page index (0-based). Default: last page.";
                };
                readonly borderColor: {
                    readonly type: "string";
                    readonly pattern: "^#[0-9A-Fa-f]{6}$";
                    readonly description: "6-digit hex color e.g. #FF0000";
                };
                readonly fontSize: {
                    readonly type: "number";
                };
                readonly invisible: {
                    readonly type: "boolean";
                };
            };
        };
        readonly flattenForms: {
            readonly type: "boolean";
            readonly description: "If true, flatten all form fields into static content. Default: false";
        };
        readonly allowedFileDirs: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
            readonly description: "Restrict filesystem access to these absolute directory paths.";
        };
    };
};
//# sourceMappingURL=schema.d.ts.map