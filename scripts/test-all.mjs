#!/usr/bin/env node
// Runs all test stages and reports all failures rather than aborting at the first failed stage.
//
// benchmark stage: included but skipped on CI by default via PRETEXT_BENCHMARK_FLOOR_MS=skip.
// Set PRETEXT_BENCHMARK_FLOOR_MS=skip in your CI env to avoid flaky wall-clock failures.
//
// test:visual (pixel-diff visual regression) is intentionally NOT included here.
// Visual baselines are machine-specific (font rendering differs by OS/GPU) and must
// be run manually: `npm run test:visual` to compare, `npm run test:visual:update` to
// re-capture baselines. Including it in the default suite would cause false failures
// on any machine that differs from the baseline-capture machine.
import { spawnSync } from 'node:child_process'

const stages = ['test:contract', 'test:unit', 'test:e2e', 'test:phases', 'test:benchmark']
const failed = []

// Allow callers to skip the benchmark stage without modifying this file.
// PRETEXT_BENCHMARK_FLOOR_MS=skip is forwarded to benchmark-baseline.test.ts
// which skips the assertion when this value is 'skip'.
const env = { ...process.env }

for (const stage of stages) {
  console.log(`\n▶ npm run ${stage}`)
  const r = spawnSync('npm', ['run', stage], { stdio: 'inherit', shell: true, env })
  if (r.status !== 0) failed.push(stage)
}

if (failed.length > 0) {
  console.error(`\n✗ Failed stages: ${failed.join(', ')}`)
  process.exit(1)
}
console.log('\n✓ All test stages passed')
