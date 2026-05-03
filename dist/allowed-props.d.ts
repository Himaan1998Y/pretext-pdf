/**
 * Strict validation: allowed properties for each element and sub-structure type.
 * Enforced at runtime by strict: true validation.
 * Compile-time drift guards via Exact<T, Keys> ensure types stay synchronized.
 */
export declare const ALLOWED_PROPS: {
    readonly paragraph: Set<"text" | "type" | "dir" | "fontSize" | "lineHeight" | "fontFamily" | "fontWeight" | "color" | "align" | "bgColor" | "spaceAfter" | "spaceBefore" | "keepTogether" | "underline" | "strikethrough" | "url" | "columns" | "columnGap" | "hyphenate" | "letterSpacing" | "smallCaps" | "tabularNumbers" | "annotation">;
    readonly heading: Set<"text" | "type" | "dir" | "fontSize" | "lineHeight" | "fontFamily" | "fontWeight" | "color" | "align" | "bgColor" | "spaceAfter" | "spaceBefore" | "keepTogether" | "underline" | "strikethrough" | "url" | "hyphenate" | "letterSpacing" | "smallCaps" | "tabularNumbers" | "annotation" | "level" | "bookmark" | "anchor">;
    readonly spacer: Set<"type" | "height">;
    readonly table: Set<"type" | "dir" | "fontSize" | "spaceAfter" | "spaceBefore" | "columns" | "rows" | "headerRows" | "borderColor" | "borderWidth" | "headerBgColor" | "cellPaddingH" | "cellPaddingV">;
    readonly image: Set<"type" | "align" | "spaceAfter" | "spaceBefore" | "height" | "width" | "src" | "format" | "float" | "floatWidth" | "floatGap" | "floatText" | "floatSpans" | "floatFontSize" | "floatFontFamily" | "floatColor">;
    readonly svg: Set<"svg" | "type" | "align" | "spaceAfter" | "spaceBefore" | "height" | "width" | "src">;
    readonly 'qr-code': Set<"type" | "align" | "spaceAfter" | "spaceBefore" | "data" | "size" | "errorCorrectionLevel" | "foreground" | "background" | "margin">;
    readonly barcode: Set<"type" | "align" | "spaceAfter" | "spaceBefore" | "height" | "width" | "data" | "symbology" | "includeText">;
    readonly chart: Set<"type" | "align" | "spaceAfter" | "spaceBefore" | "height" | "width" | "spec" | "caption">;
    readonly list: Set<"type" | "fontSize" | "lineHeight" | "color" | "spaceAfter" | "spaceBefore" | "style" | "items" | "marker" | "indent" | "markerWidth" | "itemSpaceAfter" | "nestedNumberingStyle">;
    readonly hr: Set<"type" | "color" | "spaceAfter" | "spaceBefore" | "thickness" | "spaceAbove" | "spaceBelow">;
    readonly 'page-break': Set<"type">;
    readonly code: Set<"text" | "language" | "type" | "dir" | "fontSize" | "lineHeight" | "fontFamily" | "color" | "bgColor" | "spaceAfter" | "spaceBefore" | "keepTogether" | "padding" | "highlightTheme">;
    readonly 'rich-paragraph': Set<"type" | "dir" | "fontSize" | "lineHeight" | "align" | "bgColor" | "spaceAfter" | "spaceBefore" | "keepTogether" | "columns" | "columnGap" | "letterSpacing" | "smallCaps" | "tabularNumbers" | "spans">;
    readonly blockquote: Set<"text" | "type" | "dir" | "fontSize" | "lineHeight" | "fontFamily" | "fontWeight" | "color" | "align" | "bgColor" | "spaceAfter" | "spaceBefore" | "keepTogether" | "underline" | "strikethrough" | "borderColor" | "borderWidth" | "padding" | "fontStyle" | "paddingH" | "paddingV">;
    readonly toc: Set<"title" | "type" | "fontSize" | "fontFamily" | "spaceAfter" | "spaceBefore" | "showTitle" | "minLevel" | "maxLevel" | "titleFontSize" | "levelIndent" | "leader" | "entrySpacing">;
    readonly 'toc-entry': Set<"text" | "type" | "fontFamily" | "fontWeight" | "level" | "levelIndent" | "leader" | "pageNumber">;
    readonly comment: Set<"author" | "type" | "color" | "spaceAfter" | "contents" | "open">;
    readonly 'form-field': Set<"type" | "fontSize" | "spaceAfter" | "spaceBefore" | "keepTogether" | "height" | "borderColor" | "width" | "backgroundColor" | "fieldType" | "name" | "label" | "placeholder" | "defaultValue" | "multiline" | "maxLength" | "checked" | "options" | "defaultSelected">;
    readonly callout: Set<"content" | "title" | "type" | "dir" | "fontSize" | "lineHeight" | "fontFamily" | "fontWeight" | "color" | "spaceAfter" | "spaceBefore" | "keepTogether" | "borderColor" | "style" | "padding" | "paddingH" | "paddingV" | "backgroundColor" | "titleColor">;
    readonly 'footnote-def': Set<"text" | "type" | "fontSize" | "fontFamily" | "spaceAfter" | "id">;
    readonly 'float-group': Set<"image" | "content" | "type" | "spaceAfter" | "spaceBefore" | "float" | "floatWidth" | "floatGap">;
};
export declare const ALLOWED_PROPS_SUB: {
    readonly document: Set<"header" | "footer" | "pageSize" | "margins" | "defaultFont" | "defaultFontSize" | "defaultLineHeight" | "fonts" | "watermark" | "encryption" | "signature" | "bookmarks" | "hyphenation" | "metadata" | "defaultParagraphStyle" | "sections" | "content" | "flattenForms" | "onImageLoadError" | "onFormFieldError" | "renderDate" | "allowedFileDirs">;
    readonly metadata: Set<"title" | "author" | "subject" | "keywords" | "creator" | "language" | "producer">;
    readonly 'column-def': Set<"align" | "width">;
    readonly 'table-row': Set<"cells" | "isHeader">;
    readonly 'table-cell': Set<"text" | "dir" | "fontSize" | "fontFamily" | "fontWeight" | "color" | "align" | "bgColor" | "tabularNumbers" | "colspan" | "rowspan">;
    readonly 'list-item': Set<"text" | "dir" | "fontWeight" | "items">;
    readonly 'inline-span': Set<"text" | "dir" | "fontSize" | "fontFamily" | "fontWeight" | "color" | "underline" | "strikethrough" | "url" | "letterSpacing" | "smallCaps" | "fontStyle" | "href" | "verticalAlign" | "footnoteRef">;
    readonly annotation: Set<"author" | "color" | "contents" | "open">;
    readonly encryption: Set<"userPassword" | "ownerPassword" | "permissions">;
};
//# sourceMappingURL=allowed-props.d.ts.map