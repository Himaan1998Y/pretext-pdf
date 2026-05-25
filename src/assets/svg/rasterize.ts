/**
 * SVG rasterizer — extracted from src/assets.ts in v1.6.0 commit 11/16.
 *
 * Pure compute — no pdf-lib interaction — so it is safe to run in parallel.
 *
 * @napi-rs/canvas is loaded via dynamic import (optional peer dep). The
 * lazy-load pattern is preserved so cold-start cost stays equivalent and
 * users without canvas installed still see a precise error code.
 */
import { PretextPdfError } from '../../errors.js'

/**
 * Rasterize an SVG string to a PNG buffer at 2x scale.
 * Pure compute — no pdf-lib interaction — so it is safe to run in parallel.
 */
export async function rasterizeSvgToPng(svg: string, widthPt: number, heightPt: number): Promise<Buffer> {
  let canvasLib: any
  try {
    canvasLib = await import('@napi-rs/canvas' as string)
  } catch {
    throw new PretextPdfError(
      'SVG_RENDER_FAILED',
      'SVG rendering requires the optional dependency @napi-rs/canvas. Install it with: pnpm add @napi-rs/canvas'
    )
  }

  const scale = 2
  const widthPx = Math.round(widthPt * scale)
  const heightPx = Math.round(heightPt * scale)

  try {
    const canvas = canvasLib.createCanvas(widthPx, heightPx)
    const ctx = canvas.getContext('2d')
    const img = new canvasLib.Image()
    img.src = Buffer.from(svg)
    ctx.drawImage(img, 0, 0, widthPx, heightPx)
    return canvas.toBuffer('image/png')
  } catch (err) {
    throw new PretextPdfError(
      'SVG_RENDER_FAILED',
      `Failed to rasterize SVG: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}
