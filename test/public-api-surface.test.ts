/**
 * Public API surface tripwire.
 *
 * Locks the set of runtime exports for every public entry point declared in
 * package.json#exports. Any addition, removal, or kind-change (function vs
 * object) will fail this test.
 *
 * Type-only exports (interfaces, type aliases) do not appear at runtime and
 * are intentionally not snapshotted here — they are guarded separately by
 * `tsc --noEmit` and api-extractor.
 *
 * Added in v1.3.6 as a guardrail for the v1.4.0 god-file split sprint.
 *
 * To intentionally change the surface:
 *   1. Update the baseline below.
 *   2. Mention the change in CHANGELOG under the appropriate semver bump.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

type ExportEntry = { name: string; type: string }

interface EntryPointSpec {
  label: string
  modulePath: string
  expected: ExportEntry[]
}

const ENTRY_POINTS: EntryPointSpec[] = [
  {
    label: '.',
    modulePath: '../dist/index.js',
    expected: [
      { name: 'ELEMENT_TYPES', type: 'object' },
      { name: 'LEGACY_ERROR_CODE_MAP', type: 'object' },
      { name: 'MAX_PDF_BYTES', type: 'number' },
      { name: 'PretextPdfError', type: 'function' },
      { name: 'assemble', type: 'function' },
      { name: 'createFootnoteSet', type: 'function' },
      { name: 'createPdf', type: 'function' },
      { name: 'merge', type: 'function' },
      { name: 'render', type: 'function' },
      { name: 'validate', type: 'function' },
      { name: 'validateDocument', type: 'function' },
    ],
  },
  {
    label: './markdown',
    modulePath: '../dist/markdown.js',
    expected: [{ name: 'markdownToContent', type: 'function' }],
  },
  {
    label: './templates',
    modulePath: '../dist/templates.js',
    expected: [
      { name: 'createGstInvoice', type: 'function' },
      { name: 'createInvoice', type: 'function' },
      { name: 'createReport', type: 'function' },
    ],
  },
  {
    label: './compat',
    modulePath: '../dist/compat.js',
    expected: [{ name: 'fromPdfmake', type: 'function' }],
  },
  {
    label: './plugin-types',
    modulePath: '../dist/plugin-types.js',
    // Type-only module — no runtime exports.
    expected: [],
  },
  {
    label: './schema',
    modulePath: '../dist/schema.js',
    expected: [{ name: 'pdfDocumentSchema', type: 'object' }],
  },
  {
    label: './signing',
    modulePath: '../dist/signing/index.js',
    expected: [
      { name: 'applyEncryption', type: 'function' },
      { name: 'applyPostProcessing', type: 'function' },
      { name: 'applySignature', type: 'function' },
      { name: 'renderSignaturePlaceholder', type: 'function' },
    ],
  },
]

function snapshot(mod: Record<string, unknown>): ExportEntry[] {
  return Object.keys(mod)
    .sort()
    .map((name) => ({ name, type: typeof mod[name] }))
}

describe('public API surface — tripwire', () => {
  for (const { label, modulePath, expected } of ENTRY_POINTS) {
    test(`entry point "${label}" matches baseline`, async () => {
      const mod = (await import(modulePath)) as Record<string, unknown>
      const actual = snapshot(mod)
      assert.deepEqual(
        actual,
        expected,
        `Public API surface for "${label}" drifted.\n` +
          `Expected:\n${JSON.stringify(expected, null, 2)}\n` +
          `Actual:\n${JSON.stringify(actual, null, 2)}\n` +
          `If this change is intentional, update test/public-api-surface.test.ts and note it in CHANGELOG.`
      )
    })
  }
})
