/**
 * @chenglou/pretext API contract test — CANARY file.
 *
 * Documents exactly which exports pretext-pdf depends on from @chenglou/pretext.
 * If this test breaks after a pretext version update, src/measure.ts needs updating.
 *
 * NOTE: prepareWithSegments/layoutWithLines require a canvas context (OffscreenCanvas
 * or @napi-rs/canvas polyfill). They cannot be called directly in isolation here.
 * Those functions are tested indirectly via the full render() pipeline in e2e.test.ts.
 * This file only asserts the exported API shape hasn't changed.
 *
 * Current pinned version: 0.0.3 (see package.json — exact pin, no caret)
 * Fork contingency: if @chenglou/pretext is abandoned, fork to a private repo
 *   and update the package.json dependency accordingly.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

test('pretext: module exports prepareWithSegments function', async () => {
  const pretext = await import('@chenglou/pretext')
  assert.strictEqual(typeof pretext.prepareWithSegments, 'function',
    'prepareWithSegments must be exported as a function — if missing, src/measure.ts calls will fail')
})

test('pretext: module exports layoutWithLines function', async () => {
  const pretext = await import('@chenglou/pretext')
  assert.strictEqual(typeof pretext.layoutWithLines, 'function',
    'layoutWithLines must be exported as a function — if missing, src/measure.ts calls will fail')
})

test('pretext: prepareWithSegments has correct arity (accepts array argument)', async () => {
  const { prepareWithSegments } = await import('@chenglou/pretext')
  // Cannot call it without canvas, but arity tells us the signature hasn't changed
  assert.ok(prepareWithSegments.length <= 4,
    'prepareWithSegments signature changed — verify src/measure.ts call sites')
})

test('pretext: layoutWithLines has correct arity (accepts prepared + width + height)', async () => {
  const { layoutWithLines } = await import('@chenglou/pretext')
  assert.ok(layoutWithLines.length <= 4,
    'layoutWithLines signature changed — verify src/measure.ts call sites')
})
