import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const directory = resolve('dist')
const port = Number(process.env.PORT ?? 4173)
const contentTypes: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.rpl': 'application/octet-stream',
}
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
    let path = resolve(directory, `.${pathname}`)
    if (path !== directory && !path.startsWith(`${directory}${sep}`)) {
      response.writeHead(404).end()
      return
    }
    try {
      if (!(await stat(path)).isFile()) throw new Error('Not a file')
    } catch {
      if (extname(pathname)) {
        response.writeHead(404).end()
        return
      }
      path = resolve(directory, 'index.html')
    }
    const bytes = await readFile(path)
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(path)] ?? 'application/octet-stream',
    })
    response.end(bytes)
  } catch {
    response.writeHead(400).end()
  }
}).listen(port, '127.0.0.1', () => console.log(`Static build: http://127.0.0.1:${port}`))
