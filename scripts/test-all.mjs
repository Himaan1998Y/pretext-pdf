#!/usr/bin/env node
// Runs all test stages and reports all failures rather than aborting at the first failed stage.
import { spawnSync } from 'node:child_process'

const stages = ['test:contract', 'test:unit', 'test:e2e', 'test:phases']
const failed = []

for (const stage of stages) {
  console.log(`\n▶ npm run ${stage}`)
  const r = spawnSync('npm', ['run', stage], { stdio: 'inherit', shell: true })
  if (r.status !== 0) failed.push(stage)
}

if (failed.length > 0) {
  console.error(`\n✗ Failed stages: ${failed.join(', ')}`)
  process.exit(1)
}
console.log('\n✓ All test stages passed')
