// Runs a built platform handler in a plain Node process and exposes it over real HTTP.
//
// The built bundles are Nitro output; importing them inside the test runner's module graph
// confuses the runner's resolver, so the handler runs here instead. The tests then talk HTTP to
// the platform's own entry contract (Vercel Node function, Netlify request handler, Cloudflare
// worker fetch handler), which is what the platform does in production.
import http from 'node:http'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}

const kind = arg('kind')
const dir = arg('dir')
const port = Number(arg('port'))

function fail(res, err) {
  res.statusCode = 500
  res.end(`handler error: ${err && err.message ? err.message : 'unknown'}`)
}

if (kind === 'vercel') {
  // Vercel Node launcher: the exported handler is a Node request listener.
  const mod = await import(pathToFileURL(join(dir, '.vercel/output/functions/__fallback.func/index.mjs')).href)
  const listener = (req, res) => {
    Promise.resolve(mod.default(req, res)).catch(err => fail(res, err))
  }
  http.createServer(listener).listen(port, '127.0.0.1', () => process.stdout.write(`READY ${port}\n`))
}
else {
  const ctx = { waitUntil() {}, passThroughOnException() {} }
  let handler
  if (kind === 'netlify') {
    // Netlify v2 function: export default (request, context) => Response.
    const mod = await import(pathToFileURL(join(dir, '.netlify/functions-internal/server/main.mjs')).href)
    handler = request => mod.default(request, {})
  }
  else if (kind === 'cloudflare') {
    // Cloudflare worker: export default { fetch(request, env, ctx) => Response }.
    const mod = await import(pathToFileURL(join(dir, '.output/server/index.mjs')).href)
    const env = { ASSETS: { fetch: async () => new Response('not found', { status: 404 }) } }
    handler = request => mod.default.fetch(request, env, ctx)
  }
  else {
    process.stderr.write(`unknown kind ${kind}\n`)
    process.exit(2)
  }

  const listener = async (req, res) => {
    try {
      const request = new Request(`https://og-s4.example${req.url}`, { method: req.method || 'GET' })
      const response = await handler(request)
      const body = Buffer.from(await response.arrayBuffer())
      res.writeHead(response.status, { 'content-type': response.headers.get('content-type') || 'application/octet-stream' })
      res.end(body)
    }
    catch (err) {
      fail(res, err)
    }
  }
  http.createServer(listener).listen(port, '127.0.0.1', () => process.stdout.write(`READY ${port}\n`))
}
