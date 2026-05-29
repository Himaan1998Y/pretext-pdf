/**
 * Font loading, embedding, and subsetting.
 * Public exports: loadFonts (pipeline stage 2), collectTextByFont (subsetting pre-pass).
 *
 * Implementation split across src/fonts/:
 *   bundled-paths.ts   — IS_NODE, __dirname, resolveInterFile, BUNDLED_INTER_*_PATHS
 *   load-bytes.ts      — loadFontBytes (file / Uint8Array / bundled-Inter loader)
 *   collect-needed.ts  — collectNeededFonts (document font-variant scanner)
 *   collect-text.ts    — collectTextByFont (text-by-font map for font subsetting)
 */
import { PDFDocument } from '@cantoo/pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { PdfDocument, FontSpec } from './types.js'
import type { FontMap } from './types-internal.js'
import { PretextPdfError } from './errors.js'
import { buildFontKey } from './font-key.js'
import { collectNeededFonts } from './fonts/collect-needed.js'
import { loadFontBytes } from './fonts/load-bytes.js'
import { collectTextByFont } from './fonts/collect-text.js'

export { collectTextByFont } from './fonts/collect-text.js'

/**
 * Stage 2: Load and embed all fonts.
 * - Scans document for all font references
 * - Loads font bytes (file system or Uint8Array)
 * - Embeds each into pdfDoc via fontkit
 * - Returns FontMap for use in measure + render stages
 */
export async function loadFonts(
  doc: PdfDocument,
  pdfDoc: PDFDocument
): Promise<FontMap> {
  pdfDoc.registerFontkit(fontkit)

  const fontMap: FontMap = new Map()
  const defaultFamily = doc.defaultFont ?? 'Inter'

  const needed = collectNeededFonts(doc)

  if (!needed.has(buildFontKey('Inter', 400, 'normal'))) {
    needed.set(buildFontKey('Inter', 400, 'normal'), { family: 'Inter', weight: 400, style: 'normal', src: 'bundled' })
  }
  if (!needed.has(buildFontKey('Inter', 700, 'normal'))) {
    needed.set(buildFontKey('Inter', 700, 'normal'), { family: 'Inter', weight: 700, style: 'normal', src: 'bundled' })
  }

  const loadPromises = Array.from(needed.entries()).map(async ([key, spec]) => {
    const bytes = await loadFontBytes(spec, doc.allowedFileDirs)
    return { key, bytes, spec }
  })

  const loaded = await Promise.all(loadPromises)

  for (const { key, bytes, spec } of loaded) {
    try {
      const isTTF = bytes.length >= 4 && (
        (bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) ||
        (bytes[0] === 0x74 && bytes[1] === 0x72 && bytes[2] === 0x75 && bytes[3] === 0x65)
      )
      const pdfFont = await pdfDoc.embedFont(bytes, { subset: isTTF })
      fontMap.set(key, pdfFont)
    } catch (err) {
      throw new PretextPdfError(
        'FONT_EMBED_FAILED',
        `Failed to embed font "${(spec as FontSpec).family ?? key}": ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  const textByFont = collectTextByFont(doc)
  for (const [key, text] of textByFont) {
    const pdfFont = fontMap.get(key)
    if (pdfFont && text.length > 0) {
      try {
        pdfFont.encodeText(text)
      } catch (err) {
        throw new PretextPdfError(
          'FONT_ENCODE_FAIL',
          `Font subset failed for "${key}": ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }
  }

  const defaultKey = buildFontKey(defaultFamily, 400, 'normal')
  if (!fontMap.has(defaultKey)) {
    const interKey = buildFontKey('Inter', 400, 'normal')
    const interFont = fontMap.get(interKey)
    if (interFont) fontMap.set(defaultKey, interFont)
  }

  return fontMap
}
