/** Load font bytes from file path, Uint8Array, or bundled Inter. */

import fs from 'fs'
import path from 'path'
import type { FontSpec } from '../types.js'
import { PretextPdfError } from '../errors.js'
import { assertPathAllowed } from '../assets.js'
import {
  IS_NODE,
  BUNDLED_INTER_PATHS,
  BUNDLED_INTER_BOLD_PATHS,
  BUNDLED_INTER_ITALIC_PATHS,
  BUNDLED_INTER_BOLD_ITALIC_PATHS,
} from './bundled-paths.js'

export async function loadFontBytes(
  spec: { family: string; weight?: number; style?: 'normal' | 'italic'; src: string | Uint8Array | 'bundled' },
  allowedFileDirs?: string[]
): Promise<Uint8Array> {
  if (spec.src instanceof Uint8Array) {
    return spec.src
  }

  if (spec.src === 'bundled') {
    if (!IS_NODE) {
      throw new PretextPdfError(
        'FONT_LOAD_FAILED',
        `Bundled Inter font is not available in the browser. Supply font bytes via doc.fonts: [{ family: 'Inter', weight: 400, src: <Uint8Array> }, { family: 'Inter', weight: 700, src: <Uint8Array> }]`
      )
    }
    const weight = spec.weight ?? 400
    const style = spec.style ?? 'normal'
    let paths: string[]
    if (style === 'italic') {
      paths = weight >= 600 ? BUNDLED_INTER_BOLD_ITALIC_PATHS : BUNDLED_INTER_ITALIC_PATHS
    } else {
      paths = weight >= 600 ? BUNDLED_INTER_BOLD_PATHS : BUNDLED_INTER_PATHS
    }
    for (const p of paths) {
      if (fs.existsSync(p)) {
        try {
          const buffer = fs.readFileSync(p)
          return new Uint8Array(buffer)
        } catch {
          // Try next path
        }
      }
    }
    throw new PretextPdfError(
      'FONT_LOAD_FAILED',
      `Bundled Inter font not found. Make sure @fontsource/inter is installed: npm install @fontsource/inter`
    )
  }

  if (!IS_NODE) {
    throw new PretextPdfError(
      'FONT_LOAD_FAILED',
      `Font path "${spec.src}" is a string, but file paths cannot be read in the browser. Fetch the font yourself and pass the bytes as a Uint8Array in doc.fonts[].src.`
    )
  }

  if (!path.isAbsolute(spec.src)) {
    throw new PretextPdfError(
      'FONT_LOAD_FAILED',
      `Font path "${spec.src}" is relative. Use an absolute path (e.g. path.join(__dirname, 'fonts/Roboto.ttf')) to avoid resolution issues.`
    )
  }

  const resolvedSrc = path.resolve(spec.src)
  assertPathAllowed(resolvedSrc, allowedFileDirs, 'Font')

  if (!fs.existsSync(resolvedSrc)) {
    throw new PretextPdfError(
      'FONT_LOAD_FAILED',
      `Font file not found: "${path.basename(spec.src)}". Check the path in doc.fonts[].src.`
    )
  }

  try {
    const buffer = fs.readFileSync(resolvedSrc)
    return new Uint8Array(buffer)
  } catch (err) {
    throw new PretextPdfError(
      'FONT_LOAD_FAILED',
      `Failed to read font file "${path.basename(spec.src)}": ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

// Re-export FontSpec so callers don't need a separate import
export type { FontSpec }
