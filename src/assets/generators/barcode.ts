/**
 * Barcode SVG generator — extracted from src/assets.ts in v1.6.0 commit 12/16.
 *
 * `bwip-js` is loaded via dynamic import (optional peer dep). Lazy-load
 * pattern preserved so cold-start cost stays equivalent.
 */
import type { BarcodeElement } from '../../types.js'
import { PretextPdfError } from '../../errors.js'

export async function generateBarcodeSvg(el: BarcodeElement): Promise<string> {
  type BwipModule = { toSVG: (opts: Record<string, unknown>) => string }
  let bwip: BwipModule
  try {
    bwip = await import('bwip-js' as string) as BwipModule
  } catch {
    throw new PretextPdfError(
      'BARCODE_DEP_MISSING',
      'barcode elements require the bwip-js package. Install it: npm install bwip-js'
    )
  }
  try {
    return bwip.toSVG({
      bcid: el.symbology,
      text: el.data,
      scale: 3,
      includetext: el.includeText !== false,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const isSymbology = msg.toLowerCase().includes('unknown') || msg.toLowerCase().includes('bcid')
    throw new PretextPdfError(
      isSymbology ? 'BARCODE_SYMBOLOGY_INVALID' : 'BARCODE_GENERATE_FAILED',
      `Barcode generation failed (symbology: '${el.symbology}'): ${msg}`
    )
  }
}
