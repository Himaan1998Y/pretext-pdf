/**
 * Image-loading orchestrator — extracted from src/assets.ts in v1.6.0 commit 15/16.
 *
 * Stage 2b of the render pipeline: loads + embeds every ImageElement,
 * float-group image, vector asset (SVG / QR / barcode / chart), plugin
 * asset, and watermark image into a single ImageMap that the layout
 * engine consumes.
 *
 * Image keys are 'img-N' / 'float-group-N' / 'watermark' / per-vector keys
 * assigned inside loadVectorAssets / plugin-supplied keys.
 *
 * IMPORTANT: @cantoo/pdf-lib image embedding is NOT thread-safe. Raw bytes
 * load in parallel; embed calls run sequentially.
 *
 * Images that fail to load (network error, file not found, unreachable URL)
 * are routed through doc.onImageLoadError (default = warn-and-skip) so a
 * single broken image does not crash the document.
 */
import { PDFDocument } from '@cantoo/pdf-lib'
import type { PdfDocument, ImageElement, Logger } from '../../types.js'
import type { ImageMap } from '../../types-internal.js'
import { PretextPdfError } from '../../errors.js'
import type { PluginDefinition } from '../../plugin-types.js'
import { findPlugin, runPluginLoadAsset } from '../../plugin-registry.js'
import { loadImageBytes, resolveImageFormat } from './images.js'
import { loadVectorAssets } from './vectors.js'
import { loadWatermarkImage } from './watermark.js'

export async function loadImages(
  doc: PdfDocument,
  pdfDoc: PDFDocument,
  contentWidth: number,
  plugins?: PluginDefinition[],
  logger?: Logger,
): Promise<ImageMap> {
  const warn = logger ? logger.warn.bind(logger) : console.warn.bind(console)
  const imageMap: ImageMap = new Map()
  const allowedDirs = doc.allowedFileDirs

  // Collect all ImageElement entries with their content index for stable keys
  const imageEntries: Array<{ el: ImageElement; key: string }> = []
  for (let i = 0; i < doc.content.length; i++) {
    const el = doc.content[i]!
    if (el.type === 'image') {
      imageEntries.push({ el, key: `img-${i}` })
    } else if (el.type === 'float-group') {
      const fgImage: ImageElement = {
        type: 'image',
        src: el.image.src,
        ...(el.image.format !== undefined ? { format: el.image.format } : {}),
        ...(el.image.height !== undefined ? { height: el.image.height } : {}),
        align: 'left',
        spaceAfter: 0,
        spaceBefore: 0,
      }
      imageEntries.push({ el: fgImage, key: `float-group-${i}` })
    }
  }

  // Load all image bytes in parallel; capture both successes and failures
  const loadResults = imageEntries.length > 0
    ? await Promise.allSettled(
        imageEntries.map(async ({ el, key }) => {
          const bytes = await loadImageBytes(el, key, allowedDirs)
          return { el, key, bytes }
        })
      )
    : []

  // Process results: embed successful images, warn on failures
  for (let ri = 0; ri < loadResults.length; ri++) {
    const result = loadResults[ri]!
    const entry = imageEntries[ri]!

    if (result.status === 'rejected') {
      const err = result.reason instanceof Error ? result.reason : new Error(String(result.reason))
      const action = doc.onImageLoadError ? doc.onImageLoadError(entry.el.src, err) : 'skip'
      if (action === 'throw') throw err
      warn(`[pretext-pdf] Image load skipped: ${err.message}`)
      continue
    }

    const { el, key, bytes } = result.value
    const resolvedFormat = resolveImageFormat(el, bytes, key)
    try {
      const pdfImage = resolvedFormat === 'png'
        ? await pdfDoc.embedPng(bytes)
        : await pdfDoc.embedJpg(bytes)
      imageMap.set(key, pdfImage)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      const action = doc.onImageLoadError ? doc.onImageLoadError(entry.el.src, error) : 'skip'
      if (action === 'throw') throw error
      warn(`[pretext-pdf] Image embed failed: key "${key}" (format: '${resolvedFormat}')`)
      // Continue without this image rather than crashing
    }
  }

  await loadVectorAssets(doc, pdfDoc, imageMap, contentWidth, allowedDirs, warn)

  // Load plugin assets
  if (plugins && plugins.length > 0) {
    for (let i = 0; i < doc.content.length; i++) {
      const el = doc.content[i]!
      const plugin = findPlugin(plugins, el.type)
      if (!plugin) continue
      try {
        const assetResult = await runPluginLoadAsset(plugin, el as unknown as Record<string, unknown>, pdfDoc, contentWidth, i)
        if (assetResult) {
          imageMap.set(assetResult.key, assetResult.image)
        }
      } catch (err) {
        if (err instanceof PretextPdfError) throw err
        warn(`[pretext-pdf] Plugin '${plugin.type}' loadAsset failed at index ${i}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  await loadWatermarkImage(doc, pdfDoc, imageMap, allowedDirs, warn)

  return imageMap
}
