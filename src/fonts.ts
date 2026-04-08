import { PDFDocument } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import type { PdfDocument, FontSpec, FontMap } from './types.js'
import { PretextPdfError } from './errors.js'
import { buildFontKey } from './measure.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const _require = createRequire(import.meta.url)

/**
 * Font loading strategy:
 * - TTF files for pdf-lib embedding (fontkit handles TTF natively, woff2 has glyph corruption bugs)
 * - woff2 for @napi-rs/canvas measurement (canvas handles woff2 perfectly via Skia)
 *
 * TTF priority: bundled fonts/ dir first, then @fontsource woff2 as fallback
 *
 * NOTE: @fontsource/inter is resolved via createRequire to handle npm hoisting correctly.
 * When pretext-pdf is installed as a package, @fontsource/inter is hoisted to the
 * consumer's node_modules, NOT to node_modules/pretext-pdf/node_modules/@fontsource/inter.
 * path.join(__dirname, '..', 'node_modules', ...) would fail in that case.
 */

function resolveInterFile(filename: string): string | null {
  try {
    const pkgJson = _require.resolve('@fontsource/inter/package.json')
    return path.join(path.dirname(pkgJson), 'files', filename)
  } catch {
    return null
  }
}

/** Path to bundled Inter 400 normal font — TTF preferred for pdf-lib */
const BUNDLED_INTER_PATHS = [
  path.join(__dirname, '..', 'fonts', 'Inter-Regular.ttf'),
  resolveInterFile('inter-latin-400-normal.woff2'),
  resolveInterFile('inter-all-400-normal.woff2'),
].filter(Boolean) as string[]

/** Path to bundled Inter 700 (bold) font — TTF preferred for pdf-lib */
const BUNDLED_INTER_BOLD_PATHS = [
  path.join(__dirname, '..', 'fonts', 'Inter-Bold.ttf'),
  resolveInterFile('inter-latin-700-normal.woff2'),
  resolveInterFile('inter-all-700-normal.woff2'),
].filter(Boolean) as string[]

/**
 * Stage 2: Load and embed all fonts.
 * - Scans document for all font references
 * - Loads font bytes (file system or Uint8Array)
 * - Embeds each into pdfDoc via fontkit
 * - Returns FontMap for use in measure + render stages
 *
 * NOTE: pdfDoc is already created by the caller. Fonts are embedded into it here.
 * The same pdfDoc is used in Stage 5 (render).
 */
export async function loadFonts(
  doc: PdfDocument,
  pdfDoc: PDFDocument
): Promise<FontMap> {
  pdfDoc.registerFontkit(fontkit)

  const fontMap: FontMap = new Map()
  const defaultFamily = doc.defaultFont ?? 'Inter'

  // Collect all font variants referenced in the document
  const needed = collectNeededFonts(doc)

  // Always ensure Inter 400 is available as the default fallback
  if (!needed.has(buildFontKey('Inter', 400, 'normal'))) {
    needed.set(buildFontKey('Inter', 400, 'normal'), {
      family: 'Inter', weight: 400, style: 'normal', src: 'bundled'
    })
  }
  if (!needed.has(buildFontKey('Inter', 700, 'normal'))) {
    needed.set(buildFontKey('Inter', 700, 'normal'), {
      family: 'Inter', weight: 700, style: 'normal', src: 'bundled'
    })
  }

  // Load all font bytes in parallel
  const loadPromises = Array.from(needed.entries()).map(async ([key, spec]) => {
    const bytes = await loadFontBytes(spec)
    return { key, bytes, spec }
  })

  const loaded = await Promise.all(loadPromises)

  // Embed each font into pdfDoc (must be sequential — pdf-lib limitation)
  for (const { key, bytes, spec } of loaded) {
    try {
      // Phase 6D: Use fontkit's built-in subsetting for TTF fonts.
      // TTF magic bytes: 0x00010000 (TrueType) or 0x74727565 ('true').
      // woff2 starts with 0x774F4632 — fontkit has a known subsetting bug for woff2.
      const isTTF = bytes.length >= 4 && (
        (bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00) ||
        (bytes[0] === 0x74 && bytes[1] === 0x72 && bytes[2] === 0x75 && bytes[3] === 0x65)
      )
      const pdfFont = await pdfDoc.embedFont(bytes, { subset: isTTF })
      fontMap.set(key, pdfFont)
    } catch (err) {
      throw new PretextPdfError(
        'FONT_EMBED_FAILED',
        `Failed to embed font "${spec.family ?? key}": ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  // Set default font
  const defaultKey = buildFontKey(defaultFamily, 400, 'normal')
  if (!fontMap.has(defaultKey)) {
    // Default font wasn't explicitly added — try Inter as fallback
    const interKey = buildFontKey('Inter', 400, 'normal')
    const interFont = fontMap.get(interKey)
    if (interFont) {
      fontMap.set(defaultKey, interFont)
    }
  }

  return fontMap
}

/**
 * Scan document to collect every unique font variant needed.
 * Returns a Map from fontKey → FontSpec-like descriptor.
 */
function collectNeededFonts(doc: PdfDocument): Map<string, FontSpec & { src: string | Uint8Array | 'bundled' }> {
  const needed = new Map<string, FontSpec & { src: string | Uint8Array | 'bundled' }>()
  const defaultFamily = doc.defaultFont ?? 'Inter'

  // Build lookup from user-provided fonts
  const userFonts = new Map<string, FontSpec>()
  for (const f of doc.fonts ?? []) {
    const key = buildFontKey(f.family, f.weight ?? 400, f.style ?? 'normal')
    userFonts.set(key, f)
  }

  const addFont = (family: string, weight: 400 | 700, style: 'normal' | 'italic') => {
    const key = buildFontKey(family, weight, style)
    if (needed.has(key)) return

    const userFont = userFonts.get(key)
    if (userFont) {
      needed.set(key, { ...userFont, src: userFont.src })
    } else if (family === 'Inter') {
      needed.set(key, { family, weight, style, src: 'bundled' })
    } else {
      // Font variant referenced but not in doc.fonts.
      // validate() should have caught this — if we reach here it's a bug in the validation layer.
      throw new PretextPdfError(
        'FONT_EMBED_FAILED',
        `Font variant "${key}" is required by the document but was not found in doc.fonts and is not a bundled variant. This is a bug — font validation should have caught this.`
      )
    }
  }

  // Default font always needed
  addFont(defaultFamily, 400, 'normal')

  // Scan content — collect every font variant referenced by every element type
  for (const el of doc.content) {
    if (el.type === 'paragraph') {
      const family = el.fontFamily ?? defaultFamily
      const weight = el.fontWeight ?? 400
      addFont(family, weight, 'normal')
    } else if (el.type === 'heading') {
      const family = el.fontFamily ?? defaultFamily
      const weight = el.fontWeight ?? 700
      addFont(family, weight, 'normal')
    } else if (el.type === 'code') {
      addFont(el.fontFamily, 400, 'normal')
    } else if (el.type === 'rich-paragraph') {
      for (const span of el.spans) {
        addFont(
          span.fontFamily ?? defaultFamily,
          span.fontWeight ?? 400,
          span.fontStyle ?? 'normal'
        )
      }
    } else if (el.type === 'list') {
      for (const item of el.items) {
        if ((item.fontWeight ?? 400) === 700) addFont(defaultFamily, 700, 'normal')
        for (const nested of item.items ?? []) {
          if ((nested.fontWeight ?? 400) === 700) addFont(defaultFamily, 700, 'normal')
        }
      }
    } else if (el.type === 'table') {
      // Table cells can use bold (headers) or custom weights
      addFont(defaultFamily, 400, 'normal')
      for (const row of el.rows) {
        for (const cell of row.cells) {
          const cellFamily = cell.fontFamily ?? defaultFamily
          const cellWeight = cell.fontWeight ?? (row.isHeader ? 700 : 400)
          addFont(cellFamily, cellWeight, 'normal')
        }
        if (row.isHeader) addFont(defaultFamily, 700, 'normal')
      }
    } else if (el.type === 'blockquote') {
      const family = el.fontFamily ?? defaultFamily
      const weight = el.fontWeight ?? 400
      const style = el.fontStyle ?? 'normal'
      addFont(family, weight, style)
    }
    // spacer, image, hr, page-break use default font (already added)
  }

  // Header/footer fonts
  if (doc.header) {
    const family = doc.header.fontFamily ?? defaultFamily
    addFont(family, doc.header.fontWeight ?? 400, 'normal')
  }
  if (doc.footer) {
    const family = doc.footer.fontFamily ?? defaultFamily
    addFont(family, doc.footer.fontWeight ?? 400, 'normal')
  }

  // Watermark font (text watermark only)
  if (doc.watermark?.text) {
    const family = doc.watermark.fontFamily ?? defaultFamily
    addFont(family, doc.watermark.fontWeight ?? 400, 'normal')
  }

  return needed
}

/** Load font bytes from file path, Uint8Array, or bundled Inter */
async function loadFontBytes(
  spec: { family: string; weight?: number; src: string | Uint8Array | 'bundled' }
): Promise<Uint8Array> {
  if (spec.src instanceof Uint8Array) {
    return spec.src
  }

  if (spec.src === 'bundled') {
    const paths = (spec.weight ?? 400) >= 600 ? BUNDLED_INTER_BOLD_PATHS : BUNDLED_INTER_PATHS
    for (const p of paths) {
      if (fs.existsSync(p)) {
        try {
          const buffer = fs.readFileSync(p)
          return new Uint8Array(buffer)
        } catch {
          // Try next
        }
      }
    }
    throw new PretextPdfError(
      'FONT_LOAD_FAILED',
      `Bundled Inter font not found. Make sure @fontsource/inter is installed: npm install @fontsource/inter`
    )
  }

  // String path — relative paths will likely fail on different working directories
  if (!path.isAbsolute(spec.src)) {
    throw new PretextPdfError(
      'FONT_LOAD_FAILED',
      `Font path "${spec.src}" is relative. Use an absolute path (e.g. path.join(__dirname, 'fonts/Roboto.ttf')) to avoid resolution issues.`
    )
  }

  if (!fs.existsSync(spec.src)) {
    throw new PretextPdfError(
      'FONT_LOAD_FAILED',
      `Font file not found: "${spec.src}". Check the path in doc.fonts[].src.`
    )
  }

  try {
    const buffer = fs.readFileSync(spec.src)
    return new Uint8Array(buffer)
  } catch (err) {
    throw new PretextPdfError(
      'FONT_LOAD_FAILED',
      `Failed to read font file "${spec.src}": ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

/**
 * Walk all content elements + header/footer and collect text strings grouped by font key.
 * Used by Phase 6D font subsetting to determine which glyphs each font needs.
 *
 * Returns: Map<fontKey, concatenated text string>
 */
export function collectTextByFont(
  doc: PdfDocument
): Map<string, string> {
  const defaultFont = doc.defaultFont ?? 'Inter'
  const textSets = new Map<string, Set<string>>()

  function addText(fontKey: string, text: string) {
    if (!textSets.has(fontKey)) textSets.set(fontKey, new Set())
    textSets.get(fontKey)!.add(text)
  }

  for (const el of doc.content) {
    switch (el.type) {
      case 'paragraph': {
        const key = buildFontKey(el.fontFamily ?? defaultFont, el.fontWeight ?? 400, 'normal')
        addText(key, el.text)
        break
      }
      case 'heading': {
        const key = buildFontKey(el.fontFamily ?? defaultFont, el.fontWeight ?? 700, 'normal')
        addText(key, el.text)
        break
      }
      case 'blockquote': {
        const key = buildFontKey(el.fontFamily ?? defaultFont, el.fontWeight ?? 400, el.fontStyle ?? 'normal')
        addText(key, el.text)
        break
      }
      case 'code': {
        const key = buildFontKey(el.fontFamily, 400, 'normal')
        addText(key, el.text)
        break
      }
      case 'rich-paragraph': {
        for (const span of el.spans) {
          const key = buildFontKey(span.fontFamily ?? defaultFont, span.fontWeight ?? 400, span.fontStyle ?? 'normal')
          addText(key, span.text)
        }
        break
      }
      case 'table': {
        for (const row of el.rows) {
          for (const cell of row.cells) {
            const key = buildFontKey(cell.fontFamily ?? defaultFont, cell.fontWeight ?? (row.isHeader ? 700 : 400), 'normal')
            addText(key, cell.text)
          }
        }
        break
      }
      case 'list': {
        const collectItems = (items: import('./types.js').ListItem[]) => {
          for (const item of items) {
            const key = buildFontKey(defaultFont, item.fontWeight ?? 400, 'normal')
            addText(key, item.text)
            if (item.items) collectItems(item.items)
          }
        }
        collectItems(el.items)
        break
      }
      // spacer, hr, page-break, image: no text to collect
    }
  }

  // Header/footer: include static text + digits for {{pageNumber}}/{{totalPages}} expansion
  const DIGITS = '0123456789'
  if (doc.header) {
    const key = buildFontKey(doc.header.fontFamily ?? defaultFont, doc.header.fontWeight ?? 400, 'normal')
    addText(key, doc.header.text + DIGITS)
  }
  if (doc.footer) {
    const key = buildFontKey(doc.footer.fontFamily ?? defaultFont, doc.footer.fontWeight ?? 400, 'normal')
    addText(key, doc.footer.text + DIGITS)
  }

  // Watermark text (if present)
  if (doc.watermark?.text) {
    const key = buildFontKey(doc.watermark.fontFamily ?? defaultFont, doc.watermark.fontWeight ?? 400, 'normal')
    addText(key, doc.watermark.text)
  }

  // Concatenate all text for each font key into one string
  const result = new Map<string, string>()
  for (const [key, texts] of textSets) {
    result.set(key, Array.from(texts).join(''))
  }
  return result
}
