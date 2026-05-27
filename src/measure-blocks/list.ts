/**
 * measure-blocks/list.ts — List measurement (returns MeasuredBlock[] — one block per list item).
 */

import type { ListElement, PdfDocument } from '../types.js'
import type { MeasuredBlock, ListItemData } from '../types-internal.js'
import { PretextPdfError } from '../errors.js'
import { buildFontKey } from '../font-key.js'
import { measureText } from '../measure-text.js'
import type { HyphenatorOpts } from '../measure-text.js'
import { LINE_HEIGHT_BODY } from '../render-utils.js'
import { measureNaturalTextWidth } from './helpers.js'

export async function measureList(
  element: ListElement,
  contentWidth: number,
  doc: PdfDocument,
  baseFontSize: number,
  hyphenatorOpts?: HyphenatorOpts,
  wordWidthCache?: Map<string, number>,
): Promise<MeasuredBlock[]> {
  const baseFontFamily = doc.defaultFont ?? 'Inter'
  const fontSize = element.fontSize ?? baseFontSize
  const lineHeight = element.lineHeight ?? doc.defaultLineHeight ?? (fontSize * LINE_HEIGHT_BODY)
  const indent = element.indent ?? 20
  const itemSpaceAfter = element.itemSpaceAfter ?? 4
  const fontKey = buildFontKey(baseFontFamily, 400, 'normal')

  const blocks: MeasuredBlock[] = []

  // Flatten items and nested items (up to 2 levels deep)
  const nestedStyle = element.nestedNumberingStyle ?? 'continue'
  let orderedIndex = 1
  const allItems: Array<{ text: string; marker: string; depth: number; isFirstInList: boolean; fontWeight: 400 | 700 }> = []

  for (let i = 0; i < element.items.length; i++) {
    const item = element.items[i]!
    const isFirst = i === 0

    const marker = element.style === 'ordered'
      ? `${orderedIndex}.`
      : (element.marker ?? '•')
    orderedIndex++

    allItems.push({ text: item.text, marker, depth: 0, isFirstInList: isFirst, fontWeight: item.fontWeight ?? 400 })

    // Nested items (depth 1)
    if (item.items && item.items.length > 0) {
      // 'restart': nested ordered items count from 1, parent counter unaffected
      // 'continue': nested items share the parent counter (existing behavior)
      let nestedIndex = nestedStyle === 'restart' ? 1 : orderedIndex
      for (let ni = 0; ni < item.items.length; ni++) {
        const nested = item.items[ni]!
        const nestedMarker = element.style === 'ordered'
          ? `${nestedIndex}.`
          : '◦'  // hollow bullet for depth-1 unordered
        nestedIndex++
        if (nestedStyle === 'continue') orderedIndex++
        allItems.push({ text: nested.text, marker: nestedMarker, depth: 1, isFirstInList: false, fontWeight: nested.fontWeight ?? 400 })

        // Nested items (depth 2)
        if (nested.items && nested.items.length > 0) {
          let deepIndex = nestedStyle === 'restart' ? 1 : nestedIndex
          for (let di = 0; di < nested.items.length; di++) {
            const deep = nested.items[di]!
            const deepMarker = element.style === 'ordered'
              ? `${deepIndex}.`
              : '▪'  // small filled square for depth-2 unordered
            deepIndex++
            if (nestedStyle === 'continue') orderedIndex++
            allItems.push({ text: deep.text, marker: deepMarker, depth: 2, isFirstInList: false, fontWeight: deep.fontWeight ?? 400 })
          }
        }
      }
    }
  }

  // Compute markerWidth: use explicit override if set, otherwise measure widest marker
  let markerWidth: number
  if (element.markerWidth != null) {
    markerWidth = element.markerWidth
  } else {
    const widestMarker = element.style === 'ordered'
      ? `${allItems.length}.`
      : (element.marker ?? '•')
    const measured = await measureNaturalTextWidth(widestMarker, fontSize, baseFontFamily, 400)
    markerWidth = Math.max(16, measured + 6)
  }

  // Width available for item text (after indent + marker column)
  const textWidth = contentWidth - indent - markerWidth

  if (textWidth <= 0) {
    throw new PretextPdfError(
      'VALIDATION_ERROR',
      `List indent (${indent}pt) + markerWidth (${markerWidth}pt) exceeds contentWidth (${contentWidth}pt). Reduce indent or markerWidth.`
    )
  }

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i]!
    const isLast = i === allItems.length - 1
    const nestedIndent = indent + item.depth * markerWidth
    const nestedTextWidth = textWidth - item.depth * markerWidth

    const lines = await measureText(item.text, fontSize, baseFontFamily, item.fontWeight, nestedTextWidth, lineHeight, hyphenatorOpts, wordWidthCache)

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
