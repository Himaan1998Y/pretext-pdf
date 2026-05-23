/**
 * measure-blocks/float-group.ts — Multi-paragraph float-group measurement.
 */

import type { FloatGroupElement, ImageElement, PdfDocument } from '../types.js'
import type { MeasuredBlock, ImageMap, PretextLine, RichLine } from '../types-internal.js'
import { PretextPdfError } from '../errors.js'
import { HyphenatorOpts } from '../measure-text.js'
import { LINE_HEIGHT_BODY } from '../render-utils.js'
import { measureImageWithKey } from './image.js'
import { measureBlock } from './index.js'

export async function measureFloatGroup(
  element: FloatGroupElement,
  imageKey: string,
  imageMap: ImageMap,
  contentWidth: number,
  pageContentHeight: number,
  doc: PdfDocument,
  hyphenatorOpts?: HyphenatorOpts,
  wordWidthCache?: Map<string, number>,
): Promise<MeasuredBlock> {
  const floatWidth = element.floatWidth ?? (contentWidth * 0.35)
  const floatGap = element.floatGap ?? 12
  const textColWidth = contentWidth - floatWidth - floatGap

  if (textColWidth < 50) {
    throw new PretextPdfError('COLUMN_WIDTH_TOO_NARROW',
      `Float group: text column would be ${textColWidth.toFixed(1)}pt (minimum 50pt). ` +
      `Reduce floatWidth or increase page width.`)
  }

  // Measure the image at floatWidth
  const syntheticImageEl: ImageElement = {
    type: 'image',
    src: '',
    ...(element.image.height !== undefined ? { height: element.image.height } : {}),
    align: 'left',
    spaceAfter: 0,
    spaceBefore: 0,
  }
  const imageBlock = await measureImageWithKey(syntheticImageEl, imageKey, imageMap, floatWidth, pageContentHeight)
  const imageRenderWidth = imageBlock.imageData!.renderWidth
  const imageRenderHeight = imageBlock.imageData!.renderHeight

  // Measure each content element in the text column
  const baseFontSize = doc.defaultFontSize ?? 12
  const textItems: Array<{
    lines: PretextLine[]
    richLines?: RichLine[]
    fontSize: number
    lineHeight: number
    fontKey: string
    fontWeight: 400 | 700
    spaceAfter: number
    yOffsetFromTop: number
  }> = []
  let totalTextHeight = 0

  for (const contentEl of element.content) {
    const measuredEl = await measureBlock(contentEl, textColWidth, doc, hyphenatorOpts, wordWidthCache)

    // Handle arrays (lists return MeasuredBlock[])
    const blocks = Array.isArray(measuredEl) ? measuredEl : [measuredEl]

    for (const block of blocks) {
      const fontSize = block.fontSize || baseFontSize

      // Extract text from lines or rich-lines
      let lines: PretextLine[] = []
      if (block.richLines && block.richLines.length > 0) {
        // Rich paragraph: extract plain text from rich lines (plain-text fallback)
        lines = block.richLines.map(rl => ({
          text: rl.fragments.map(f => f.text).join(''),
          width: rl.totalWidth,
        }))
      } else {
        lines = block.lines
      }

      const yOffsetFromTop = totalTextHeight
      const item: typeof textItems[0] = {
        lines,
        fontSize: block.fontSize,
        lineHeight: block.lineHeight,
        fontKey: block.fontKey,
        fontWeight: 400,
        spaceAfter: block.spaceAfter,
        yOffsetFromTop,
      }
      if (block.richLines) {
        item.richLines = block.richLines
      }
      textItems.push(item)

      totalTextHeight += block.height + block.spaceAfter
    }
  }

  // Remove trailing spaceAfter (it's not needed at the end)
  if (textItems.length > 0) {
    totalTextHeight -= textItems[textItems.length - 1]!.spaceAfter
  }

  // Column X positions
  const imageColX = element.float === 'left' ? 0 : textColWidth + floatGap
  const textColX = element.float === 'left' ? floatWidth + floatGap : 0

  const compositeHeight = Math.max(imageRenderHeight, totalTextHeight)

  return {
    element,
    height: compositeHeight,
    lines: [],
    fontSize: 0,
    lineHeight: 0,
    fontKey: '',
    spaceAfter: element.spaceAfter ?? 12,
    spaceBefore: element.spaceBefore ?? 0,
    floatGroupData: {
      imageKey,
      imageRenderWidth,
      imageRenderHeight,
      imageColX,
      textColX,
      textColWidth,
      textItems,
      totalTextHeight,
    },
  }
}
