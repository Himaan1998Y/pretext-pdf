import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { join, extname, resolve, normalize } from 'node:path'
import { render } from 'pretext-pdf'

const PORT = process.env.PORT || 3000
const MAX_BODY = 512_000 // 512 KB
const PUBLIC = resolve(new URL('../public/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
}

const server = createServer(async (req, res) => {
  // POST /render — accept PdfDocument JSON, return PDF bytes
  if (req.method === 'POST' && req.url === '/render') {
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      if (size > MAX_BODY) {
        res.writeHead(413, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'PAYLOAD_TOO_LARGE', message: `Body exceeds ${MAX_BODY / 1000} KB limit` }))
        return
      }
      chunks.push(chunk)
    }

    let doc
    try {
      doc = JSON.parse(Buffer.concat(chunks).toString())
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'JSON_PARSE_ERROR', message: e.message }))
      return
    }

    try {
      const t0 = performance.now()
      const pdf = await render(doc)
      const ms = (performance.now() - t0).toFixed(0)
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': pdf.byteLength,
        'X-Render-Time': ms,
        'X-Pdf-Size': String(pdf.byteLength),
      })
      res.end(Buffer.from(pdf))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const code = err.code ?? 'RENDER_ERROR'
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: code, message: msg }))
    }
    return
  }

  // GET /version — report pretext-pdf version for the badge
  if (req.method === 'GET' && req.url === '/version') {
    try {
      const { readFileSync } = await import('node:fs')
      const { fileURLToPath } = await import('node:url')
      const { dirname } = await import('node:path')
      const here = dirname(fileURLToPath(import.meta.url))
      const pkgPath = join(here, '..', 'node_modules', 'pretext-pdf', 'package.json')
      const { version } = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ version }))
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ version: 'unknown' }))
    }
    return
  }

  // Static files — prevent path traversal
  const urlPath = (req.url || '/').split('?')[0]
  const filePath = urlPath === '/' ? '/index.html' : urlPath
  const fullPath = normalize(join(PUBLIC, filePath))

  if (!fullPath.startsWith(PUBLIC)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  try {
    const data = readFileSync(fullPath)
    const ext = extname(fullPath)
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
})

server.listen(PORT, () => {
  console.log(`\n  pretext-pdf demo: http://localhost:${PORT}\n`)
})
