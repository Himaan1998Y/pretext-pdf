/**
 * SVG dimension parsing — extracted from src/assets.ts in v1.6.0 commit 10/16.
 *
 * Pure parsers — no I/O, no module-level state. Safe to import eagerly.
 */
import type { SvgElement } from '../../types.js'
import { SVG_MAX_BYTES } from './sanitize.js'

export function parseSvgViewBox(svg: string): { width: number; height: number } | null {
  if (svg.length > SVG_MAX_BYTES) return null
  const match = svg.match(/viewBox=["']([^"']+)["']/)
  if (!match) return null
  const parts = match[1]!.split(/[\s,]+/).map(Number)
  const w = parts[2], h = parts[3]
  if (!w || !h || !isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return null
  return { width: w, height: h }
}

export function parseSvgAttributes(svg: string): { width: number; height: number } | null {
  if (svg.length > SVG_MAX_BYTES) return null
  const wMatch = svg.match(/<svg[^>]*\swidth=["'](\d+(?:\.\d+)?)["']/)
  const hMatch = svg.match(/<svg[^>]*\sheight=["'](\d+(?:\.\d+)?)["']/)
  if (!wMatch || !hMatch) return null
  const w = Number(wMatch[1]), h = Number(hMatch[1])
  if (!w || !h || w <= 0 || h <= 0) return null
  return { width: w, height: h }
}

export function resolveSvgDimensions(el: SvgElement, contentWidth: number): { widthPt: number; heightPt: number } {
  const svgStr = el.svg ?? ''
  const viewbox = parseSvgViewBox(svgStr) ?? parseSvgAttributes(svgStr)
  const aspectRatio = viewbox ? viewbox.height / viewbox.width : null

  if (el.width !== undefined && el.height !== undefined) {
    return { widthPt: el.width, heightPt: el.height }
  }
  if (el.width !== undefined) {
    return { widthPt: el.width, heightPt: aspectRatio !== null ? el.width * aspectRatio : el.width }
  }
  if (el.height !== undefined) {
    return { widthPt: aspectRatio !== null ? el.height / aspectRatio : el.height, heightPt: el.height }
  }
  const widthPt = contentWidth
  const heightPt = aspectRatio !== null ? widthPt * aspectRatio : 200
  return { widthPt, heightPt }
}
