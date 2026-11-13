// Development-only static file server for local preview and browser tests.
// The site itself is plain static files and needs no build step.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const port = Number(process.env.PORT) || 4173

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
}

// Maps a request path to a file inside the site root, refusing anything outside it.
async function resolveFile(requestUrl) {
  const { pathname } = new URL(requestUrl, 'http://localhost')
  const filePath = join(root, decodeURIComponent(pathname))
  if (filePath !== root && !filePath.startsWith(root + sep)) throw new Error('Outside site root')
  const info = await stat(filePath)
  return info.isDirectory() ? join(filePath, 'index.html') : filePath
}

createServer(async (request, response) => {
  try {
    const filePath = await resolveFile(request.url ?? '/')
    const body = await readFile(filePath)
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
    })
    response.end(body)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  }
}).listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}`)
})
