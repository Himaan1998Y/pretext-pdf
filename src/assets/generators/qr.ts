/**
 * QR code SVG generator — extracted from src/assets.ts in v1.6.0 commit 12/16.
 *
 * `qrcode` is loaded via dynamic import (optional peer dep). Lazy-load
 * pattern preserved so cold-start cost stays equivalent.
 */
import type { QrCodeElement } from '../../types.js'
import { PretextPdfError } from '../../errors.js'

export async function generateQrSvg(el: QrCodeElement): Promise<string> {
  type QRCodeModule = { toString: (data: string, opts: Record<string, unknown>) => Promise<string> }
  let qrLib: QRCodeModule
  try {
    qrLib = await import('qrcode' as string) as QRCodeModule
  } catch {
    throw new PretextPdfError(
      'QR_DEP_MISSING',
      'qr-code elements require the qrcode package. Install it: npm install qrcode'
    )
  }
  try {
    return await qrLib.toString(el.data, {
      type: 'svg',
      errorCorrectionLevel: el.errorCorrectionLevel ?? 'M',
      margin: el.margin ?? 4,
      color: {
        dark: el.foreground ?? '#000000',
        light: el.background ?? '#ffffff',
      },
    })
  } catch (err) {
    throw new PretextPdfError(
      'QR_GENERATE_FAILED',
      `QR code generation failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}
