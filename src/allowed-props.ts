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
  TextFormField,
  CheckboxFormField,
  RadioFormField,
  DropdownFormField,
  ButtonFormField,
  FootnoteDefElement,
  TocElement,
  FloatGroupElement,
  AnnotationSpec,
  TableRow,
  DocumentMetadata,
  EncryptionSpec,
} from './types.js'
import type { TocEntryElement } from './types-internal.js'

/** Compile-time assertion that T has exactly the keys in Keys (no more, no less) */
type Exact<T, Keys extends readonly (keyof T)[]> = T & Record<Exclude<keyof T, Keys[number]>, never>

// ─── Key arrays with compile-time assertions ──────────────────────────────────

const DOC_KEYS = [
  'pageSize', 'margins', 'defaultFont', 'defaultFontSize', 'defaultLineHeight',
  'fonts', 'header', 'footer', 'watermark', 'encryption', 'signature', 'bookmarks',
  'hyphenation', 'metadata', 'defaultParagraphStyle', 'sections', 'content',
  'flattenForms', 'onImageLoadError', 'onFormFieldError', 'renderDate', 'allowedFileDirs',
] as const

const METADATA_KEYS = ['title', 'author', 'subject', 'keywords', 'creator', 'language', 'producer', 'accessibility', 'semantic'] as const

const PARAGRAPH_KEYS = [
  'type', 'text', 'dir', 'fontSize', 'lineHeight', 'fontFamily', 'fontWeight', 'color',
  'align', 'bgColor', 'spaceAfter', 'spaceBefore', 'keepTogether', 'underline',
  'strikethrough', 'url', 'columns', 'columnGap', 'hyphenate', 'letterSpacing',
  'smallCaps', 'tabularNumbers', 'annotation',
] as const

const HEADING_KEYS = [
  'type', 'level', 'text', 'dir', 'fontFamily', 'fontWeight', 'fontSize', 'lineHeight',
  'align', 'color', 'bgColor', 'spaceBefore', 'spaceAfter', 'keepTogether', 'underline',
  'strikethrough', 'bookmark', 'hyphenate', 'url', 'anchor', 'letterSpacing', 'smallCaps',
  'tabularNumbers', 'annotation',
] as const

const SPACER_KEYS = ['type', 'height'] as const

const TABLE_KEYS = [
  'type', 'columns', 'rows', 'dir', 'headerRows', 'borderColor', 'borderWidth',
  'headerBgColor', 'fontSize', 'cellPaddingH', 'cellPaddingV', 'spaceAfter', 'spaceBefore',
] as const

const COLUMN_DEF_KEYS = ['width', 'align'] as const

const TABLE_ROW_KEYS = ['cells', 'isHeader'] as const

const TABLE_CELL_KEYS = [
  'text', 'dir', 'align', 'fontWeight', 'fontFamily', 'fontSize', 'color', 'bgColor',
  'colspan', 'rowspan', 'tabularNumbers',
] as const

const IMAGE_KEYS = [
  'type', 'src', 'format', 'width', 'height', 'align', 'spaceAfter', 'spaceBefore',
  'float', 'floatWidth', 'floatGap', 'floatText', 'floatSpans', 'floatFontSize',
  'floatFontFamily', 'floatColor',
] as const

const SVG_KEYS = ['type', 'svg', 'src', 'width', 'height', 'align', 'spaceBefore', 'spaceAfter'] as const

const QR_CODE_KEYS = [
  'type', 'data', 'size', 'errorCorrectionLevel', 'foreground', 'background', 'margin',
  'align', 'spaceBefore', 'spaceAfter',
] as const

const BARCODE_KEYS = [
  'type', 'symbology', 'data', 'width', 'height', 'includeText', 'align', 'spaceBefore', 'spaceAfter',
] as const

const CHART_KEYS = ['type', 'spec', 'width', 'height', 'caption', 'align', 'spaceBefore', 'spaceAfter'] as const

const LIST_KEYS = [
  'type', 'style', 'items', 'marker', 'indent', 'markerWidth', 'fontSize', 'lineHeight',
  'itemSpaceAfter', 'spaceAfter', 'spaceBefore', 'color', 'nestedNumberingStyle',
] as const

const LIST_ITEM_KEYS = ['text', 'dir', 'fontWeight', 'items'] as const

const HR_KEYS = ['type', 'thickness', 'color', 'spaceBefore', 'spaceAfter'] as const

const PAGE_BREAK_KEYS = ['type'] as const

const CODE_KEYS = [
  'type', 'text', 'dir', 'fontFamily', 'fontSize', 'lineHeight', 'bgColor', 'color',
  'padding', 'spaceAfter', 'spaceBefore', 'keepTogether', 'language', 'highlightTheme',
] as const

const RICH_PARAGRAPH_KEYS = [
  'type', 'spans', 'dir', 'fontSize', 'lineHeight', 'align', 'bgColor', 'spaceBefore',
  'spaceAfter', 'keepTogether', 'columns', 'columnGap', 'letterSpacing', 'smallCaps',
  'tabularNumbers',
] as const

const INLINE_SPAN_KEYS = [
  'text', 'dir', 'fontFamily', 'fontWeight', 'fontStyle', 'color', 'fontSize', 'underline',
  'strikethrough', 'url', 'href', 'verticalAlign', 'smallCaps', 'letterSpacing', 'footnoteRef',
] as const

const BLOCKQUOTE_KEYS = [
  'type', 'text', 'dir', 'borderColor', 'borderWidth', 'bgColor', 'color', 'fontFamily',
  'fontWeight', 'fontStyle', 'fontSize', 'lineHeight', 'padding', 'paddingH', 'paddingV',
  'align', 'spaceBefore', 'spaceAfter', 'keepTogether', 'underline', 'strikethrough',
] as const

const CALLOUT_KEYS = [
  'type', 'content', 'style', 'title', 'backgroundColor', 'borderColor', 'color', 'titleColor',
  'fontFamily', 'fontWeight', 'fontSize', 'lineHeight', 'padding', 'paddingH', 'paddingV',
  'spaceAfter', 'spaceBefore', 'keepTogether', 'dir',
] as const

const COMMENT_KEYS = ['type', 'contents', 'author', 'color', 'open', 'spaceAfter'] as const

const FORM_FIELD_BASE_KEYS = [
  'type', 'fieldType', 'name', 'label', 'width', 'height', 'fontSize',
  'borderColor', 'backgroundColor', 'spaceAfter', 'spaceBefore', 'keepTogether',
  'accessibilityLabel',
] as const

const TEXT_FORM_FIELD_KEYS = [...FORM_FIELD_BASE_KEYS, 'placeholder', 'defaultValue', 'multiline', 'maxLength'] as const
const CHECKBOX_FORM_FIELD_KEYS = [...FORM_FIELD_BASE_KEYS, 'checked'] as const
const RADIO_FORM_FIELD_KEYS = [...FORM_FIELD_BASE_KEYS, 'options', 'defaultSelected'] as const
const DROPDOWN_FORM_FIELD_KEYS = [...FORM_FIELD_BASE_KEYS, 'options', 'defaultSelected'] as const
const BUTTON_FORM_FIELD_KEYS = [...FORM_FIELD_BASE_KEYS] as const

const FOOTNOTE_DEF_KEYS = ['type', 'id', 'text', 'fontSize', 'fontFamily', 'spaceAfter'] as const

const TOC_KEYS = [
  'type', 'title', 'showTitle', 'minLevel', 'maxLevel', 'fontSize', 'titleFontSize',
  'levelIndent', 'leader', 'entrySpacing', 'fontFamily', 'spaceBefore', 'spaceAfter',
] as const

const TOC_ENTRY_KEYS = ['type', 'text', 'pageNumber', 'level', 'levelIndent', 'leader', 'fontFamily', 'fontWeight'] as const

const FLOAT_GROUP_KEYS = ['type', 'image', 'float', 'floatWidth', 'floatGap', 'content', 'spaceBefore', 'spaceAfter'] as const

const ANNOTATION_KEYS = ['contents', 'author', 'color', 'open'] as const

const ENCRYPTION_KEYS = ['userPassword', 'ownerPassword', 'permissions'] as const

/**
 * Compile-time drift guard — fails the build if any element/sub-structure type
 * gains or loses a property without the corresponding KEYS array being updated.
 * Consolidated from per-type `type _X = Exact<...>` aliases in v1.5.1 (M5a) to
 * keep noUnusedLocals enabled without 30 unused-type warnings. The tuple is
 * referenced via `export type` so TypeScript counts it as used.
 */
export type _AllowedPropsDriftGuard = [
  Exact<PdfDocument, typeof DOC_KEYS>,
  Exact<DocumentMetadata, typeof METADATA_KEYS>,
  Exact<ParagraphElement, typeof PARAGRAPH_KEYS>,
  Exact<HeadingElement, typeof HEADING_KEYS>,
  Exact<SpacerElement, typeof SPACER_KEYS>,
  Exact<TableElement, typeof TABLE_KEYS>,
  Exact<ColumnDef, typeof COLUMN_DEF_KEYS>,
  Exact<TableRow, typeof TABLE_ROW_KEYS>,
  Exact<TableCell, typeof TABLE_CELL_KEYS>,
  Exact<ImageElement, typeof IMAGE_KEYS>,
  Exact<SvgElement, typeof SVG_KEYS>,
  Exact<QrCodeElement, typeof QR_CODE_KEYS>,
  Exact<BarcodeElement, typeof BARCODE_KEYS>,
  Exact<ChartElement, typeof CHART_KEYS>,
  Exact<ListElement, typeof LIST_KEYS>,
  Exact<ListItem, typeof LIST_ITEM_KEYS>,
  Exact<HorizontalRuleElement, typeof HR_KEYS>,
  Exact<PageBreakElement, typeof PAGE_BREAK_KEYS>,
  Exact<CodeBlockElement, typeof CODE_KEYS>,
  Exact<RichParagraphElement, typeof RICH_PARAGRAPH_KEYS>,
  Exact<InlineSpan, typeof INLINE_SPAN_KEYS>,
  Exact<BlockquoteElement, typeof BLOCKQUOTE_KEYS>,
  Exact<CalloutElement, typeof CALLOUT_KEYS>,
  Exact<CommentElement, typeof COMMENT_KEYS>,
  Exact<TextFormField, typeof TEXT_FORM_FIELD_KEYS>,
  Exact<CheckboxFormField, typeof CHECKBOX_FORM_FIELD_KEYS>,
  Exact<RadioFormField, typeof RADIO_FORM_FIELD_KEYS>,
  Exact<DropdownFormField, typeof DROPDOWN_FORM_FIELD_KEYS>,
  Exact<ButtonFormField, typeof BUTTON_FORM_FIELD_KEYS>,
  Exact<FootnoteDefElement, typeof FOOTNOTE_DEF_KEYS>,
  Exact<TocElement, typeof TOC_KEYS>,
  Exact<TocEntryElement, typeof TOC_ENTRY_KEYS>,
  Exact<FloatGroupElement, typeof FLOAT_GROUP_KEYS>,
  Exact<AnnotationSpec, typeof ANNOTATION_KEYS>,
  Exact<EncryptionSpec, typeof ENCRYPTION_KEYS>,
]

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
  'callout': new Set(CALLOUT_KEYS),
  'footnote-def': new Set(FOOTNOTE_DEF_KEYS),
  'float-group': new Set(FLOAT_GROUP_KEYS),
  'form-field': new Set(FORM_FIELD_BASE_KEYS),
} as const

/** Per-variant allowed-property sets for form-field strict validation. */
export const FORM_FIELD_VARIANT_PROPS: Record<string, ReadonlySet<string>> = {
  text: new Set(TEXT_FORM_FIELD_KEYS),
  checkbox: new Set(CHECKBOX_FORM_FIELD_KEYS),
  radio: new Set(RADIO_FORM_FIELD_KEYS),
  dropdown: new Set(DROPDOWN_FORM_FIELD_KEYS),
  button: new Set(BUTTON_FORM_FIELD_KEYS),
}

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
} as const
