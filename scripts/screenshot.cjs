/**
 * scripts/screenshot.cjs
 * Renders page 1 of PDF files to PNG for README display.
 * Uses pdfjs-dist legacy (CommonJS) + @napi-rs/canvas.
 *
 * Run after generating PDFs:
 *   node scripts/screenshot.cjs
 */

'use strict'

const fs = require('fs')
const path = require('path')

async function main() {
  // Dynamic imports for ESM-only modules
  let createCanvas
  let pdfjsLib

  try {
    const canvas = require(path.join(__dirname, '..', 'node_modules', '@napi-rs', 'canvas'))
    createCanvas = canvas.createCanvas
  } catch (e) {
    console.error('Failed to load @napi-rs/canvas:', e.message)
    console.error('Install it: npm install --save-dev @napi-rs/canvas')
    process.exit(1)
  }

  try {
    // pdfjs-dist v5 ships ESM only — use dynamic import with file:// URL for Windows compat
    const pdfjsPath = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs')
    const pdfjsUrl = new URL('file:///' + pdfjsPath.replace(/\\/g, '/'))
    const pdfjs = await import(pdfjsUrl.href)
    pdfjsLib = pdfjs
    // Point worker to the bundled worker for Node.js environment
    const workerPath = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs')
    const workerUrl = new URL('file:///' + workerPath.replace(/\\/g, '/'))
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.href
  } catch (e) {
    console.error('Failed to load pdfjs-dist:', e.message)
    process.exit(1)
  }

  const SCALE = 2.0  // 2x for retina-quality PNG

  async function pdfToScreenshot(pdfPath, outPath) {
    const data = new Uint8Array(fs.readFileSync(pdfPath))
    const loadingTask = pdfjsLib.getDocument({
      data,
      isEvalSupported: false,
      disableFontFace: true,
      verbosity: 0,
    })
    const pdfDoc = await loadingTask.promise
    const page = await pdfDoc.getPage(1)
    const viewport = page.getViewport({ scale: SCALE })

    const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height))
    const ctx = canvas.getContext('2d')

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise

    const png = canvas.toBuffer('image/png')
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, png)
    console.log(`Screenshot saved: ${outPath}  (${(png.length / 1024).toFixed(0)} KB)`)
  }

  const targets = [
    ['output/showcase-invoice.pdf', 'docs/screenshots/showcase-invoice.png'],
    ['output/showcase-report.pdf',  'docs/screenshots/showcase-report.png'],
    ['output/showcase-resume.pdf',  'docs/screenshots/showcase-resume.png'],
  ]

  const root = path.join(__dirname, '..')
  let anyFailed = false

  for (const [pdf, png] of targets) {
    const pdfAbs = path.join(root, pdf)
    const pngAbs = path.join(root, png)

    if (!fs.existsSync(pdfAbs)) {
      console.warn(`Skipping ${pdf} (not found — run the example first)`)
      anyFailed = true
      continue
    }

    try {
      await pdfToScreenshot(pdfAbs, pngAbs)
    } catch (err) {
      console.error(`Failed to screenshot ${pdf}:`, err.message)
      anyFailed = true
    }
  }

  if (anyFailed) {
    console.log('\nSome screenshots failed. Check errors above.')
    process.exit(1)
  } else {
    console.log('\nAll screenshots generated successfully.')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
