import { readFile, readdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const root = resolve('dist')
const html = await readFile(resolve(root, 'index.html'), 'utf8')
const references = [...html.matchAll(/(?:src|href|content)="([^"]+)"/g)].map(m => m[1]).filter(s => /\.(js|css|svg|png|woff2)$/.test(s))
assert.ok(html.includes('<title>Squeekside'), 'Document title missing')
for (const name of ['description', 'og:title', 'og:image']) assert.match(html, new RegExp(`(?:name|property)="${name}"`))
assert.ok(references.some(p => p.endsWith('.js')) && references.some(p => p.endsWith('.css')), 'Built entry points missing')
for (const path of references) {
  assert.ok(path.startsWith('./'), `Asset URL must be relative: ${path}`)
  await stat(resolve(root, path))
}
for (const entry of await readdir(resolve(root, 'assets'))) {
  if (!entry.endsWith('.css')) continue
  const css = await readFile(resolve(root, 'assets', entry), 'utf8')
  for (const m of css.matchAll(/url\(([^)]+)\)/g)) {
    const path = m[1].replace(/["']/g, '')
    assert.ok(!path.startsWith('/') && !/^https?:/.test(path), `CSS asset must be local and relative: ${path}`)
    if (!path.startsWith('data:')) await stat(resolve(root, 'assets', path))
  }
}
const png = await readFile(resolve(root, 'social.png'))
assert.equal(png.readUInt32BE(16), 1200, 'Share card width')
assert.equal(png.readUInt32BE(20), 630, 'Share card height')

const excluded = new Set(['.git', '.github', '.imd', '.cache', '.agents', '.aws', '.codex', '.playwright-mcp', 'node_modules', '.npm', '.vite', 'coverage'])
let bytes = 0, files = 0, distBytes = 0
async function walk(path) {
  for (const item of await readdir(path, { withFileTypes: true })) {
    if (excluded.has(item.name) || /^\.env(?:\.|$)/.test(item.name) || item.name.endsWith('.tsbuildinfo')) continue
    const name = resolve(path, item.name)
    if (name === resolve('test/scratch')) continue
    assert.ok(!item.isSymbolicLink(), `Submission must not have symlinks: ${name}`)
    if (item.isDirectory()) await walk(name)
    else { const size = (await stat(name)).size; bytes += size; files++; if (name.startsWith(root + '/')) distBytes += size }
  }
}
await walk(resolve('.'))
assert.ok(bytes <= 8_388_608, `Submission exceeds 8 MiB: ${bytes}`)
assert.ok(distBytes <= 1_572_864, `Export exceeds its explicit 1.5 MiB path budget: ${distBytes}`)
console.log(JSON.stringify({ passed: true, references: references.length, files, bytes, distBytes, budget: 8_388_608 }, null, 2))
