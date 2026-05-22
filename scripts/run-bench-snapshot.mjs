import { getBenchmarkCorpora } from '../src/benchmarks/corpora.ts'
import { render } from '../src/index.ts'

const corpora = getBenchmarkCorpora()
const results = []

for (const corpus of corpora) {
  const doc = corpus.document()
  await render(doc) // warmup
  const times = []
  for (let i = 0; i < 3; i++) {
    const start = performance.now()
    await render(doc)
    times.push(performance.now() - start)
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length
  const min = Math.min(...times)
  results.push({ id: corpus.id, avgMs: +avg.toFixed(1), minMs: +min.toFixed(1) })
  console.log(`${corpus.id}: avg=${avg.toFixed(1)}ms min=${min.toFixed(1)}ms`)
}

console.log('\nJSON:', JSON.stringify(results))
