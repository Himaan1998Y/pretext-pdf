/**
 * font-key.ts — Canonical font key builder (leaf module, no internal imports)
 *
 * Extracted from measure.ts in v1.8 to break the circular dependency:
 *   measure.ts → measure-blocks/index.ts → measure.ts (for buildFontKey)
 *
 * This is a pure function with no dependencies on any other pretext-pdf module,
 * making it safe to import from anywhere in the tree.
 */

/**
 * Build the canonical font key: family-weight-style
 * Used for font map lookup in both measurement and render passes.
 */
export function buildFontKey(
  family: string,
  weight: 400 | 700 = 400,
  style: 'normal' | 'italic' = 'normal'
): string {
  return `${family}-${weight}-${style}`
}
