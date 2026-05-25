/**
 * Watermark image loader — extracted from src/assets.ts in v1.6.0 commit 15/16.
 *
 * Loads + embeds the optional `doc.watermark.image` (path or Uint8Array)
 * into the imageMap under the 'watermark' key. PATH_TRAVERSAL errors
 * propagate; other failures are warn-and-skip (matches prior behavior).
 */
import { PDFDocument } from '@cantoo/pdf-lib'
import type { PdfDocument } from '../../types.js'
import type { ImageMap } from '../../types-internal.js'
import { PretextPdfError } from '../../errors.js'
import { assertPathAllowed } from '../security/path-allowlist.js'

export async function loadWatermarkImage(
  doc: PdfDocument,
  pdfDoc: PDFDocument,
  imageMap: ImageMap,
  allowedDirs: string[] | undefined,
  warn: (msg: string) => void,
): Promise<void> {
  if (!doc.watermark?.image) return

  const src = doc.watermark.image
  try {
    let bytes: Uint8Array
    if (src instanceof Uint8Array) {
      bytes = src
    } else {
      const [fs, pathMod] = await Promise.all([import('fs'), import('path')])
      const filePath = pathMod.resolve(src as string)
      assertPathAllowed(filePath, allowedDirs, 'watermark image')
      if (!fs.existsSync(filePath)) throw new Error(`Watermark image not found`)
      bytes = new Uint8Array(fs.readFileSync(filePath))
    }
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
    const pdfImage = isPng
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes)
    imageMap.set('watermark', pdfImage)
  } catch (err) {
    if (err instanceof PretextPdfError && err.code === 'PATH_TRAVERSAL') throw err
    warn(`[pretext-pdf] Watermark image skipped: ${err instanceof Error ? err.message : String(err)}`)
  }
}
