import { PretextPdfError } from './errors.js'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

let polyfillInstalled = false

/**
 * Installs @napi-rs/canvas as OffscreenCanvas for Node.js environments.
 * Must be called before any Pretext import resolves its canvas context.
 * Safe to call multiple times — only installs once.
 */
export async function installNodePolyfill(): Promise<void> {
  if (polyfillInstalled) return

  // Verify @napi-rs/canvas is available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let napiCanvas: any
  try {
    napiCanvas = await import('@napi-rs/canvas' as string)
  } catch {
    throw new PretextPdfError(
      'CANVAS_UNAVAILABLE',
      '@napi-rs/canvas is required for Node.js usage. Install it: npm install @napi-rs/canvas'
    )
  }

  const { createCanvas, GlobalFonts } = napiCanvas

  // Polyfill OffscreenCanvas with @napi-rs/canvas
  class NodeOffscreenCanvas {
    private _canvas: ReturnType<typeof createCanvas>

    constructor(width: number, height: number) {
      this._canvas = createCanvas(width, height)
    }

    getContext(type: string) {
      return this._canvas.getContext(type as '2d')
    }

    get width() { return this._canvas.width }
    get height() { return this._canvas.height }
  }

  // @ts-ignore — OffscreenCanvas is a browser global, not in Node.js types
  global.OffscreenCanvas = NodeOffscreenCanvas

  // Register bundled Inter fonts so Pretext can measure them accurately
  const fontVariants: Array<{ paths: string[]; family: string }> = [
    {
      family: 'Inter',
      paths: [
        path.join(__dirname, '..', 'node_modules', '@fontsource', 'inter', 'files', 'inter-latin-400-normal.woff2'),
        path.join(__dirname, '..', 'node_modules', '@fontsource', 'inter', 'files', 'inter-all-400-normal.woff2'),
        path.join(__dirname, '..', 'fonts', 'inter-latin-400-normal.woff2'),
      ],
    },
    {
      // Register bold as the same family — @napi-rs/canvas (Skia) uses the
      // bold variant automatically when the CSS font string includes "bold"
      family: 'Inter',
      paths: [
        path.join(__dirname, '..', 'node_modules', '@fontsource', 'inter', 'files', 'inter-latin-700-normal.woff2'),
        path.join(__dirname, '..', 'node_modules', '@fontsource', 'inter', 'files', 'inter-all-700-normal.woff2'),
        path.join(__dirname, '..', 'fonts', 'inter-latin-700-normal.woff2'),
      ],
    },
  ]

  let anyLoaded = false
  for (const variant of fontVariants) {
    for (const fontPath of variant.paths) {
      if (fs.existsSync(fontPath)) {
        try {
          GlobalFonts.registerFromPath(fontPath, variant.family)
          anyLoaded = true
          break // Move to next variant
        } catch {
          // Try next candidate path
        }
      }
    }
  }

  if (!anyLoaded) {
    console.warn('[pretext-pdf] Inter font not found for Node.js canvas measurement. Text metrics may differ. Run: npm install @fontsource/inter')
  }

  polyfillInstalled = true
}
