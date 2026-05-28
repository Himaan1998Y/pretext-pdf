import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ELEMENT_TYPES } from '../src/element-types.js'
import { ALLOWED_PROPS } from '../src/allowed-props.js'

// fileURLToPath handles Windows drive-letter paths correctly (file:///C:/... → C:\...).
// The previous regex-based strip `/^\/([A-Z]:/` was brittle: it assumed a leading
// slash before a capital drive letter, which breaks on network paths and lowercase drives.
// dirname() gives test/, so one '..' reaches the project root.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// Types that exist in ELEMENT_TYPES but are legitimately absent from render.ts because
// they are converted to other types by pre-render pipeline passes.
const RENDER_PIPELINE_ONLY_TYPES = new Set([
  'toc', // converted to 'toc-entry' elements by the TOC two-pass processor
])

// Types absent from measure-blocks/index.ts dispatcher because measureAllBlocks() handles
// them with content-index context before falling through to the per-block measurer.
const MEASURE_DISPATCHER_EXCLUDES = new Set([
  'toc-entry', // guarded as internal-only at the top of measureBlock (line 45 throw)
])

// Types absent from validate/index.ts dispatcher because they are rejected by an
// explicit pre-switch throw — the case arm would be unreachable dead code.
const VALIDATE_DISPATCHER_EXCLUDES = new Set([
  'toc-entry', // rejected by pre-switch throw at validate/index.ts (internal-only type)
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

  test('validate dispatcher has a case arm for every element type', () => {
    // Post v1.4.0 #11a split: the dispatcher lives in src/validate/index.ts;
    // the per-element bodies live in src/validate/elements/*. Scan the
    // orchestrator file since that's where the switch statement is.
    const source = readFileSync(join(ROOT, 'src', 'validate', 'index.ts'), 'utf8')
    const validateTypes = ELEMENT_TYPES.filter(t => !VALIDATE_DISPATCHER_EXCLUDES.has(t))
    const missing = validateTypes.filter(type => !source.includes(`case '${type}':`) && !source.includes(`case "${type}":`))
    assert.deepEqual(
      missing,
      [],
      `validate/index.ts is missing case arms for: ${missing.join(', ')}`
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

  test('measure-blocks dispatcher has a case arm for every element type', () => {
    // Post v1.4.0 #11b split: measureBlock dispatcher lives in src/measure-blocks/index.ts.
    // Scan the orchestrator file for case-arm completeness — mirrors validate + render guards.
    const measureTypes = ELEMENT_TYPES.filter(t => !MEASURE_DISPATCHER_EXCLUDES.has(t))
    const source = readFileSync(join(ROOT, 'src', 'measure-blocks', 'index.ts'), 'utf8')
    const missing = measureTypes.filter(type => !source.includes(`case '${type}':`) && !source.includes(`case "${type}":`))
    assert.deepEqual(
      missing,
      [],
      `measure-blocks/index.ts is missing case arms for: ${missing.join(', ')}`
    )
  })
})
