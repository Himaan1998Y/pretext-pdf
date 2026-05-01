/**
 * Plugin API — Custom Element Types Example
 *
 * Demonstrates how to register a custom element type using the PluginDefinition API.
 * This example defines a `highlight-box` element that draws a colored background
 * with centered label text.
 *
 * Run: npx tsx examples/plugin-custom-element.ts
 * Output: output/plugin-custom-element.pdf
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { rgb } from '@cantoo/pdf-lib'
import { render } from '../dist/index.js'
import type { PluginDefinition } from '../dist/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── Plugin definition ────────────────────────────────────────────────────────

/** Custom element shape — extend Record<string, unknown> for plugin compatibility */
interface HighlightBoxElement {
  type: 'highlight-box'
  label: string
  /** Background color as [r, g, b] floats in 0–1 range. Defaults to soft amber. */
  color?: [number, number, number]
  height?: number
}

const highlightBoxPlugin: PluginDefinition = {
  type: 'highlight-box',

  // Optional: reject malformed elements at validation time
  validate(element) {
    if (typeof element['label'] !== 'string' || element['label'].length === 0) {
      return 'highlight-box requires a non-empty "label" string'
    }
  },

  // Required: return the block's height so the layout engine can paginate it
  async measure(element, { contentWidth: _contentWidth }) {
    const el = element as HighlightBoxElement
    return {
      height: el.height ?? 48,
      spaceBefore: 8,
      spaceAfter: 8,
    }
  },

  // Required: draw onto the PDF page using pdf-lib's drawing API
  render({ element, pdfPage, x, y, width, height }) {
    const el = element as HighlightBoxElement
    const [r, g, b] = el.color ?? [1, 0.93, 0.73]

    // Fill background (y is the top edge; pdf-lib origin is bottom-left)
    pdfPage.drawRectangle({
      x,
      y: y - height,
      width,
      height,
      color: rgb(r, g, b),
      borderColor: rgb(r * 0.7, g * 0.7, b * 0.7),
      borderWidth: 1,
    })

    // Draw centered label text
    const fontSize = 13
    pdfPage.drawText(el.label, {
      x: x + 16,
      y: y - height / 2 - fontSize / 2,
      size: fontSize,
      color: rgb(0.15, 0.15, 0.15),
    })
  },
}

// ─── Document ─────────────────────────────────────────────────────────────────

const pdf = await render(
  {
    metadata: { title: 'Plugin API Demo' },
    content: [
      { type: 'heading', level: 1, text: 'Custom Element Types via Plugin API' },
      {
        type: 'paragraph',
        text: 'The plugin API lets you register new element types without forking the library. '
          + 'Each plugin defines validate / measure / render hooks that slot into the standard pipeline.',
      },
      { type: 'spacer', height: 16 },

      // Custom element — type must match the plugin's `type` field
      { type: 'highlight-box', label: '✓  Step 1 complete: document received' } as unknown as never,
      { type: 'highlight-box', label: '✓  Step 2 complete: layout measured', color: [0.82, 0.96, 0.84] } as unknown as never,
      { type: 'highlight-box', label: '✓  Step 3 complete: pages rendered', color: [0.8, 0.9, 1.0] } as unknown as never,

      { type: 'spacer', height: 16 },
      { type: 'paragraph', text: 'Below is a standard paragraph following the custom elements — layout continues normally.' },
      { type: 'hr' },
      { type: 'paragraph', text: 'Plugin elements participate in pagination just like built-in types.' },
    ],
  },
  { plugins: [highlightBoxPlugin] }
)

// ─── Output ───────────────────────────────────────────────────────────────────

const outputDir = path.join(__dirname, '..', 'output')
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir)

const outputPath = path.join(outputDir, 'plugin-custom-element.pdf')
fs.writeFileSync(outputPath, pdf)
console.log(`Written: ${outputPath} (${(pdf.length / 1024).toFixed(1)} KB)`)
