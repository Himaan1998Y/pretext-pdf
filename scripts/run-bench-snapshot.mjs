import { getBenchmarkCorpora } from '../src/benchmarks/corpora.ts'
import { render } from '../src/index.ts'

// v1.4.1 (M4): Default to 10 measured runs (was 3) and report
// median/p90/min in addition to avg. Variance on cold-tsx invocations
// can hit ±70%, which made any <10% gate meaningless with N=3.
//
// Override with --runs N. Suggested values:
//   CI:   5  (cheap, stable enough for trend tracking)
//   dev:  3  (quick smoke check)
//   full: 10 (default — used for release benchmark snapshots)
function parseRunsFlag(argv) {
  const idx = argv.findIndex(a => a === '--runs')
  if (idx === -1) return 10
  const raw = argv[idx + 1]
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
    console.error(`[bench] --runs must be a positive integer, got: ${String(raw)}`)
    process.exit(1)
  }
  return n
}

function quantile(sortedAsc, q) {
  // Linear interpolation between closest ranks.
  if (sortedAsc.length === 0) return NaN
  if (sortedAsc.length === 1) return sortedAsc[0]
  const pos = (sortedAsc.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sortedAsc[lo]
  const frac = pos - lo
  return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac
}

const runs = parseRunsFlag(process.argv.slice(2))
console.log(`[bench] measured runs per corpus: ${runs}`)

const corpora = getBenchmarkCorpora()
const results = []

for (const corpus of corpora) {
  const doc = corpus.document()
  await render(doc) // warmup
  const times = []
  for (let i = 0; i < runs; i++) {
    const start = performance.now()
    await render(doc)
    times.push(performance.now() - start)
  }
  const sorted = [...times].sort((a, b) => a - b)
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  const min = sorted[0]
  const median = quantile(sorted, 0.5)
  const p90 = quantile(sorted, 0.9)
  const row = {
    id: corpus.id,
    runs,
    avgMs: +avg.toFixed(1),
    medianMs: +median.toFixed(1),
    p90Ms: +p90.toFixed(1),
    minMs: +min.toFixed(1),
  }
  results.push(row)
  console.log(
    `${corpus.id}: avg=${avg.toFixed(1)}ms median=${median.toFixed(1)}ms p90=${p90.toFixed(1)}ms min=${min.toFixed(1)}ms (n=${runs})`,
  )
}

console.log('\nJSON:', JSON.stringify(results))
