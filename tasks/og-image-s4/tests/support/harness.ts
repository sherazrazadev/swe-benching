import type { AddressInfo } from 'node:net'
import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The verifier restores the submission at /workspace. S4_WORKSPACE exists only so the builder
// can exercise the same harness locally; the grading image never sets it.
export const WORKSPACE = process.env.S4_WORKSPACE || '/workspace'
export const HIDDEN = join(WORKSPACE, '.htests')

export function fixtureDir(name: 'node' | 'dev' | 'vercel' | 'netlify' | 'cloudflare'): string {
  return join(HIDDEN, `fx-${name}`)
}

/** base64url used by the product for complex URL params (no padding, + -> -, / -> ~). */
export function encodeParam(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '~')
}

/** The image entry point. `fonts` is a complex param carried in the path. */
export function ogPath(component: string, fonts: unknown, ext: 'png' | 'json' = 'png'): string {
  return `/_og/d/c_${component},fonts_${encodeParam(fonts)}.${ext}`
}

export function defaultFontsComponent(): string {
  return 'S4Card.satori'
}

/** A real TrueType/OpenType face, used both as a same-origin asset and as inline data. */
export function fontBytes(name: 'node' | 'dev' | 'vercel' | 'netlify' | 'cloudflare'): Buffer {
  return readFileSync(join(fixtureDir(name), 'public', 'OPTIEinstein-Black.otf'))
}

export function dataFontUri(name: 'node' | 'dev' | 'vercel' | 'netlify' | 'cloudflare'): string {
  return `data:font/otf;base64,${fontBytes(name).toString('base64')}`
}

export async function freePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const srv = createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as AddressInfo).port
      srv.close(() => resolve(port))
    })
  })
}

export interface Canary {
  url: string
  port: number
  hits: () => number
  reset: () => void
  stop: () => Promise<void>
}

/**
 * Loopback service standing in for an internal host. It answers 2xx with non-font bytes, so a
 * fetch that reaches it is unambiguous. The test only ever reads the hit counter.
 */
export async function startCanary(): Promise<Canary> {
  let hits = 0
  const server = createServer((_req, res) => {
    hits++
    res.writeHead(200, { 'content-type': 'application/octet-stream' })
    res.end(Buffer.from('CANARY-BYTES'))
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const port = (server.address() as AddressInfo).port
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    hits: () => hits,
    reset: () => { hits = 0 },
    stop: () => new Promise<void>((resolve) => { server.close(() => resolve()) }),
  }
}

async function waitFor(fn: () => Promise<boolean>, timeoutMs: number, child?: ChildProcess, log?: () => string): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null)
      throw new Error(`process exited (${child.exitCode}) before ready:\n${log ? log() : ''}`)
    try {
      if (await fn())
        return
    }
    catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, 400))
  }
  throw new Error(`process did not become ready in ${timeoutMs}ms:\n${log ? log() : ''}`)
}

function collect(child: ChildProcess): () => string {
  let out = ''
  child.stdout?.on('data', (d) => { out += String(d) })
  child.stderr?.on('data', (d) => { out += String(d) })
  return () => out.slice(-6000)
}

export interface RunningApp {
  base: string
  stop: () => void
}

/** Built node-server output, started as a real HTTP server (large header limit for inline fonts). */
export async function startNodeServer(): Promise<RunningApp> {
  const dir = fixtureDir('node')
  const port = await freePort()
  const child = spawn(process.execPath, ['--max-http-header-size=1048576', join(dir, '.output/server/index.mjs')], {
    cwd: dir,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', NUXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const log = collect(child)
  const base = `http://127.0.0.1:${port}`
  await waitFor(async () => (await fetch(`${base}/`, { signal: AbortSignal.timeout(2000) })).status > 0, 120_000, child, log)
  return { base, stop: () => { try { child.kill('SIGKILL') } catch {} } }
}

/** `nuxt dev` server (the dev/preview font path). First request compiles the server. */
export async function startDevServer(): Promise<RunningApp> {
  const dir = fixtureDir('dev')
  const port = await freePort()
  const nuxtBin = join(WORKSPACE, 'node_modules/nuxt/bin/nuxt.mjs')
  const child = spawn(process.execPath, [nuxtBin, 'dev', dir, '--port', String(port), '--host', '127.0.0.1'], {
    cwd: WORKSPACE,
    env: {
      ...process.env,
      NUXT_IGNORE_LOCK: '1',
      NUXT_TELEMETRY_DISABLED: '1',
      NODE_OPTIONS: '--max-http-header-size=1048576',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const log = collect(child)
  const base = `http://127.0.0.1:${port}`
  await waitFor(async () => {
    const res = await fetch(`${base}/_og/d/c_S4Card.satori.png`, { signal: AbortSignal.timeout(60_000) })
    return res.status > 0
  }, 300_000, child, log)
  return { base, stop: () => { try { child.kill('SIGKILL') } catch {} } }
}

/**
 * Start a built platform bundle (Vercel function, Netlify function, or Cloudflare worker) in a
 * plain Node process and expose its own entry contract over HTTP.
 */
export async function startPlatformServer(kind: 'vercel' | 'netlify' | 'cloudflare'): Promise<RunningApp> {
  const port = await freePort()
  const script = join(HIDDEN, 'support', 'platform-server.mjs')
  const child = spawn(process.execPath, ['--max-http-header-size=1048576', script, '--kind', kind, '--dir', fixtureDir(kind), '--port', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const log = collect(child)
  const base = `http://127.0.0.1:${port}`
  await waitFor(async () => (await fetch(`${base}/`, { signal: AbortSignal.timeout(2000) })).status > 0, 120_000, child, log)
  return { base, stop: () => { try { child.kill('SIGKILL') } catch {} } }
}

export interface DebugFont {
  family?: string
  name?: string
  weight?: number
  size?: number
}

/** Read the renderer's loaded-font list out of a debug JSON response body. */
export function loadedFonts(json: string): DebugFont[] {
  try {
    const parsed = JSON.parse(json)
    return parsed?.fontDebug?.fonts || []
  }
  catch {
    return []
  }
}
