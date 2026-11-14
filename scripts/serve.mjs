// Development-only static file server for local preview and browser tests.
// The site itself is plain static files and needs no build step.
// It serves the site below BASE_PATH, by default /Isaac-Portfolio/ as GitHub Pages does, so a preview
// shows what the public site will, and links that only work from a server's root fail as they would
// there. Like GitHub Pages, it redirects the base path without its trailing slash to the site.
// SITE_ROOT serves another folder than this repository, such as the copy of the site about to be published.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(process.env.SITE_ROOT ?? fileURLToPath(new URL('..', import.meta.url)))
const port = Number(process.env.PORT) || 4173
const baseName = (process.env.BASE_PATH ?? '/Isaac-Portfolio/').replace(/^\/+|\/+$/g, '')
const basePath = baseName ? `/${baseName}/` : '/'

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
}

// Maps a request path below the base path to a file inside the site root, refusing anything outside it.
async function resolveFile(pathname) {
  if (!pathname.startsWith(basePath)) throw new Error('Outside base path')
  const filePath = join(root, decodeURIComponent(pathname.slice(basePath.length)))
  if (filePath !== root && !filePath.startsWith(root + sep)) throw new Error('Outside site root')
  const info = await stat(filePath)
  return info.isDirectory() ? join(filePath, 'index.html') : filePath
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost')
  if (basePath !== '/' && pathname === basePath.slice(0, -1)) {
    response.writeHead(301, { Location: basePath })
    response.end()
    return
  }
  try {
    const filePath = await resolveFile(pathname)
    const body = await readFile(filePath)
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
    })
    response.end(body)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(`<p>Not found. The portfolio is at <a href="${basePath}">${basePath}</a>.</p>`)
  }
}).listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}${basePath}`)
})
