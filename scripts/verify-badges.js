#!/usr/bin/env node
/**
 * verify-badges.js — Fails if README shields.io badges drift from reality.
 *
 * Why this exists:
 *   README badges are hardcoded integers. They drift silently when deps or
 *   tests change. This script is run in CI before release (and on pre-commit
 *   if you wire it up) to catch drift loud-fast.
 *
 * Checks:
 *   1. `runtime%20deps-N` matches actual count of `dependencies` in package.json
 *   2. `tests-N` matches the sum of `ℹ tests <N>` lines from `npm test`
 *
 * Exit codes:
 *   0 — badges match reality
 *   1 — mismatch (prints expected vs actual)
 *   2 — script itself errored (bad regex, file missing, etc.)
 */

import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const ROOT = resolve(dirname(__filename), '..')

function fail(msg) {
  console.error(`[verify-badges] FAIL: ${msg}`)
  process.exit(1)
}

function abort(msg) {
  console.error(`[verify-badges] ERROR: ${msg}`)
  process.exit(2)
}

// --- check 1: runtime deps count ---
let pkg
try {
  pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))
} catch (e) {
  abort(`cannot read package.json: ${e.message}`)
}
const actualDeps = Object.keys(pkg.dependencies || {}).length

let readme
try {
  readme = readFileSync(resolve(ROOT, 'README.md'), 'utf8')
} catch (e) {
  abort(`cannot read README.md: ${e.message}`)
}

const depsMatch = readme.match(/runtime%20deps-(\d+)-/)
if (!depsMatch) abort('could not find runtime-deps badge in README')
const badgeDeps = Number(depsMatch[1])

if (badgeDeps !== actualDeps) {
  fail(`runtime-deps badge says ${badgeDeps}, package.json has ${actualDeps} — update README line with \`runtime%20deps-${actualDeps}-informational\``)
}
console.log(`[verify-badges] OK: runtime deps = ${actualDeps}`)

// --- check 2: test count ---
// Match any of: tests-600%2B, tests-624, tests-600+
const testsMatch = readme.match(/tests-(\d+)(?:%2B|\+)?-/)
if (!testsMatch) abort('could not find tests badge in README')
const badgeTests = Number(testsMatch[1])

// Skip the actual npm test run if SKIP_TEST_RUN is set (fast path for non-release checks)
if (process.env.SKIP_TEST_RUN === '1') {
  console.log(`[verify-badges] SKIP: test count verification (SKIP_TEST_RUN=1); badge says ${badgeTests}`)
  process.exit(0)
}

let testOutput
try {
  testOutput = execSync('npm test 2>&1', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
} catch (e) {
  // npm test can exit nonzero on informational output; capture stdout anyway
  testOutput = (e.stdout || '') + (e.stderr || '')
  if (!testOutput.includes('ℹ tests')) {
    abort(`npm test failed and produced no test summary: ${e.message}`)
  }
}

const testCounts = [...testOutput.matchAll(/^ℹ tests (\d+)$/gm)].map((m) => Number(m[1]))
if (testCounts.length === 0) abort('no `ℹ tests N` lines in npm test output')

const actualTests = testCounts.reduce((a, b) => a + b, 0)

// Allow exact match OR "X+" where X <= actual (the "+" form is aspirational)
const exactMatch = actualTests === badgeTests
if (!exactMatch) {
  fail(`tests badge says ${badgeTests}, npm test ran ${actualTests} — update README with \`tests-${actualTests}-brightgreen\``)
}
console.log(`[verify-badges] OK: tests = ${actualTests}`)

console.log('[verify-badges] all badges match reality ✓')
