import { Agent, createServer, get } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import assert from 'node:assert/strict'

// A bounded, ordinary static server. It has no SPA fallback or root-asset fallback.
const prefix = '/preview/squeekside/'
const root = resolve('dist')
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }
// Keep loopback checks independent of a shell's outbound proxy settings.
const localAgent = new Agent({ keepAlive: false })
function fetch(url) {
  return new Promise((done, reject) => {
    get(url, { agent: localAgent }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('error', reject)
      response.on('end', () => done({
        status: response.statusCode,
        headers: { get: (name) => response.headers[name] },
        text: async () => Buffer.concat(chunks).toString('utf8'),
      }))
    }).on('error', reject)
  })
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  if (!url.pathname.startsWith(prefix)) { res.writeHead(404).end(); return }
  const path = resolve(root, decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html')
  if (!path.startsWith(root + '/')) { res.writeHead(403).end(); return }
  try { const data = await readFile(path); res.setHeader('content-type', mime[extname(path)] ?? 'text/plain'); res.end(data) }
  catch { res.writeHead(404).end() }
})
let checked = 0
try {
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done) })
  const port = server.address().port
  const base = `http://127.0.0.1:${port}${prefix}`
  const response = await fetch(base)
  assert.equal(response.status, 200)
  const html = await response.text()
  const paths = [...html.matchAll(/(?:src|href|content)="([^"]+)"/g)].map(m => m[1]).filter(s => /\.(js|css|svg|png|woff2)$/.test(s))
  for (const path of paths) {
    const url = new URL(path, base)
    assert.ok(url.pathname.startsWith(prefix))
    const asset = await fetch(url)
    assert.equal(asset.status, 200, `Subpath asset failed: ${path}`)
    assert.ok(Number(asset.headers.get('content-length')) > 0)
    checked++
    if (path.endsWith('.css')) {
      const css = await asset.text()
      for (const m of css.matchAll(/url\(([^)]+)\)/g)) {
        const font = new URL(m[1].replace(/["']/g, ''), url)
        assert.ok(font.pathname.startsWith(prefix), 'Font escaped the hosting subpath')
        assert.equal((await fetch(font)).status, 200)
        checked++
      }
    }
  }
  assert.equal((await fetch(`http://127.0.0.1:${port}/assets/`)).status, 404)
  assert.equal((await fetch(base + 'missing-route')).status, 404)
  console.log(JSON.stringify({ passed: true, subpath: prefix, assetsFetched: checked, spaFallback: false }, null, 2))
} finally {
  localAgent.destroy()
  await new Promise(done => server.close(done))
}
