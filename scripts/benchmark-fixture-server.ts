import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve } from 'node:path'

const demoPath = resolve(process.env.DEMO_PATH ?? 'fixtures/local/faze-vs-vitality-m2-dust2.dem')
const { size } = await stat(demoPath)
const server = createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:4176')
  response.setHeader('Timing-Allow-Origin', 'http://127.0.0.1:4176')
  response.setHeader('Cache-Control', 'no-store')
  if (request.url === '/health') {
    response.end('ready')
    return
  }
  if (request.url !== '/demo.dem') {
    response.writeHead(404).end()
    return
  }
  response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': size })
  const stream = createReadStream(demoPath)
  stream.on('error', () => response.destroy())
  response.on('close', () => stream.destroy())
  stream.pipe(response)
})
server.listen(4177, '127.0.0.1')
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.closeAllConnections()
    server.close()
  })
}
