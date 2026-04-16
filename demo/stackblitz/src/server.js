import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { join, extname } from 'node:path'
import { render } from 'pretext-pdf'

const PORT = 3000
const PUBLIC = new URL('../public/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

const server = createServer(async (req, res) => {
  // POST /render — accept PdfDocument JSON, return PDF bytes
  if (req.method === 'POST' && req.url === '/render') {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = Buffer.concat(chunks).toString()

    try {
      const doc = JSON.parse(body)
      const t0 = performance.now()
      const pdf = await render(doc)
      const ms = (performance.now() - t0).toFixed(0)
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': pdf.byteLength,
        'X-Render-Time': ms,
        'X-Pdf-Size': pdf.byteLength,
      })
      res.end(Buffer.from(pdf))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const code = err.code ?? 'UNKNOWN_ERROR'
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: code, message: msg }))
    }
    return
  }

  // Static files
  let filePath = req.url === '/' ? '/index.html' : req.url
  const fullPath = join(PUBLIC, filePath)
  try {
    const data = readFileSync(fullPath)
    const ext = extname(fullPath)
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
})

server.listen(PORT, () => {
  console.log(`\n  pretext-pdf demo: http://localhost:${PORT}\n`)
})
