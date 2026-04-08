import type {
  PdfDocument, ContentElement, MeasuredBlock, MeasuredTableData,
  MeasuredTableRow, MeasuredTableCell, MeasuredImageData, ListItemData,
  PretextLine, ImageMap, ColumnDef, TableElement
} from './types.js'
import { PretextPdfError } from './errors.js'
import { measureRichText } from './rich-text.js'

/** Heading level size multipliers and defaults */
const HEADING_DEFAULTS = {
  1: { sizeMultiplier: 2.0,  fontWeight: 700 as const, spaceAfter: 16, spaceBefore: 28 },
  2: { sizeMultiplier: 1.5,  fontWeight: 700 as const, spaceAfter: 12, spaceBefore: 24 },
  3: { sizeMultiplier: 1.25, fontWeight: 700 as const, spaceAfter: 8,  spaceBefore: 20 },
  4: { sizeMultiplier: 1.1,  fontWeight: 700 as const, spaceAfter: 6,  spaceBefore: 16 },
}

/** Lazily-loaded Pretext module — must be imported AFTER polyfill is installed */
let _pretext: typeof import('@chenglou/pretext') | null = null

async function getPretext() {
  if (!_pretext) {
    _pretext = await import('@chenglou/pretext')
  }
  return _pretext
}

// ─── Hyphenation (Liang's algorithm via hypher package) ──────────────────────

type HypherInstance = { hyphenate(word: string): string[] }
type HyphenatorOpts = { instance: HypherInstance; minWordLength: number; leftMin: number; rightMin: number }

async function getHyphenator(language: string): Promise<HypherInstance> {
  let dict: object
  try {
    const mod = await import(`hyphenation.${language}`)
    dict = (mod as any).default ?? mod
  } catch {
    throw new PretextPdfError(
      'UNSUPPORTED_LANGUAGE',
      `Hyphenation dictionary for "${language}" not found. Install it with: pnpm add hyphenation.${language}`
    )
  }
  // @ts-ignore hypher has no type definitions available
  const { default: Hypher } = await import('hypher')
  return new Hypher(dict)
}

// ─── RTL Text Support (Unicode Bidirectional Algorithm via bidi-js) ────────────

/**
 * Detect text direction and apply Unicode Bidi Algorithm (TR9) for visual reordering.
 * Returns the visual-order text ready for measurement and rendering.
 *
 * @param text Logical-order input text (how user types it)
 * @param dirOverride Explicit direction override ('ltr', 'rtl', or 'auto')
 * @returns { visual, isRTL, logical } where visual is reordered text ready to render
 */
async function detectAndReorderRTL(
  text: string,
  dirOverride?: 'ltr' | 'rtl' | 'auto'
): Promise<{ visual: string; isRTL: boolean; logical: string }> {
  // Step 1: Explicit override takes priority
  if (dirOverride === 'ltr') {
    return { visual: text, isRTL: false, logical: text }
  }

  if (dirOverride === 'rtl') {
    // Even with override, apply bidi algorithm to get correct visual order
    try {
      // @ts-ignore bidi-js has no type definitions
      const bidiFactory = (await import('bidi-js')).default
      const bidi = typeof bidiFactory === 'function' ? bidiFactory() : bidiFactory
      const { getEmbeddingLevels, getReorderedString } = bidi
      const embedLevelsResult = getEmbeddingLevels(text, 'rtl')
      const visual = getReorderedString(text, embedLevelsResult)
      return { visual, isRTL: true, logical: text }
    } catch (err) {
      console.warn('bidi-js error during RTL reordering:', err, '— falling back to logical order')
      return { visual: text, isRTL: false, logical: text }
    }
  }

  // Step 2: Auto-detect dominant direction
  // Hebrew (U+0590–U+05FF), Arabic (U+0600–U+06FF), Syriac (U+0700–U+074F)
  const rtlRanges = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/g
  const rtlCount = (text.match(rtlRanges) ?? []).length
  const ltrCount = (text.match(/[a-zA-Z0-9]/g) ?? []).length

  const isRTL = rtlCount > 0 && rtlCount >= ltrCount

  if (!isRTL) {
    return { visual: text, isRTL: false, logical: text }
  }

  // Step 3: Apply bidi algorithm (TR9) to reorder visually
  try {
    // @ts-ignore bidi-js has no type definitions
    const bidiFactory = (await import('bidi-js')).default
    const bidi = typeof bidiFactory === 'function' ? bidiFactory() : bidiFactory
    const { getEmbeddingLevels, getReorderedString } = bidi
    const embedLevelsResult = getEmbeddingLevels(text, 'rtl')
    const visual = getReorderedString(text, embedLevelsResult)

    return { visual, isRTL: true, logical: text }
  } catch (err) {
    // Graceful fallback: if bidi-js throws (rare), use logical order
    console.warn('bidi-js error during RTL reordering:', err, '— falling back to logical order')
    return { visual: text, isRTL: false, logical: text }
  }
}

/**
 * Measure a single word's rendered width using pretext at maxWidth=99999.
 */
async function measureWord(word: string, fontString: string): Promise<number> {
  const { prepareWithSegments, layoutWithLines } = await getPretext()
  if (!word) return 0
  const prepared = prepareWithSegments(word, fontString, {})
  const result = layoutWithLines(prepared, 99999, 99999)
  const lines: Array<{ text: string; width: number }> = result.lines ?? []
  return lines[0]?.width ?? 0
}

/**
 * Stage 3: Measure a single content element.
 *
 * Returns MeasuredBlock for most types.
 * Returns MeasuredBlock[] for 'list' (each item becomes an independent block).
 *
 * NOTE: Image elements cannot be measured here — use measureAllBlocks() instead,
 * which resolves the content-index-based imageMap key before calling measureImageWithKey().
 */
export async function measureBlock(
  element: ContentElement,
  contentWidth: number,
  doc: PdfDocument,
  hyphenatorOpts?: HyphenatorOpts,
): Promise<MeasuredBlock | MeasuredBlock[]> {
  const baseFontSize = doc.defaultFontSize ?? 12
  const baseFont = doc.defaultFont ?? 'Inter'

  switch (element.type) {
    case 'spacer': {
      return {
        element,
        height: element.height,
        lines: [],
        fontSize: 0,
        lineHeight: 0,
        fontKey: '',
        spaceAfter: 0,
        spaceBefore: 0,
      }
    }

    case 'page-break': {
      return {
        element,
        height: 0,
        lines: [],
        fontSize: 0,
        lineHeight: 0,
        fontKey: '',
        spaceAfter: 0,
        spaceBefore: 0,
      }
    }

    case 'comment': {
      return {
        element,
        height: 20,
        lines: [],
        fontSize: 0,
        lineHeight: 0,
        fontKey: '',
        spaceAfter: (element as any).spaceAfter ?? 0,
        spaceBefore: 0,
      }
    }

    case 'paragraph': {
      // NEW (Phase 7F): Detect and reorder RTL text
      const { visual: visualText, isRTL, logical: logicalText } = await detectAndReorderRTL(element.text, element.dir)

      const fontSize = element.fontSize ?? baseFontSize
      const lineHeight = element.lineHeight ?? doc.defaultLineHeight ?? (fontSize * 1.5)
      const fontFamily = element.fontFamily ?? baseFont
      const fontWeight = element.fontWeight ?? 400
      const fontKey = buildFontKey(fontFamily, fontWeight, 'normal')

      const columns = element.columns ?? 1
      const columnGap = element.columnGap ?? 24
      let measureWidth = contentWidth
      let columnData: { columnCount: number; columnGap: number; columnWidth: number; linesPerColumn: number } | undefined

      // Multi-column layout
      if (columns > 1) {
        const columnWidth = (contentWidth - (columns - 1) * columnGap) / columns
        if (columnWidth < 50) {
          throw new PretextPdfError('COLUMN_WIDTH_TOO_NARROW', `Column width would be ${columnWidth.toFixed(1)}pt, which is below the minimum 50pt. Reduce columns, increase columnGap, or increase page width.`)
        }
        measureWidth = columnWidth
      }

      const opts = hyphenatorOpts && element.hyphenate !== false ? hyphenatorOpts : undefined
      // CRITICAL (Phase 7F): Measure the VISUAL-ORDER text (what will actually be rendered)
      const lines = await measureText(visualText, fontSize, fontFamily, fontWeight, measureWidth, lineHeight, opts)

      if (columns > 1) {
        const columnWidth = (contentWidth - (columns - 1) * columnGap) / columns
        const linesPerColumn = Math.ceil(lines.length / columns)
        columnData = { columnCount: columns, columnGap, columnWidth, linesPerColumn }
      }

      // Construct result with or without columnData depending on columns value
      if (columnData) {
        return {
          element,
          height: columnData.linesPerColumn * lineHeight,
          lines,
          fontSize,
          lineHeight,
          fontKey,
          spaceAfter: element.spaceAfter ?? 0,
          spaceBefore: element.spaceBefore ?? 0,
          columnData,
          isRTL,  // NEW (Phase 7F)
          ...(isRTL && { logicalText }),  // NEW: Only store logical text when RTL
        }
      } else {
        return {
          element,
          height: lines.length * lineHeight,
          lines,
          fontSize,
          lineHeight,
          fontKey,
          spaceAfter: element.spaceAfter ?? 0,
          spaceBefore: element.spaceBefore ?? 0,
          isRTL,  // NEW (Phase 7F)
          ...(isRTL && { logicalText }),  // NEW: Only store logical text when RTL
        }
      }
    }

    case 'heading': {
      // NEW (Phase 7F): Detect and reorder RTL text
      const { visual: visualText, isRTL, logical: logicalText } = await detectAndReorderRTL(element.text, element.dir)

      const defaults = HEADING_DEFAULTS[element.level]
      const fontSize = element.fontSize ?? (baseFontSize * defaults.sizeMultiplier)
      const lineHeight = element.lineHeight ?? doc.defaultLineHeight ?? (fontSize * 1.4) // tighter for headings
      const fontFamily = element.fontFamily ?? baseFont
      const fontWeight = element.fontWeight ?? defaults.fontWeight
      const fontKey = buildFontKey(fontFamily, fontWeight, 'normal')

      const opts = hyphenatorOpts && element.hyphenate !== false ? hyphenatorOpts : undefined
      // CRITICAL (Phase 7F): Measure the VISUAL-ORDER text (what will actually be rendered)
      const lines = await measureText(visualText, fontSize, fontFamily, fontWeight, contentWidth, lineHeight, opts)

      return {
        element,
        height: lines.length * lineHeight,
        lines,
        fontSize,
        lineHeight,
        fontKey,
        spaceAfter: element.spaceAfter ?? defaults.spaceAfter,
        spaceBefore: element.spaceBefore ?? defaults.spaceBefore,
        isRTL,  // NEW (Phase 7F)
        ...(isRTL && { logicalText }),  // NEW: Only store logical text when RTL
      }
    }

    case 'hr': {
      const spaceAbove = element.spaceAbove ?? 12
      const thickness = element.thickness ?? 0.5
      const spaceBelow = element.spaceBelow ?? 12
      return {
        element,
        height: spaceAbove + thickness + spaceBelow,
        lines: [],
        fontSize: 0,
        lineHeight: 0,
        fontKey: '',
        spaceAfter: 0,
        spaceBefore: 0,
      }
    }

    case 'image': {
      // Image elements must be measured via measureAllBlocks() — not measureBlock() directly.
      // measureAllBlocks() resolves the content-index-based imageMap key (img-N) before calling
      // measureImageWithKey(). measureBlock() doesn't have access to the content index.
      throw new PretextPdfError(
        'VALIDATION_ERROR',
        'Image elements cannot be measured via measureBlock() directly — use measureAllBlocks() which resolves the imageMap key correctly.'
      )
    }

    case 'svg': {
      // SVG elements must be measured via measureAllBlocks() — not measureBlock() directly.
      // measureAllBlocks() resolves the content-index-based imageMap key (svg-N) before calling
      // measureImageWithKey(). measureBlock() doesn't have access to the content index.
      throw new PretextPdfError(
        'VALIDATION_ERROR',
        'SVG elements cannot be measured via measureBlock() directly — use measureAllBlocks() which resolves the imageMap key correctly.'
      )
    }

    case 'list': {
      return measureList(element, contentWidth, doc, baseFontSize, hyphenatorOpts)
    }

    case 'table': {
      return measureTable(element, contentWidth, doc, baseFontSize, hyphenatorOpts)
    }

    case 'rich-paragraph': {
      // NEW (Phase 7F): Detect paragraph-level RTL direction (for alignment default)
      // Individual spans can override via span.dir, but paragraph.dir sets the default
      const fullText = element.spans.map(s => s.text).join('')
      const { isRTL } = await detectAndReorderRTL(fullText, element.dir)

      const fontSize = element.fontSize ?? baseFontSize
      const lineHeight = element.lineHeight ?? doc.defaultLineHeight ?? (fontSize * 1.5)
      // 'justify' uses left alignment for measurement (justify is rendering-only)
      const alignRaw = element.align ?? 'left'
      const align = alignRaw === 'justify' ? 'left' : alignRaw as 'left' | 'center' | 'right'

      const columns = element.columns ?? 1
      const columnGap = element.columnGap ?? 24
      let measureWidth = contentWidth
      let columnData: { columnCount: number; columnGap: number; columnWidth: number; linesPerColumn: number } | undefined

      // Multi-column layout
      if (columns > 1) {
        const columnWidth = (contentWidth - (columns - 1) * columnGap) / columns
        if (columnWidth < 50) {
          throw new PretextPdfError('COLUMN_WIDTH_TOO_NARROW', `Column width would be ${columnWidth.toFixed(1)}pt, which is below the minimum 50pt. Reduce columns, increase columnGap, or increase page width.`)
        }
        measureWidth = columnWidth
      }

      const richLines = await measureRichText(
        element.spans,
        fontSize,
        lineHeight,
        measureWidth,
        align,
        doc
      )

      if (columns > 1) {
        const columnWidth = (contentWidth - (columns - 1) * columnGap) / columns
        const linesPerColumn = Math.ceil(richLines.length / columns)
        columnData = { columnCount: columns, columnGap, columnWidth, linesPerColumn }
      }

      // For paginator/renderer compatibility, also produce a flat lines[] array
      // (used for orphan/widow logic and line-count-based pagination).
      // Each RichLine becomes one PretextLine with its totalWidth.
      const lines: PretextLine[] = richLines.map(rl => ({
        text: rl.fragments.map(f => f.text).join(''),
        width: rl.totalWidth,
      }))

      // Construct result with or without columnData depending on columns value
      // Phase 5B.4: Block height = sum of per-line heights (variable when spans have different fontSize)
      const blockHeight = richLines.reduce((sum, rl) => sum + rl.lineHeight, 0)

      if (columnData) {
        return {
          element,
          height: blockHeight,  // richLines already have per-line heights
          lines,
          fontSize,
          lineHeight,
          fontKey: buildFontKey(doc.defaultFont ?? 'Inter', 400, 'normal'),
          spaceAfter: element.spaceAfter ?? 0,
          spaceBefore: element.spaceBefore ?? 0,
          richLines,
          columnData,
          isRTL,  // NEW (Phase 7F)
        }
      } else {
        return {
          element,
          height: blockHeight,  // richLines already have per-line heights
          lines,
          fontSize,
          lineHeight,
          fontKey: buildFontKey(doc.defaultFont ?? 'Inter', 400, 'normal'),
          spaceAfter: element.spaceAfter ?? 0,
          spaceBefore: element.spaceBefore ?? 0,
          richLines,
          isRTL,  // NEW (Phase 7F)
        }
      }
    }

    case 'code': {
      const fontSize = element.fontSize ?? Math.max(baseFontSize - 2, 8)
      const lineHeight = element.lineHeight ?? (fontSize * 1.4)
      const padding = element.padding ?? 8
      // Text area is narrower by padding on both sides
      const textWidth = contentWidth - 2 * padding

      // Code blocks: never hyphenate — breaks would corrupt source code meaning
      // Code blocks: always measure in logical (LTR) order — reordering breaks syntax
      const lines = await measureText(element.text, fontSize, element.fontFamily, 400, Math.max(textWidth, 1), lineHeight)

      // height = lines * lineHeight + padding top + padding bottom
      const height = (lines.length || 1) * lineHeight + 2 * padding

      return {
        element,
        height,
        lines,
        fontSize,
        lineHeight,
        fontKey: buildFontKey(element.fontFamily, 400, 'normal'),
        spaceAfter: element.spaceAfter ?? 12,
        spaceBefore: element.spaceBefore ?? 12,
        codePadding: padding,
        isRTL: false,  // NEW (Phase 7F): Code blocks always LTR
      }
    }

    case 'blockquote': {
      // NEW (Phase 7F): Detect and reorder RTL text
      const { visual: visualText, isRTL, logical: logicalText } = await detectAndReorderRTL(element.text, element.dir)

      const fontSize = element.fontSize ?? baseFontSize
      const lineHeight = element.lineHeight ?? doc.defaultLineHeight ?? (fontSize * 1.5)
      const fontFamily = element.fontFamily ?? baseFont
      const fontWeight = element.fontWeight ?? 400
      const fontStyle = element.fontStyle ?? 'normal'
      const fontKey = buildFontKey(fontFamily, fontWeight, fontStyle)
      const borderWidth = element.borderWidth ?? 3
      const paddingH = element.paddingH ?? element.padding ?? 16
      const paddingV = element.paddingV ?? element.padding ?? 10

      // Text area excludes left border + horizontal padding on both sides
      const textWidth = contentWidth - borderWidth - 2 * paddingH

      // CRITICAL (Phase 7F): Measure the VISUAL-ORDER text (what will actually be rendered)
      const lines = await measureText(visualText, fontSize, fontFamily, fontWeight, Math.max(textWidth, 1), lineHeight, hyphenatorOpts)

      // height = lines * lineHeight + padding top + padding bottom
      const height = (lines.length || 1) * lineHeight + 2 * paddingV

      return {
        element,
        height,
        lines,
        fontSize,
        lineHeight,
        fontKey,
        spaceAfter: element.spaceAfter ?? 12,
        spaceBefore: element.spaceBefore ?? 0,
        blockquotePaddingV: paddingV,
        blockquotePaddingH: paddingH,
        blockquoteBorderWidth: borderWidth,
        isRTL,  // NEW (Phase 7F)
        ...(isRTL && { logicalText }),  // NEW: Only store logical text when RTL
      }
    }
    case 'toc': {
      // Placeholder: zero height. Will be replaced by actual TOC entries in two-pass mode.
      return {
        element,
        height: 0,
        lines: [],
        fontSize: 0,
        lineHeight: 0,
        fontKey: '',
        spaceAfter: element.spaceAfter ?? 0,
        spaceBefore: element.spaceBefore ?? 0,
      } satisfies import('./types.js').MeasuredBlock
    }
    case 'toc-entry': {
      // Internal type - should never be measured directly by user input
      throw new PretextPdfError('VALIDATION_ERROR', 'toc-entry is an internal type and cannot be used in document content')
    }
  }
}

// ─── HR is trivial (handled inline above) ────────────────────────────────────

// ─── Image measurement ────────────────────────────────────────────────────────

/** Measure an image element with its known imageMap key */
async function measureImageWithKey(
  element: import('./types.js').ImageElement,
  imageKey: string,
  imageMap: ImageMap,
  contentWidth: number,
  pageContentHeight: number
): Promise<MeasuredBlock> {
  const pdfImage = imageMap.get(imageKey)
  if (!pdfImage) {
    throw new PretextPdfError(
      'IMAGE_LOAD_FAILED',
      `Image "${imageKey}": not found in imageMap. This is an internal error — please report it.`
    )
  }

  // Natural dimensions (in original pixels — aspect ratio is what matters, not the pixel count)
  const naturalWidth = pdfImage.width
  const naturalHeight = pdfImage.height

  // Resolve render dimensions (in pt)
  let renderWidth: number
  let renderHeight: number

  if (element.width !== undefined && element.height !== undefined) {
    // Both provided: use as-is
    renderWidth = element.width
    renderHeight = element.height
  } else if (element.width !== undefined) {
    // Width only: scale height
    renderWidth = element.width
    renderHeight = renderWidth * (naturalHeight / naturalWidth)
  } else if (element.height !== undefined) {
    // Height only: scale width
    renderHeight = element.height
    renderWidth = renderHeight * (naturalWidth / naturalHeight)
  } else {
    // Neither: fit to content width
    renderWidth = contentWidth
    renderHeight = renderWidth * (naturalHeight / naturalWidth)
  }

  // Clamp to content width
  if (renderWidth > contentWidth) {
    const scale = contentWidth / renderWidth
    renderWidth = contentWidth
    renderHeight = renderHeight * scale
  }

  // Validate height doesn't exceed page
  if (renderHeight > pageContentHeight) {
    throw new PretextPdfError(
      'IMAGE_TOO_TALL',
      `Image "${imageKey}" would render at ${renderHeight.toFixed(1)}pt tall, which exceeds the page content area (${pageContentHeight.toFixed(1)}pt). ` +
      `Reduce 'height' or increase page size/reduce margins.`
    )
  }

  const imageData: MeasuredImageData = {
    imageKey,
    renderWidth,
    renderHeight,
    align: element.align ?? 'left',
  }

  return {
    element,
    height: renderHeight,
    lines: [],
    fontSize: 0,
    lineHeight: 0,
    fontKey: '',
    spaceAfter: element.spaceAfter ?? 0,
    spaceBefore: element.spaceBefore ?? 0,
    imageData,
  }
}

// ─── List measurement (returns MeasuredBlock[]) ───────────────────────────────

async function measureList(
  element: import('./types.js').ListElement,
  contentWidth: number,
  doc: PdfDocument,
  baseFontSize: number,
  hyphenatorOpts?: HyphenatorOpts
): Promise<MeasuredBlock[]> {
  const baseFontFamily = doc.defaultFont ?? 'Inter'
  const fontSize = element.fontSize ?? baseFontSize
  const lineHeight = element.lineHeight ?? doc.defaultLineHeight ?? (fontSize * 1.5)
  const indent = element.indent ?? 20
  const markerWidth = element.markerWidth ?? 20
  const itemSpaceAfter = element.itemSpaceAfter ?? 4
  const fontKey = buildFontKey(baseFontFamily, 400, 'normal')

  // Width available for item text (after indent + marker column)
  const textWidth = contentWidth - indent - markerWidth

  if (textWidth <= 0) {
    throw new PretextPdfError(
      'VALIDATION_ERROR',
      `List indent (${indent}pt) + markerWidth (${markerWidth}pt) exceeds contentWidth (${contentWidth}pt). Reduce indent or markerWidth.`
    )
  }

  const blocks: MeasuredBlock[] = []

  // Flatten items and nested items
  const nestedStyle = element.nestedNumberingStyle ?? 'continue'
  let orderedIndex = 1
  const allItems: Array<{ text: string; marker: string; isNested: boolean; isFirstInList: boolean; fontWeight: 400 | 700 }> = []

  for (let i = 0; i < element.items.length; i++) {
    const item = element.items[i]!
    const isFirst = i === 0

    const marker = element.style === 'ordered'
      ? `${orderedIndex}.`
      : (element.marker ?? '•')
    orderedIndex++

    allItems.push({ text: item.text, marker, isNested: false, isFirstInList: isFirst, fontWeight: item.fontWeight ?? 400 })

    // Nested items (1 level deep)
    if (item.items && item.items.length > 0) {
      // 'restart': nested ordered items count from 1, parent counter unaffected
      // 'continue': nested items share the parent counter (existing behavior)
      let nestedIndex = nestedStyle === 'restart' ? 1 : orderedIndex
      for (let ni = 0; ni < item.items.length; ni++) {
        const nested = item.items[ni]!
        const nestedMarker = element.style === 'ordered'
          ? `${nestedIndex}.`
          : '◦'  // hollow bullet for nested unordered
        nestedIndex++
        if (nestedStyle === 'continue') orderedIndex++
        allItems.push({ text: nested.text, marker: nestedMarker, isNested: true, isFirstInList: false, fontWeight: nested.fontWeight ?? 400 })
      }
    }
  }

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i]!
    const isLast = i === allItems.length - 1
    const nestedIndent = item.isNested ? indent + markerWidth : indent
    const nestedTextWidth = item.isNested ? textWidth - markerWidth : textWidth

    const lines = await measureText(item.text, fontSize, baseFontFamily, item.fontWeight, nestedTextWidth, lineHeight, hyphenatorOpts)

    const listItemData: ListItemData = {
      marker: item.marker,
      indent: nestedIndent,
      markerWidth,
      color: element.color ?? '#000000',
      fontWeight: item.fontWeight,
    }

    // spaceBefore: only the first item in the entire list gets the list's spaceBefore
    // spaceAfter: itemSpaceAfter between items, list.spaceAfter on the last item
    const spaceBefore = item.isFirstInList ? (element.spaceBefore ?? 0) : 0
    const spaceAfter = isLast ? (element.spaceAfter ?? 0) : itemSpaceAfter

    blocks.push({
      element,        // All items share the parent ListElement (for type checking in renderer)
      height: Math.max(lines.length, 1) * lineHeight,
      lines,
      fontSize,
      lineHeight,
      fontKey,
      spaceAfter,
      spaceBefore,
      listItemData,
    })
  }

  return blocks
}

// ─── Table measurement ────────────────────────────────────────────────────────

async function measureTable(
  element: TableElement,
  contentWidth: number,
  doc: PdfDocument,
  baseFontSize: number,
  hyphenatorOpts?: HyphenatorOpts
): Promise<MeasuredBlock> {
  const baseFontFamily = doc.defaultFont ?? 'Inter'
  const fontSize = element.fontSize ?? baseFontSize
  const lineHeight = doc.defaultLineHeight ?? (fontSize * 1.5)
  const cellPaddingH = element.cellPaddingH ?? 8
  const cellPaddingV = element.cellPaddingV ?? 6
  const borderWidth = element.borderWidth ?? 0.5
  const borderColor = element.borderColor ?? '#cccccc'
  const headerBgColor = element.headerBgColor ?? '#f5f5f5'

  // Pre-pass: measure natural widths for 'auto' columns
  // NOTE: with colspan, we map cells to their starting column index
  const hasAutoColumns = element.columns.some(c => c.width === 'auto')
  let naturalWidths: number[] | undefined
  if (hasAutoColumns) {
    naturalWidths = new Array(element.columns.length).fill(0)
    for (const row of element.rows) {
      let colIdx = 0  // track column position accounting for colspan
      for (const cell of row.cells) {
        const cs = cell.colspan ?? 1
        // For auto columns: measure natural width and distribute across spanned columns
        // For now, attribute full width to the first column of the span
        if (element.columns[colIdx]?.width === 'auto') {
          const fontWeight = cell.fontWeight ?? (row.isHeader ? 700 : 400)
          const cellFontSize = cell.fontSize ?? fontSize
          const cellFamily = cell.fontFamily ?? baseFontFamily
          const w = await measureNaturalTextWidth(cell.text, cellFontSize, cellFamily, fontWeight)
          const cellNaturalWidth = w + 2 * cellPaddingH
          // Distribute across spanned columns
          const perColumn = cellNaturalWidth / cs
          for (let si = colIdx; si < colIdx + cs && si < element.columns.length; si++) {
            if (element.columns[si]?.width === 'auto') {
              naturalWidths[si] = Math.max(naturalWidths[si]!, perColumn)
            }
          }
        }
        colIdx += cs
      }
    }
  }

  // Resolve column widths (passes naturalWidths for 'auto' columns)
  const columnWidths = resolveColumnWidths(element.columns, contentWidth, cellPaddingH, borderWidth, naturalWidths)

  // Determine header row count
  const headerRowCount = element.headerRows !== undefined
    ? element.headerRows
    : element.rows.filter(r => r.isHeader).length

  // Measure all rows
  const measuredRows: MeasuredTableRow[] = []

  for (const row of element.rows) {
    const measuredCells: MeasuredTableCell[] = []
    let maxCellHeight = 0
    let colStart = 0  // track column position accounting for colspan

    for (const cell of row.cells) {
      const cs = cell.colspan ?? 1
      const col = element.columns[colStart]!

      // Calculate merged width: sum of spanned column widths + borders between them
      let mergedWidth = 0
      for (let si = colStart; si < colStart + cs && si < columnWidths.length; si++) {
        mergedWidth += columnWidths[si]!
        if (si < colStart + cs - 1) mergedWidth += borderWidth  // border between columns
      }

      const fontWeight = cell.fontWeight ?? (row.isHeader ? 700 : 400)
      const fontFamily = cell.fontFamily ?? baseFontFamily
      const cellFontSize = cell.fontSize ?? fontSize
      const cellLineHeight = doc.defaultLineHeight ?? (cellFontSize * 1.5)
      const fontKey = buildFontKey(fontFamily, fontWeight, 'normal')

      // Text area is narrower than merged cell (padding on both sides + border)
      const textWidth = mergedWidth - 2 * cellPaddingH - borderWidth

      const lines = await measureText(
        cell.text,
        cellFontSize,
        fontFamily,
        fontWeight,
        Math.max(textWidth, 1),
        cellLineHeight,
        hyphenatorOpts
      )

      const cellContentHeight = Math.max(lines.length, 1) * cellLineHeight
      maxCellHeight = Math.max(maxCellHeight, cellContentHeight)

      // RTL detection for table cells (same as paragraphs)
      const cellDir = cell.dir ?? 'auto'
      const { isRTL: cellIsRTL } = await detectAndReorderRTL(cell.text, cellDir)

      // Apply RTL alignment default: if align not explicitly set and text is RTL, default to right
      const align = cell.align ?? col.align ?? (cellIsRTL ? 'right' : 'left')

      const measuredCell: import('./types.js').MeasuredTableCell = {
        lines,
        fontSize: cellFontSize,
        lineHeight: cellLineHeight,
        fontKey,
        fontFamily,
        align,
        color: cell.color ?? '#000000',
        colspan: cs,
        mergedWidth,
        isRTL: cellIsRTL,
      }
      if (cell.bgColor !== undefined) measuredCell.bgColor = cell.bgColor
      measuredCells.push(measuredCell)

      colStart += cs
    }

    // Row height = tallest cell content + vertical padding on both sides
    const rowHeight = maxCellHeight + 2 * cellPaddingV

    // Compute which column boundaries have active vertical lines (not spanned by merged cells)
    const activeBoundaries = computeActiveBoundaries(row.cells, element.columns.length)

    measuredRows.push({
      cells: measuredCells,
      height: rowHeight,
      isHeader: row.isHeader ?? false,
      activeBoundaries,
    })
  }

  // Header rows are the first N rows
  const headerRows = measuredRows.slice(0, headerRowCount)
  const headerRowHeight = headerRows.reduce((sum, r) => sum + r.height, 0)

  // Total table height = sum of all row heights
  const totalHeight = measuredRows.reduce((sum, r) => sum + r.height, 0)

  const tableData: MeasuredTableData = {
    columnWidths,
    rows: measuredRows,
    headerRowCount,
    headerRowHeight,
    cellPaddingH,
    cellPaddingV,
    borderWidth,
    borderColor,
    headerBgColor,
  }

  return {
    element,
    height: totalHeight,
    lines: [],
    fontSize: 0,
    lineHeight: 0,
    fontKey: '',
    spaceAfter: element.spaceAfter ?? 0,
    spaceBefore: element.spaceBefore ?? 0,
    tableData,
  }
}

// ─── Column width resolution ──────────────────────────────────────────────────

/**
 * Resolve column width definitions to concrete pt values.
 * Fixed widths are used as-is. Star widths ('2*', '*') share the remaining space.
 * 'auto' columns use naturalWidths[i] (measured content width) — caller must pre-compute these.
 *
 * naturalWidths is required if any column uses 'auto'. It maps column index → natural text width in pt
 * (the minimum width needed to display cell text on one line, including cellPaddingH on both sides).
 */
export function resolveColumnWidths(
  columns: ColumnDef[],
  contentWidth: number,
  cellPaddingH: number,
  borderWidth: number,
  naturalWidths?: number[]
): number[] {
  const MIN_COLUMN_WIDTH = cellPaddingH * 2 + borderWidth * 2 + 4 // minimum usable pt

  let totalFixed = 0
  let totalStars = 0
  let totalAutoNatural = 0
  let autoCount = 0

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]!
    if (typeof col.width === 'number') {
      totalFixed += col.width
    } else if (col.width === 'auto') {
      // Auto columns reserve their natural width from remaining space
      const natural = naturalWidths?.[i] ?? MIN_COLUMN_WIDTH
      totalAutoNatural += natural
      autoCount++
    } else {
      // '*' → 1 star, '2*' → 2 stars, '1.5*' → 1.5 stars
      const match = col.width.match(/^(\d*\.?\d*)?\*$/)
      const stars = (match && match[1]) ? parseFloat(match[1]) : 1
      totalStars += stars
    }
  }

  const remaining = contentWidth - totalFixed

  if (remaining < -0.01) {
    throw new PretextPdfError(
      'TABLE_COLUMN_OVERFLOW',
      `Table fixed column widths (${totalFixed.toFixed(1)}pt) exceed content width (${contentWidth.toFixed(1)}pt). ` +
      `Reduce column widths or page margins.`
    )
  }

  // How much space is available after fixed columns
  const availableForFlexible = Math.max(0, remaining)

  // Auto columns claim their natural width (capped at available space).
  // Star columns share whatever remains after auto columns.
  // If auto columns overflow, they get proportional shares of available space.
  const autoFits = totalAutoNatural <= availableForFlexible
  const autoUsed = autoFits ? totalAutoNatural : availableForFlexible
  const availableForStars = availableForFlexible - autoUsed
  const starUnit = totalStars > 0 ? Math.max(0, availableForStars) / totalStars : 0

  return columns.map((col, i) => {
    let resolved: number
    if (typeof col.width === 'number') {
      resolved = col.width
    } else if (col.width === 'auto') {
      const natural = naturalWidths?.[i] ?? MIN_COLUMN_WIDTH
      if (autoFits) {
        resolved = natural
      } else {
        // Constrained: proportional share based on natural widths
        resolved = totalAutoNatural > 0
          ? (natural / totalAutoNatural) * availableForFlexible
          : MIN_COLUMN_WIDTH
      }
    } else {
      const match = col.width.match(/^(\d*\.?\d*)?\*$/)
      const stars = (match && match[1]) ? parseFloat(match[1]) : 1
      resolved = stars * starUnit
    }

    if (resolved < MIN_COLUMN_WIDTH) {
      throw new PretextPdfError(
        'TABLE_COLUMN_TOO_NARROW',
        `Table column ${i} resolved to ${resolved.toFixed(1)}pt, minimum is ${MIN_COLUMN_WIDTH.toFixed(1)}pt. ` +
        `Increase the column width or reduce cellPaddingH/borderWidth.`
      )
    }

    return resolved
  })
}

/**
 * Compute which column boundaries have visible vertical lines.
 * A boundary is "active" (visible) if it's not spanned by any merged cell.
 * Returns array of boundary indices (0 = between col 0 and 1, 1 = between col 1 and 2, etc.)
 * where vertical lines should be drawn.
 *
 * Example: 3 columns with a cell spanning cols 0-1 → active boundaries are [1] (only between cols 1-2)
 */
function computeActiveBoundaries(cells: import('./types.js').TableCell[], colCount: number): number[] {
  // Track which boundaries are "spanned" (internal to a merged cell)
  const spannedBoundaries = new Set<number>()
  let colIdx = 0

  for (const cell of cells) {
    const cs = cell.colspan ?? 1
    // Boundaries internal to this cell's span are: colIdx to colIdx + cs - 1
    // The internal boundaries are colIdx, colIdx+1, ..., colIdx+cs-2
    for (let b = colIdx; b < colIdx + cs - 1; b++) {
      spannedBoundaries.add(b)
    }
    colIdx += cs
  }

  // Active boundaries are all boundaries (0 to colCount-2) that are NOT spanned
  const activeBoundaries: number[] = []
  for (let b = 0; b < colCount - 1; b++) {
    if (!spannedBoundaries.has(b)) {
      activeBoundaries.push(b)
    }
  }

  return activeBoundaries
}

/**
 * Measure the natural (unwrapped) width of text in pt.
 * Uses a very large maxWidth so Pretext never wraps — returns the actual line width.
 */
async function measureNaturalTextWidth(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: 400 | 700
): Promise<number> {
  if (!text || text.trim() === '') return 0

  const { prepareWithSegments, layoutWithLines } = await getPretext()

  const weightPrefix = fontWeight === 700 ? 'bold ' : ''
  const fontString = `${weightPrefix}${fontSize}px ${fontFamily}`

  // Use a very large width to prevent wrapping; also handle multi-line text (\n)
  // by taking the max line width across all lines
  const prepared = prepareWithSegments(text, fontString, { whiteSpace: 'pre-wrap' })
  const result = layoutWithLines(prepared, 99999, fontSize * 1.5)
  const lines: Array<{ text: string; width: number }> = result.lines ?? []

  return lines.reduce((max, line) => Math.max(max, line.width), 0)
}

// ─── Text measurement (shared by all text-bearing elements) ──────────────────

/**
 * Measure text with automatic word hyphenation (Liang's algorithm via hypher).
 * Splits on \n to preserve paragraph breaks; tokenizes words; greedily packs with hyphenation fallback.
 */
async function measureTextWithHyphenation(
  text: string,
  fontString: string,
  maxWidth: number,
  opts: HyphenatorOpts
): Promise<PretextLine[]> {
  const { instance: hypher, minWordLength, leftMin, rightMin } = opts
  const widthCache = new Map<string, number>()

  const measure = async (w: string): Promise<number> => {
    if (widthCache.has(w)) return widthCache.get(w)!
    const width = await measureWord(w, fontString)
    widthCache.set(w, width)
    return width
  }

  let spaceWidth = await measure(' ')
  // Fallback if canvas returns 0 for space
  if (spaceWidth === 0) {
    const aWidth = await measure('a')
    const aaWidth = await measure('a a')
    spaceWidth = aaWidth - 2 * aWidth
    if (spaceWidth <= 0) spaceWidth = aWidth * 0.3 // Reasonable estimate
  }

  const allLines: PretextLine[] = []

  for (const para of text.split('\n')) {
    if (!para.trim()) {
      allLines.push({ text: '', width: 0 })
      continue
    }

    const words = para.split(/\s+/).filter(w => w.length > 0)
    // Pre-measure all unique words in this paragraph
    const uniqueWords = new Set(words)
    for (const w of uniqueWords) {
      await measure(w)
    }

    const lines: PretextLine[] = []
    let currentWords: string[] = []
    let currentWidth = 0

    const flush = () => {
      if (currentWords.length > 0) {
        lines.push({ text: currentWords.join(' '), width: currentWidth })
        currentWords = []
        currentWidth = 0
      }
    }

    for (const word of words) {
      const ww = widthCache.get(word)!
      const addW = currentWords.length > 0 ? spaceWidth + ww : ww

      if (currentWidth + addW <= maxWidth || currentWords.length === 0) {
        currentWords.push(word)
        currentWidth += addW
      } else {
        // Try hyphenation
        let hyphenated = false

        if (word.length >= minWordLength) {
          const sylls = hypher.hyphenate(word)

          for (let split = sylls.length - 1; split >= 1; split--) {
            const prefix = sylls.slice(0, split).join('')
            const suffix = sylls.slice(split).join('')
            if (prefix.length < leftMin || suffix.length < rightMin) continue

            const hyphenPart = prefix + '-'
            const hw = await measure(hyphenPart)
            const addHW = currentWords.length > 0 ? spaceWidth + hw : hw

            if (currentWidth + addHW <= maxWidth) {
              currentWords.push(hyphenPart)
              currentWidth += addHW
              flush()
              await measure(suffix)
              currentWords = [suffix]
              currentWidth = widthCache.get(suffix)!
              hyphenated = true
              break
            }
          }
        }

        if (!hyphenated) {
          flush()
          currentWords = [word]
          currentWidth = ww
        }
      }
    }

    flush()
    allLines.push(...lines)
  }

  return allLines
}

/**
 * Measure text using Pretext and return an array of lines (text + width).
 * Empty/whitespace-only string → returns empty array (nothing to render).
 * If hyphenatorOpts provided, delegates to measureTextWithHyphenation() for word-level hyphenation.
 */
async function measureText(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: 400 | 700,
  maxWidth: number,
  lineHeight: number,
  hyphenatorOpts?: HyphenatorOpts
): Promise<PretextLine[]> {
  if (!text || text.trim() === '') return []

  const weightPrefix = fontWeight === 700 ? 'bold ' : ''
  const fontString = `${weightPrefix}${fontSize}px ${fontFamily}`

  // Delegate to hyphenation path if enabled
  if (hyphenatorOpts) {
    return measureTextWithHyphenation(text, fontString, maxWidth, hyphenatorOpts)
  }

  const { prepareWithSegments, layoutWithLines } = await getPretext()

  // whiteSpace: 'pre-wrap' — preserves \n in multi-line text. CRITICAL per Phase 1 lessons.
  const prepared = prepareWithSegments(text, fontString, { whiteSpace: 'pre-wrap' })
  const result = layoutWithLines(prepared, maxWidth, lineHeight)

  return (result.lines ?? []).map((line: { text: string; width: number }) => ({
    text: line.text,
    width: line.width,
  }))
}

/**
 * Measure a short header/footer string — returns total height in pt.
 */
export async function measureHeaderFooterHeight(
  text: string,
  fontSize: number,
  fontFamily: string,
  contentWidth: number,
  lineHeight: number
): Promise<number> {
  if (!text || text.trim() === '') return 0

  const { prepareWithSegments, layoutWithLines } = await getPretext()

  // Replace tokens with representative numbers for measurement
  const sampleText = text
    .replace('{{pageNumber}}', '99')
    .replace('{{totalPages}}', '99')

  const fontString = `${fontSize}px ${fontFamily}`
  const prepared = prepareWithSegments(sampleText, fontString, {})
  const result = layoutWithLines(prepared, contentWidth, lineHeight)

  return result.lineCount * lineHeight
}

/** Build a font map key from family + weight + style */
export function buildFontKey(family: string, weight: 400 | 700, style: 'normal' | 'italic'): string {
  return `${family}-${weight}-${style}`
}

/**
 * Build measured TOC entry blocks from collected headings.
 * Called during two-pass mode after first pagination to generate the actual TOC content.
 */
export async function buildTocEntryBlocks(
  headings: Array<{ text: string; level: 1 | 2 | 3 | 4; pageIndex: number }>,
  tocElement: import('./types.js').TocElement,
  contentWidth: number,
  doc: PdfDocument,
): Promise<import('./types.js').MeasuredBlock[]> {
  const minLevel = tocElement.minLevel ?? 1
  const maxLevel = tocElement.maxLevel ?? 3
  const fontSize = tocElement.fontSize ?? doc.defaultFontSize ?? 12
  const titleFontSize = tocElement.titleFontSize ?? (fontSize + 4)
  const lineHeight = fontSize * 1.5
  const levelIndent = tocElement.levelIndent ?? 16
  const leader = tocElement.leader ?? '.'
  const fontFamily = tocElement.fontFamily ?? doc.defaultFont ?? 'Inter'
  const fontWeight = 400
  const fontKey = buildFontKey(fontFamily, fontWeight, 'normal')
  const blocks: import('./types.js').MeasuredBlock[] = []

  // Title block (if showTitle !== false)
  if (tocElement.showTitle !== false) {
    const title = tocElement.title ?? 'Table of Contents'
    const titleLines = await measureText(title, titleFontSize, fontFamily, 700, contentWidth, titleFontSize * 1.5, undefined)
    blocks.push({
      element: { type: 'toc-entry', text: title, pageNumber: -1, level: 1, levelIndent: 0, leader: '', fontFamily, fontWeight: 700 } as import('./types.js').TocEntryElement,
      height: titleLines.length * (titleFontSize * 1.5),
      lines: titleLines,
      fontSize: titleFontSize,
      lineHeight: titleFontSize * 1.5,
      fontKey: buildFontKey(fontFamily, 700, 'normal'),
      spaceAfter: lineHeight,
      spaceBefore: 0,
      tocEntryData: { entryX: 0, pageStr: '', leaderChar: '' },
    } satisfies import('./types.js').MeasuredBlock)
  }

  // Entry blocks — one per heading in range
  for (const h of headings) {
    if (h.level < minLevel || h.level > maxLevel) continue
    const indent = (h.level - minLevel) * levelIndent
    const pageStr = String(h.pageIndex + 1) // 1-based page numbers
    const entryTextWidth = contentWidth - indent - 30 // reserve 30pt for page number area
    const lines = await measureText(h.text, fontSize, fontFamily, fontWeight, entryTextWidth, lineHeight, undefined)
    blocks.push({
      element: { type: 'toc-entry', text: h.text, pageNumber: h.pageIndex + 1, level: h.level, levelIndent: indent, leader, fontFamily, fontWeight } as import('./types.js').TocEntryElement,
      height: lines.length * lineHeight,
      lines,
      fontSize,
      lineHeight,
      fontKey,
      spaceAfter: tocElement.entrySpacing ?? 4,
      spaceBefore: 0,
      tocEntryData: { entryX: indent, pageStr, leaderChar: leader },
    } satisfies import('./types.js').MeasuredBlock)
  }

  return blocks
}

/**
 * Measure all content elements in a document.
 * Handles list flattening (lists return MeasuredBlock[]).
 * Handles image key resolution (images need their content-index-based key).
 * Initializes hyphenator if doc.hyphenation is configured.
 */
export async function measureAllBlocks(
  doc: PdfDocument,
  contentWidth: number,
  imageMap: ImageMap,
  pageContentHeight: number
): Promise<MeasuredBlock[]> {
  const results: MeasuredBlock[] = []

  // Initialize hyphenator if enabled
  let hyphenatorOpts: HyphenatorOpts | undefined
  if (doc.hyphenation) {
    const { language, minWordLength = 6, leftMin = 2, rightMin = 3 } = doc.hyphenation
    const instance = await getHyphenator(language)
    hyphenatorOpts = { instance, minWordLength, leftMin, rightMin }
  }

  for (let i = 0; i < doc.content.length; i++) {
    const el = doc.content[i]!

    if (el.type === 'image') {
      // Images need their specific imageMap key (keyed by content index in assets.ts)
      const imageKey = `img-${i}`
      const block = await measureImageWithKey(el, imageKey, imageMap, contentWidth, pageContentHeight)
      results.push(block)
    } else if (el.type === 'svg') {
      const svgKey = `svg-${i}`
      // Synthetic ImageElement reuses existing measurement logic (aspect ratio, clamping, height validation)
      const syntheticImage: import('./types.js').ImageElement = {
        type: 'image',
        src: '',  // unused by measureImageWithKey — it reads from imageMap only
        ...(el.width !== undefined ? { width: el.width } : {}),
        ...(el.height !== undefined ? { height: el.height } : {}),
        ...(el.align !== undefined ? { align: el.align } : {}),
        spaceAfter: el.spaceAfter ?? 8,
        spaceBefore: el.spaceBefore ?? 8,
      }
      const block = await measureImageWithKey(syntheticImage, svgKey, imageMap, contentWidth, pageContentHeight)
      // Swap back to real SvgElement so render.ts routing sees type === 'svg'
      ;(block as any).element = el
      results.push(block)
    } else {
      const result = await measureBlock(el, contentWidth, doc, hyphenatorOpts)
      if (Array.isArray(result)) {
        results.push(...result)
      } else {
        results.push(result)
      }
    }
  }

  return results
}
