/**
 * measure-blocks/helpers.ts — Shared helpers and constants used by multiple
 * per-element-type measurement modules.
 */

import { getPretext } from '../measure-text.js'
import { LINE_HEIGHT_BODY } from '../render-utils.js'

/** Heading level size multipliers and defaults */
export const HEADING_DEFAULTS = {
  1: { sizeMultiplier: 2.0,  fontWeight: 700 as const, spaceAfter: 16, spaceBefore: 28 },
  2: { sizeMultiplier: 1.5,  fontWeight: 700 as const, spaceAfter: 12, spaceBefore: 24 },
  3: { sizeMultiplier: 1.25, fontWeight: 700 as const, spaceAfter: 8,  spaceBefore: 20 },
  4: { sizeMultiplier: 1.1,  fontWeight: 700 as const, spaceAfter: 6,  spaceBefore: 16 },
}

/**
 * Resolve preset callout style colors
 */
export function resolveCalloutColors(style?: string): { bg: string; border: string } {
  switch (style) {
    case 'info':    return { bg: '#EFF6FF', border: '#3B82F6' }
    case 'warning': return { bg: '#FFFBEB', border: '#F59E0B' }
    case 'tip':     return { bg: '#F0FDF4', border: '#22C55E' }
    case 'note':    return { bg: '#F9FAFB', border: '#9CA3AF' }
    default:        return { bg: '#F8F9FA', border: '#0070F3' }
  }
}

/**
 * Measure the natural (unwrapped) width of text in pt.
 * Uses a very large maxWidth so Pretext never wraps — returns the actual line width.
 */
export async function measureNaturalTextWidth(
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
  const result = layoutWithLines(prepared, 99999, fontSize * LINE_HEIGHT_BODY)
  const lines: Array<{ text: string; width: number }> = result.lines ?? []

  return lines.reduce((max, line) => Math.max(max, line.width), 0)
}
