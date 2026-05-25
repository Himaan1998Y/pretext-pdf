/**
 * Chart SVG generator (vega-lite, optional) — extracted from src/assets.ts
 * in v1.6.0 commit 12/16.
 *
 * `vega` + `vega-lite` are loaded via dynamic import (optional peer deps).
 * Lazy-load pattern preserved so cold-start cost stays equivalent.
 *
 * Remote data loading is explicitly disabled inside the loader to block the
 * SSRF vector through `spec.data.url`.
 */
import type { ChartElement } from '../../types.js'
import { PretextPdfError } from '../../errors.js'

export async function generateChartSvg(el: ChartElement, contentWidth: number): Promise<string> {
  type VegaLiteModule = { compile: (spec: Record<string, unknown>) => { spec: Record<string, unknown> } }
  type VegaLoader = { load: (uri: string, opt?: unknown) => Promise<string> }
  type VegaModule = { View: new (spec: unknown, opts: Record<string, unknown>) => { toSVG: () => Promise<string> }; parse: (spec: unknown) => unknown; loader: () => VegaLoader }
  let vegaLite: VegaLiteModule
  let vega: VegaModule
  try {
    vegaLite = await import('vega-lite' as string) as VegaLiteModule
    vega     = await import('vega' as string) as VegaModule
  } catch {
    throw new PretextPdfError(
      'CHART_DEP_MISSING',
      'chart elements require vega and vega-lite packages. Install them: npm install vega vega-lite'
    )
  }
  let vegaSpec: Record<string, unknown>
  try {
    const specWithSize = { ...el.spec, width: el.width ?? contentWidth, height: el.height ?? 300 }
    vegaSpec = vegaLite.compile(specWithSize).spec
  } catch (err) {
    throw new PretextPdfError(
      'CHART_SPEC_INVALID',
      `vega-lite spec compilation failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }
  try {
    // Block all remote data loading to prevent SSRF — vega's default loader
    // follows any data.url in the spec, which could reach internal services
    const blockedLoader = vega.loader()
    blockedLoader.load = (_uri: string): Promise<string> =>
      Promise.reject(new Error('Remote data loading is disabled in pretext-pdf'))
    const view = new vega.View(vega.parse(vegaSpec), { renderer: 'none', loader: blockedLoader })
    return await view.toSVG()
  } catch (err) {
    throw new PretextPdfError(
      'CHART_RENDER_FAILED',
      `Chart SVG rendering failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}
