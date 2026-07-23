import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installNodePolyfill } from '../src/node-polyfill.js'
import { prepareWithSegments, layoutWithLines } from '../src/vendor/pretext/layout.js'

// Regression test for a bug an independent audit found during the v2.2.0 vendor
// upgrade: the vendored pretext engine's `letterSpacing` option was missing the
// terminal gap (the space after the LAST character on a line), because a fork
// commit had silently deleted `getTerminalLetterSpacing`/`finalizeLinePaintWidth`
// as part of an unrelated cleanup. Restored in v2.2.1 — this test pins the
// behavior so a future vendor upgrade can't silently drop it again.
//
// pretext-pdf's own public API (`render()`) does not currently route
// `letterSpacing` through this vendored feature — `src/rich-text.ts` implements
// its own independent letter-spacing math against pdf-lib directly — so this
// exercises the vendored engine's internal API directly rather than going
// through `render()`.

await installNodePolyfill()

function widthOf(text: string, letterSpacing: number): number {
  const prepared = prepareWithSegments(text, '16px Inter', { letterSpacing })
  const result = layoutWithLines(prepared, 99999, 99999)
  return (result.lines?.[0] as { width?: number } | undefined)?.width ?? 0
}

test('vendored engine letterSpacing — terminal gap regression', async (t) => {
  await t.test('single character includes the terminal letter-spacing gap', () => {
    const noSpacing = widthOf('A', 0)
    const withSpacing = widthOf('A', 4)
    // A single grapheme has no internal gap — the entire difference must be
    // the terminal gap after the last (only) character.
    assert.ok(
      Math.abs(withSpacing - noSpacing - 4) < 0.01,
      `expected exactly the 4pt terminal gap, got a difference of ${withSpacing - noSpacing}`,
    )
  })

  await t.test('multi-character text includes both internal and terminal gaps', () => {
    const noSpacing = widthOf('AB', 0)
    const withSpacing = widthOf('AB', 4)
    // 2 graphemes: 1 internal gap (between A and B) + 1 terminal gap (after B).
    assert.ok(
      Math.abs(withSpacing - noSpacing - 8) < 0.01,
      `expected 8pt (1 internal + 1 terminal gap), got a difference of ${withSpacing - noSpacing}`,
    )
  })

  await t.test('letterSpacing: 0 is a no-op regardless of text length', () => {
    assert.equal(widthOf('A', 0), widthOf('A', 0))
    assert.equal(widthOf('hello', 0) > 0, true)
  })
})
