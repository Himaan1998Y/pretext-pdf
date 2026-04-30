/**
 * Strict validation: allowed properties for each element and sub-structure type.
 * Enforced at runtime by strict: true validation.
 * Compile-time drift guards via Exact<T, Keys> ensure types stay synchronized.
 */

import type {
  PdfDocument,
  ParagraphElement,
  HeadingElement,
  SpacerElement,
  TableElement,
  TableCell,
  ColumnDef,
  ImageElement,
  SvgElement,
  QrCodeElement,
  BarcodeElement,
  ChartElement,
  ListElement,
  ListItem,
  HorizontalRuleElement,
  PageBreakElement,
  CodeBlockElement,
  RichParagraphElement,
  InlineSpan,
  BlockquoteElement,
  CalloutElement,
  CommentElement,
  FormFieldElement,
  FootnoteDefElement,
  TocElement,
  TocEntryElement,
  FloatGroupElement,
  AnnotationSpec,
  TableRow,
  DocumentMetadata,
} from './types.js'

/** Compile-time assertion that T has exactly the keys in Keys (no more, no less) */
type Exact<T, Keys extends readonly (keyof T)[]> = T & Record<Exclude<keyof T, Keys[number]>, never>

// ─── Key arrays with compile-time assertions ──────────────────────────────────

const DOC_KEYS = [
  'pageSize', 'margins', 'defaultFont', 'defaultFontSize', 'defaultLineHeight',
  'fonts', 'header', 'footer', 'watermark', 'encryption', 'signature', 'bookmarks',
  'hyphenation', 'metadata', 'defaultParagraphStyle', 'sections', 'content',
  'flattenForms', 'onImageLoadError', 'onFormFieldError', 'renderDate', 'allowedFileDirs',
] as const
type _Doc = Exact<PdfDocument, typeof DOC_KEYS>

const METADATA_KEYS = ['title', 'author', 'subject', 'keywords', 'creator', 'language', 'producer'] as const
type _Metadata = Exact<DocumentMetadata, typeof METADATA_KEYS>

const PARAGRAPH_KEYS = [
  'type', 'text', 'dir', 'fontSize', 'lineHeight', 'fontFamily', 'fontWeight', 'color',
  'align', 'bgColor', 'spaceAfter', 'spaceBefore', 'keepTogether', 'underline',
  'strikethrough', 'url', 'columns', 'columnGap', 'hyphenate', 'letterSpacing',
  'smallCaps', 'tabularNumbers', 'annotation',
] as const
type _Paragraph = Exact<ParagraphElement, typeof PARAGRAPH_KEYS>

const HEADING_KEYS = [
  'type', 'level', 'text', 'dir', 'fontFamily', 'fontWeight', 'fontSize', 'lineHeight',
  'align', 'color', 'bgColor', 'spaceBefore', 'spaceAfter', 'keepTogether', 'underline',
  'strikethrough', 'bookmark', 'hyphenate', 'url', 'anchor', 'letterSpacing', 'smallCaps',
  'tabularNumbers', 'annotation',
] as const
type _Heading = Exact<HeadingElement, typeof HEADING_KEYS>

const SPACER_KEYS = ['type', 'height'] as const
type _Spacer = Exact<SpacerElement, typeof SPACER_KEYS>

const TABLE_KEYS = [
  'type', 'columns', 'rows', 'dir', 'headerRows', 'borderColor', 'borderWidth',
  'headerBgColor', 'fontSize', 'cellPaddingH', 'cellPaddingV', 'spaceAfter', 'spaceBefore',
] as const
type _Table = Exact<TableElement, typeof TABLE_KEYS>

const COLUMN_DEF_KEYS = ['width', 'align'] as const
type _ColumnDef = Exact<ColumnDef, typeof COLUMN_DEF_KEYS>

const TABLE_ROW_KEYS = ['cells', 'isHeader'] as const
type _TableRow = Exact<TableRow, typeof TABLE_ROW_KEYS>

const TABLE_CELL_KEYS = [
  'text', 'dir', 'align', 'fontWeight', 'fontFamily', 'fontSize', 'color', 'bgColor',
  'colspan', 'rowspan', 'tabularNumbers',
] as const
type _TableCell = Exact<TableCell, typeof TABLE_CELL_KEYS>

const IMAGE_KEYS = [
  'type', 'src', 'format', 'width', 'height', 'align', 'spaceAfter', 'spaceBefore',
  'float', 'floatWidth', 'floatGap', 'floatText', 'floatSpans', 'floatFontSize',
  'floatFontFamily', 'floatColor',
] as const
type _Image = Exact<ImageElement, typeof IMAGE_KEYS>

const SVG_KEYS = ['type', 'svg', 'src', 'width', 'height', 'align', 'spaceBefore', 'spaceAfter'] as const
type _Svg = Exact<SvgElement, typeof SVG_KEYS>

const QR_CODE_KEYS = [
  'type', 'data', 'size', 'errorCorrectionLevel', 'foreground', 'background', 'margin',
  'align', 'spaceBefore', 'spaceAfter',
] as const
type _QrCode = Exact<QrCodeElement, typeof QR_CODE_KEYS>

const BARCODE_KEYS = [
  'type', 'symbology', 'data', 'width', 'height', 'includeText', 'align', 'spaceBefore', 'spaceAfter',
] as const
type _Barcode = Exact<BarcodeElement, typeof BARCODE_KEYS>

const CHART_KEYS = ['type', 'spec', 'width', 'height', 'caption', 'align', 'spaceBefore', 'spaceAfter'] as const
type _Chart = Exact<ChartElement, typeof CHART_KEYS>

const LIST_KEYS = [
  'type', 'style', 'items', 'marker', 'indent', 'markerWidth', 'fontSize', 'lineHeight',
  'itemSpaceAfter', 'spaceAfter', 'spaceBefore', 'color', 'nestedNumberingStyle',
] as const
type _List = Exact<ListElement, typeof LIST_KEYS>

const LIST_ITEM_KEYS = ['text', 'dir', 'fontWeight', 'items'] as const
type _ListItem = Exact<ListItem, typeof LIST_ITEM_KEYS>

const HR_KEYS = ['type', 'thickness', 'color', 'spaceAbove', 'spaceBelow', 'spaceBefore', 'spaceAfter'] as const
type _Hr = Exact<HorizontalRuleElement, typeof HR_KEYS>

const PAGE_BREAK_KEYS = ['type'] as const
type _PageBreak = Exact<PageBreakElement, typeof PAGE_BREAK_KEYS>

const CODE_KEYS = [
  'type', 'text', 'dir', 'fontFamily', 'fontSize', 'lineHeight', 'bgColor', 'color',
  'padding', 'spaceAfter', 'spaceBefore', 'keepTogether', 'language', 'highlightTheme',
] as const
type _Code = Exact<CodeBlockElement, typeof CODE_KEYS>

const RICH_PARAGRAPH_KEYS = [
  'type', 'spans', 'dir', 'fontSize', 'lineHeight', 'align', 'bgColor', 'spaceBefore',
  'spaceAfter', 'keepTogether', 'columns', 'columnGap', 'letterSpacing', 'smallCaps',
  'tabularNumbers',
] as const
type _RichParagraph = Exact<RichParagraphElement, typeof RICH_PARAGRAPH_KEYS>

const INLINE_SPAN_KEYS = [
  'text', 'dir', 'fontFamily', 'fontWeight', 'fontStyle', 'color', 'fontSize', 'underline',
  'strikethrough', 'url', 'href', 'verticalAlign', 'smallCaps', 'letterSpacing', 'footnoteRef',
] as const
type _InlineSpan = Exact<InlineSpan, typeof INLINE_SPAN_KEYS>

const BLOCKQUOTE_KEYS = [
  'type', 'text', 'dir', 'borderColor', 'borderWidth', 'bgColor', 'color', 'fontFamily',
  'fontWeight', 'fontStyle', 'fontSize', 'lineHeight', 'padding', 'paddingH', 'paddingV',
  'align', 'spaceBefore', 'spaceAfter', 'keepTogether', 'underline', 'strikethrough',
] as const
type _Blockquote = Exact<BlockquoteElement, typeof BLOCKQUOTE_KEYS>

const CALLOUT_KEYS = [
  'type', 'content', 'style', 'title', 'backgroundColor', 'borderColor', 'color', 'titleColor',
  'fontFamily', 'fontWeight', 'fontSize', 'lineHeight', 'padding', 'paddingH', 'paddingV',
  'spaceAfter', 'spaceBefore', 'keepTogether', 'dir',
] as const
type _Callout = Exact<CalloutElement, typeof CALLOUT_KEYS>

const COMMENT_KEYS = ['type', 'contents', 'author', 'color', 'open', 'spaceAfter'] as const
type _Comment = Exact<CommentElement, typeof COMMENT_KEYS>

const FORM_FIELD_KEYS = [
  'type', 'fieldType', 'name', 'label', 'placeholder', 'defaultValue', 'multiline',
  'maxLength', 'checked', 'options', 'defaultSelected', 'width', 'height', 'fontSize',
  'borderColor', 'backgroundColor', 'spaceAfter', 'spaceBefore', 'keepTogether',
] as const
type _FormField = Exact<FormFieldElement, typeof FORM_FIELD_KEYS>

const FOOTNOTE_DEF_KEYS = ['type', 'id', 'text', 'fontSize', 'fontFamily', 'spaceAfter'] as const
type _FootnoteDef = Exact<FootnoteDefElement, typeof FOOTNOTE_DEF_KEYS>

const TOC_KEYS = [
  'type', 'title', 'showTitle', 'minLevel', 'maxLevel', 'fontSize', 'titleFontSize',
  'levelIndent', 'leader', 'entrySpacing', 'fontFamily', 'spaceBefore', 'spaceAfter',
] as const
type _Toc = Exact<TocElement, typeof TOC_KEYS>

const TOC_ENTRY_KEYS = ['type', 'text', 'pageNumber', 'level', 'levelIndent', 'leader', 'fontFamily', 'fontWeight'] as const
type _TocEntry = Exact<TocEntryElement, typeof TOC_ENTRY_KEYS>

const FLOAT_GROUP_KEYS = ['type', 'image', 'float', 'floatWidth', 'floatGap', 'content', 'spaceBefore', 'spaceAfter'] as const
type _FloatGroup = Exact<FloatGroupElement, typeof FLOAT_GROUP_KEYS>

const ANNOTATION_KEYS = ['contents', 'author', 'color', 'open'] as const
type _Annotation = Exact<AnnotationSpec, typeof ANNOTATION_KEYS>

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
} as const

export const ALLOWED_PROPS_SUB = {
  'document': new Set(DOC_KEYS),
  'metadata': new Set(METADATA_KEYS),
  'column-def': new Set(COLUMN_DEF_KEYS),
  'table-row': new Set(TABLE_ROW_KEYS),
  'table-cell': new Set(TABLE_CELL_KEYS),
  'list-item': new Set(LIST_ITEM_KEYS),
  'inline-span': new Set(INLINE_SPAN_KEYS),
  'annotation': new Set(ANNOTATION_KEYS),
} as const
