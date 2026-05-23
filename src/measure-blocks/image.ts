/**
 * measure-blocks/image.ts — Image measurement (single image + float image block).
 */

import type { ImageElement, PdfDocument } from '../types.js'
import type {
  MeasuredBlock, MeasuredImageData, ImageMap, PretextLine, RichLine,
} from '../types-internal.js'
import { PretextPdfError } from '../errors.js'
import { measureRichText } from '../rich-text.js'
import { buildFontKey } from '../measure.js'
import { measureText } from '../measure-text.js'
import { LINE_HEIGHT_BODY } from '../render-utils.js'

/** Measure an image element with its known imageMap key */
export async function measureImageWithKey(
  element: ImageElement,
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

export async function measureFloatImageBlock(
  element: ImageElement,
  imageKey: string,
  imageMap: ImageMap,
  contentWidth: number,
  pageContentHeight: number,
  doc: PdfDocument,
  wordWidthCache?: Map<string, number>,
): Promise<MeasuredBlock> {
  const floatWidth = element.floatWidth ?? (contentWidth * 0.35)
  const floatGap = element.floatGap ?? 12
  const textColWidth = contentWidth - floatWidth - floatGap

  if (textColWidth < 50) {
    throw new PretextPdfError('COLUMN_WIDTH_TOO_NARROW',
      `Float image: text column would be ${textColWidth.toFixed(1)}pt (minimum 50pt). ` +
      `Reduce floatWidth or increase page width.`)
  }

  // Measure the image at floatWidth using a synthetic element
  const syntheticEl: ImageElement = {
    type: 'image',
    src: element.src,
    ...(element.format !== undefined ? { format: element.format } : {}),
    width: floatWidth,
    align: 'left',
    spaceAfter: 0,
    spaceBefore: 0,
  }
  const imageBlock = await measureImageWithKey(syntheticEl, imageKey, imageMap, floatWidth, pageContentHeight)
  const imageRenderWidth = imageBlock.imageData!.renderWidth
  const imageRenderHeight = imageBlock.imageData!.renderHeight

  // Measure the float text (plain or rich)
  const fontSize = element.floatFontSize ?? doc.defaultFontSize ?? 12
  const lineHeight = fontSize * LINE_HEIGHT_BODY
  const fontFamily = element.floatFontFamily ?? doc.defaultFont ?? 'Inter'
  const fontKey = buildFontKey(fontFamily, 400, 'normal')

  let textLines: PretextLine[] = []
  let richFloatLines: RichLine[] | undefined

  if (element.floatSpans) {
    richFloatLines = await measureRichText(element.floatSpans, fontSize, lineHeight, textColWidth, 'left', doc)
  } else {
    textLines = await measureText(
      element.floatText!,
      fontSize,
      fontFamily,
      400,
      textColWidth,
      lineHeight,
      undefined,
      wordWidthCache,
    )
  }

  // Column X positions
  const imageColX = element.float === 'left' ? 0 : textColWidth + floatGap
  const textColX = element.float === 'left' ? floatWidth + floatGap : 0

  const textHeight = richFloatLines
    ? richFloatLines.reduce((sum, l) => sum + l.lineHeight, 0)
    : textLines.length * lineHeight
  const compositeHeight = Math.max(imageRenderHeight, textHeight)

  return {
    element,
    height: compositeHeight,
    lines: [],
    fontSize: 0,
    lineHeight: 0,
    fontKey: '',
    spaceAfter: element.spaceAfter ?? 0,
    spaceBefore: element.spaceBefore ?? 0,
    floatData: {
      imageKey,
      imageRenderWidth,
      imageRenderHeight,
      imageColX,
      textColX,
      textColWidth,
      textLines,
      ...(richFloatLines ? { richFloatLines } : {}),
      textFontKey: fontKey,
      textFontSize: fontSize,
      textLineHeight: lineHeight,
      textColor: element.floatColor ?? '#000000',
    },
  }
}
