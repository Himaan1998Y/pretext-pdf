/**
 * Strict validation: allowed properties for each element and sub-structure type.
 * Enforced at runtime by strict: true validation.
 * Compile-time drift guards via Exact<T, Keys> ensure types stay synchronized.
 */
// ─── Key arrays with compile-time assertions ──────────────────────────────────
const DOC_KEYS = [
    'pageSize', 'margins', 'defaultFont', 'defaultFontSize', 'defaultLineHeight',
    'fonts', 'header', 'footer', 'watermark', 'encryption', 'signature', 'bookmarks',
    'hyphenation', 'metadata', 'defaultParagraphStyle', 'sections', 'content',
    'flattenForms', 'onImageLoadError', 'onFormFieldError', 'renderDate', 'allowedFileDirs',
];
const METADATA_KEYS = ['title', 'author', 'subject', 'keywords', 'creator', 'language', 'producer'];
const PARAGRAPH_KEYS = [
    'type', 'text', 'dir', 'fontSize', 'lineHeight', 'fontFamily', 'fontWeight', 'color',
    'align', 'bgColor', 'spaceAfter', 'spaceBefore', 'keepTogether', 'underline',
    'strikethrough', 'url', 'columns', 'columnGap', 'hyphenate', 'letterSpacing',
    'smallCaps', 'tabularNumbers', 'annotation',
];
const HEADING_KEYS = [
    'type', 'level', 'text', 'dir', 'fontFamily', 'fontWeight', 'fontSize', 'lineHeight',
    'align', 'color', 'bgColor', 'spaceBefore', 'spaceAfter', 'keepTogether', 'underline',
    'strikethrough', 'bookmark', 'hyphenate', 'url', 'anchor', 'letterSpacing', 'smallCaps',
    'tabularNumbers', 'annotation',
];
const SPACER_KEYS = ['type', 'height'];
const TABLE_KEYS = [
    'type', 'columns', 'rows', 'dir', 'headerRows', 'borderColor', 'borderWidth',
    'headerBgColor', 'fontSize', 'cellPaddingH', 'cellPaddingV', 'spaceAfter', 'spaceBefore',
];
const COLUMN_DEF_KEYS = ['width', 'align'];
const TABLE_ROW_KEYS = ['cells', 'isHeader'];
const TABLE_CELL_KEYS = [
    'text', 'dir', 'align', 'fontWeight', 'fontFamily', 'fontSize', 'color', 'bgColor',
    'colspan', 'rowspan', 'tabularNumbers',
];
const IMAGE_KEYS = [
    'type', 'src', 'format', 'width', 'height', 'align', 'spaceAfter', 'spaceBefore',
    'float', 'floatWidth', 'floatGap', 'floatText', 'floatSpans', 'floatFontSize',
    'floatFontFamily', 'floatColor',
];
const SVG_KEYS = ['type', 'svg', 'src', 'width', 'height', 'align', 'spaceBefore', 'spaceAfter'];
const QR_CODE_KEYS = [
    'type', 'data', 'size', 'errorCorrectionLevel', 'foreground', 'background', 'margin',
    'align', 'spaceBefore', 'spaceAfter',
];
const BARCODE_KEYS = [
    'type', 'symbology', 'data', 'width', 'height', 'includeText', 'align', 'spaceBefore', 'spaceAfter',
];
const CHART_KEYS = ['type', 'spec', 'width', 'height', 'caption', 'align', 'spaceBefore', 'spaceAfter'];
const LIST_KEYS = [
    'type', 'style', 'items', 'marker', 'indent', 'markerWidth', 'fontSize', 'lineHeight',
    'itemSpaceAfter', 'spaceAfter', 'spaceBefore', 'color', 'nestedNumberingStyle',
];
const LIST_ITEM_KEYS = ['text', 'dir', 'fontWeight', 'items'];
const HR_KEYS = ['type', 'thickness', 'color', 'spaceAbove', 'spaceBelow', 'spaceBefore', 'spaceAfter'];
const PAGE_BREAK_KEYS = ['type'];
const CODE_KEYS = [
    'type', 'text', 'dir', 'fontFamily', 'fontSize', 'lineHeight', 'bgColor', 'color',
    'padding', 'spaceAfter', 'spaceBefore', 'keepTogether', 'language', 'highlightTheme',
];
const RICH_PARAGRAPH_KEYS = [
    'type', 'spans', 'dir', 'fontSize', 'lineHeight', 'align', 'bgColor', 'spaceBefore',
    'spaceAfter', 'keepTogether', 'columns', 'columnGap', 'letterSpacing', 'smallCaps',
    'tabularNumbers',
];
const INLINE_SPAN_KEYS = [
    'text', 'dir', 'fontFamily', 'fontWeight', 'fontStyle', 'color', 'fontSize', 'underline',
    'strikethrough', 'url', 'href', 'verticalAlign', 'smallCaps', 'letterSpacing', 'footnoteRef',
];
const BLOCKQUOTE_KEYS = [
    'type', 'text', 'dir', 'borderColor', 'borderWidth', 'bgColor', 'color', 'fontFamily',
    'fontWeight', 'fontStyle', 'fontSize', 'lineHeight', 'padding', 'paddingH', 'paddingV',
    'align', 'spaceBefore', 'spaceAfter', 'keepTogether', 'underline', 'strikethrough',
];
const CALLOUT_KEYS = [
    'type', 'content', 'style', 'title', 'backgroundColor', 'borderColor', 'color', 'titleColor',
    'fontFamily', 'fontWeight', 'fontSize', 'lineHeight', 'padding', 'paddingH', 'paddingV',
    'spaceAfter', 'spaceBefore', 'keepTogether', 'dir',
];
const COMMENT_KEYS = ['type', 'contents', 'author', 'color', 'open', 'spaceAfter'];
const FORM_FIELD_KEYS = [
    'type', 'fieldType', 'name', 'label', 'placeholder', 'defaultValue', 'multiline',
    'maxLength', 'checked', 'options', 'defaultSelected', 'width', 'height', 'fontSize',
    'borderColor', 'backgroundColor', 'spaceAfter', 'spaceBefore', 'keepTogether',
];
const FOOTNOTE_DEF_KEYS = ['type', 'id', 'text', 'fontSize', 'fontFamily', 'spaceAfter'];
const TOC_KEYS = [
    'type', 'title', 'showTitle', 'minLevel', 'maxLevel', 'fontSize', 'titleFontSize',
    'levelIndent', 'leader', 'entrySpacing', 'fontFamily', 'spaceBefore', 'spaceAfter',
];
const TOC_ENTRY_KEYS = ['type', 'text', 'pageNumber', 'level', 'levelIndent', 'leader', 'fontFamily', 'fontWeight'];
const FLOAT_GROUP_KEYS = ['type', 'image', 'float', 'floatWidth', 'floatGap', 'content', 'spaceBefore', 'spaceAfter'];
const ANNOTATION_KEYS = ['contents', 'author', 'color', 'open'];
const ENCRYPTION_KEYS = ['userPassword', 'ownerPassword', 'permissions'];
// ─── Runtime Sets created from key arrays ─────────────────────────────────────
export const ALLOWED_PROPS = {
    'paragraph': new Set(PARAGRAPH_KEYS),
    'heading': new Set(HEADING_KEYS),
    'spacer': new Set(SPACER_KEYS),
    'table': new Set(TABLE_KEYS),
    'image': new Set(IMAGE_KEYS),
    'svg': new Set(SVG_KEYS),
    'qr-code': new Set(QR_CODE_KEYS),
    'barcode': new Set(BARCODE_KEYS),
    'chart': new Set(CHART_KEYS),
    'list': new Set(LIST_KEYS),
    'hr': new Set(HR_KEYS),
    'page-break': new Set(PAGE_BREAK_KEYS),
    'code': new Set(CODE_KEYS),
    'rich-paragraph': new Set(RICH_PARAGRAPH_KEYS),
    'blockquote': new Set(BLOCKQUOTE_KEYS),
    'toc': new Set(TOC_KEYS),
    'toc-entry': new Set(TOC_ENTRY_KEYS),
    'comment': new Set(COMMENT_KEYS),
    'form-field': new Set(FORM_FIELD_KEYS),
    'callout': new Set(CALLOUT_KEYS),
    'footnote-def': new Set(FOOTNOTE_DEF_KEYS),
    'float-group': new Set(FLOAT_GROUP_KEYS),
};
export const ALLOWED_PROPS_SUB = {
    'document': new Set(DOC_KEYS),
    'metadata': new Set(METADATA_KEYS),
    'column-def': new Set(COLUMN_DEF_KEYS),
    'table-row': new Set(TABLE_ROW_KEYS),
    'table-cell': new Set(TABLE_CELL_KEYS),
    'list-item': new Set(LIST_ITEM_KEYS),
    'inline-span': new Set(INLINE_SPAN_KEYS),
    'annotation': new Set(ANNOTATION_KEYS),
    'encryption': new Set(ENCRYPTION_KEYS),
};
//# sourceMappingURL=allowed-props.js.map