/** Browser/Node detection and bundled Inter font path resolution. */

import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

export const IS_NODE = typeof window === 'undefined' && typeof process !== 'undefined' && !!(process.versions?.node)

export const __dirname_fonts = IS_NODE ? path.dirname(fileURLToPath(import.meta.url)) : ''
export const _require = IS_NODE ? createRequire(import.meta.url) : null

export function resolveInterFile(filename: string): string | null {
  if (!_require) return null
  try {
    const pkgJson = _require.resolve('@fontsource/inter/package.json')
    return path.join(path.dirname(pkgJson), 'files', filename)
  } catch {
    return null
  }
}

/** Path to bundled Inter 400 normal font — TTF preferred for pdf-lib (Node only) */
export const BUNDLED_INTER_PATHS: string[] = IS_NODE ? [
  path.join(__dirname_fonts, '..', '..', 'fonts', 'Inter-Regular.ttf'),
  resolveInterFile('inter-latin-400-normal.woff2'),
  resolveInterFile('inter-all-400-normal.woff2'),
].filter(Boolean) as string[] : []

/** Path to bundled Inter 700 (bold) font — TTF preferred for pdf-lib (Node only) */
export const BUNDLED_INTER_BOLD_PATHS: string[] = IS_NODE ? [
  path.join(__dirname_fonts, '..', '..', 'fonts', 'Inter-Bold.ttf'),
  resolveInterFile('inter-latin-700-normal.woff2'),
  resolveInterFile('inter-all-700-normal.woff2'),
].filter(Boolean) as string[] : []

/** Path to bundled Inter 400 italic font */
export const BUNDLED_INTER_ITALIC_PATHS: string[] = IS_NODE ? [
  path.join(__dirname_fonts, '..', '..', 'fonts', 'Inter-Italic.ttf'),
  resolveInterFile('inter-latin-400-italic.woff2'),
  resolveInterFile('inter-all-400-italic.woff2'),
].filter(Boolean) as string[] : []

/** Path to bundled Inter 700 italic font */
export const BUNDLED_INTER_BOLD_ITALIC_PATHS: string[] = IS_NODE ? [
  path.join(__dirname_fonts, '..', '..', 'fonts', 'Inter-BoldItalic.ttf'),
  resolveInterFile('inter-latin-700-italic.woff2'),
  resolveInterFile('inter-all-700-italic.woff2'),
].filter(Boolean) as string[] : []
