import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ELEMENT_TYPES } from '../src/element-types.js'
import { ALLOWED_PROPS } from '../src/allowed-props.js'

const ROOT = join(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '..', '..')

// Types that exist in ELEMENT_TYPES but are legitimately absent from render.ts because
// they are converted to other types by pre-render pipeline passes.
const RENDER_PIPELINE_ONLY_TYPES = new Set([
  'toc', // converted to 'toc-entry' elements by the TOC two-pass processor
])

describe('element type drift guards', () => {
  test('ELEMENT_TYPES matches ALLOWED_PROPS keys exactly', () => {
    const fromTypes = [...ELEMENT_TYPES].sort()
    const fromProps = Object.keys(ALLOWED_PROPS).sort()
    assert.deepEqual(
      fromProps,
      fromTypes,
      'ALLOWED_PROPS keys must match ELEMENT_TYPES exactly — update allowed-props.ts or element-types.ts'
    )
  })

  test('validate.ts has a case arm for every element type', () => {
    const source = readFileSync(join(ROOT, 'src', 'validate.ts'), 'utf8')
    const missing = ELEMENT_TYPES.filter(type => !source.includes(`case '${type}':`) && !source.includes(`case "${type}":`))
    assert.deepEqual(
      missing,
      [],
      `validate.ts is missing case arms for: ${missing.join(', ')}`
    )
  })

  test('render.ts has a case arm for every renderable element type', () => {
    const renderTypes = ELEMENT_TYPES.filter(t => !RENDER_PIPELINE_ONLY_TYPES.has(t))
    const source = readFileSync(join(ROOT, 'src', 'render.ts'), 'utf8')
    const missing = renderTypes.filter(type => !source.includes(`case '${type}':`) && !source.includes(`case "${type}":`))
    assert.deepEqual(
      missing,
      [],
      `render.ts is missing case arms for: ${missing.join(', ')}`
    )
  })
})
