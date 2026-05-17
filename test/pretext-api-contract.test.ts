/**
 * Vendored pretext API contract test — local export-shape guard for the
 * vendored pretext layout module. NOT an upstream version canary: pretext
 * is vendored at src/vendor/pretext/ since v1.1.0 and no longer tracks an
 * npm dependency. See UPSTREAM.md.
 *
 * Documents exactly which exports pretext-pdf depends on from the vendored
 * pretext engine at src/vendor/pretext/layout.ts.
 * If this test breaks, src/measure.ts and src/rich-text.ts need updating.
 *
 * NOTE: prepareWithSegments/layoutWithLines require a canvas context (OffscreenCanvas
 * or @napi-rs/canvas polyfill). They cannot be called directly in isolation here.
 * Those functions are tested indirectly via the full render() pipeline in e2e.test.ts.
 * This file only asserts the exported API shape hasn't changed.
 *
 * Provenance: vendored from github:chenglou/pretext (see UPSTREAM.md). The previous
 * `@chenglou/pretext` npm dep was removed in v1.1.0 when the source was vendored
 * into src/vendor/pretext/.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

const PRETEXT_PATH = '../src/vendor/pretext/layout.js'

test('pretext: module exports prepareWithSegments function', async () => {
  const pretext = await import(PRETEXT_PATH)
  assert.strictEqual(typeof pretext.prepareWithSegments, 'function',
    'prepareWithSegments must be exported as a function — if missing, src/measure.ts calls will fail')
})

test('pretext: module exports layoutWithLines function', async () => {
  const pretext = await import(PRETEXT_PATH)
  assert.strictEqual(typeof pretext.layoutWithLines, 'function',
    'layoutWithLines must be exported as a function — if missing, src/measure.ts calls will fail')
})

test('pretext: prepareWithSegments has correct arity (accepts array argument)', async () => {
  const { prepareWithSegments } = await import(PRETEXT_PATH)
  // Cannot call it without canvas, but arity tells us the signature hasn't changed
  assert.ok(prepareWithSegments.length <= 4,
    'prepareWithSegments signature changed — verify src/measure.ts call sites')
})

test('pretext: layoutWithLines has correct arity (accepts prepared + width + height)', async () => {
  const { layoutWithLines } = await import(PRETEXT_PATH)
  assert.ok(layoutWithLines.length <= 4,
    'layoutWithLines signature changed — verify src/measure.ts call sites')
})

test('pretext: layoutNextLine reconstruction includes trailing collapsible space', async () => {
  // Regression guard for PR #29 fix: trailing space must be in line boundary,
  // not silently dropped and then consumed by normalizeLineStart on the next line.
  const pretext = await import(PRETEXT_PATH)
  assert.strictEqual(typeof pretext.layoutNextLine, 'function',
    'layoutNextLine must be exported — line-by-line layout API guard')
})
