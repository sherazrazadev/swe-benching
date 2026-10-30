// Minimal harness that builds a fixture application against the submitted
// Next.js sources and serves it over HTTP. It is imported by the case runner.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

export const WORKSPACE = process.env.WORKSPACE || '/workspace'
const NEXT_PKG = path.join(WORKSPACE, 'packages', 'next')
const NEXT_BIN = path.join(NEXT_PKG, 'dist', 'bin', 'next')
const RUN_ROOT = path.join(WORKSPACE, '.htests', 'run')

export function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

function link(target, linkPath) {
  const real = fs.realpathSync(target)
  try {
    fs.symlinkSync(real, linkPath, 'dir')
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
  }
}

function copyDir(src, dest) {
  fs.cpSync(src, dest, { recursive: true, dereference: false })
}

// Creates the app directory for a fixture. `fixture` is the name of a directory
// under support/fixtures; `overlay` is copied on top of it when present.
export function materializeFixture(fixture, overlay, label) {
  const source = path.join(HERE, 'fixtures', fixture)
  const appDir = path.join(RUN_ROOT, `${label}-${process.pid}-${Date.now()}`)
  fs.rmSync(appDir, { recursive: true, force: true })
  fs.mkdirSync(appDir, { recursive: true })
  copyDir(source, appDir)
  if (overlay) copyDir(path.join(HERE, 'fixtures', overlay), appDir)

  const modules = path.join(appDir, 'node_modules')
  fs.mkdirSync(modules, { recursive: true })
  link(NEXT_PKG, path.join(modules, 'next'))
  for (const name of ['react', 'react-dom']) {
    link(path.join(WORKSPACE, 'node_modules', name), path.join(modules, name))
  }
  return appDir
}

function run(command, args, options, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    })
    let output = ''
    child.stdout.on('data', (chunk) => (output += chunk))
    child.stderr.on('data', (chunk) => (output += chunk))
    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid, 'SIGKILL')
      } catch {}
      resolve({ code: 124, output })
    }, timeoutMs)
    child.on('error', (error) => {
      clearTimeout(timer)
      resolve({ code: 1, output: String(error) })
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      resolve({ code: code == null ? 1 : code, output })
    })
  })
}

export async function buildFixture(appDir) {
  fs.rmSync(path.join(appDir, '.next'), { recursive: true, force: true })
  fs.rmSync(path.join(appDir, 'cache-operations.jsonl'), { force: true })
  const result = await run(
    process.execPath,
    [NEXT_BIN, 'build', '--webpack'],
    {
      cwd: appDir,
      env: {
        ...process.env,
        HOME: process.env.HOME || '/home/agent',
        NEXT_TELEMETRY_DISABLED: '1',
        NODE_ENV: 'production',
      },
    },
    600000
  )
  if (result.code !== 0) {
    throw new Error(`fixture build failed (${result.code}):\n${result.output.slice(-4000)}`)
  }
}

async function request(port, requestPath, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${requestPath}`, {
    method: options.method || 'GET',
    headers: options.headers || {},
    redirect: 'manual',
  })
  const body = options.method === 'HEAD' ? '' : await response.text()
  const headers = {}
  response.headers.forEach((value, name) => (headers[name] = value))
  return { status: response.status, headers, body }
}

export class AppServer {
  constructor(appDir) {
    this.appDir = appDir
    this.child = undefined
    this.port = undefined
  }

  async start() {
    this.port = await freePort()
    this.child = spawn(
      process.execPath,
      [NEXT_BIN, 'start', '-H', '127.0.0.1', '-p', String(this.port)],
      {
        cwd: this.appDir,
        env: {
          ...process.env,
          HOME: process.env.HOME || '/home/agent',
          NEXT_TELEMETRY_DISABLED: '1',
          NODE_ENV: 'production',
          SELF_URL: `http://127.0.0.1:${this.port}`,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
      }
    )
    this.output = ''
    this.child.stdout.on('data', (chunk) => (this.output += chunk))
    this.child.stderr.on('data', (chunk) => (this.output += chunk))
    const deadline = Date.now() + 60000
    while (Date.now() < deadline) {
      try {
        const response = await request(this.port, '/')
        if (response.status < 500) return this
      } catch {}
      await sleep(200)
    }
    throw new Error(`server did not become ready:\n${this.output.slice(-2000)}`)
  }

  async stop() {
    if (!this.child) return
    try {
      process.kill(-this.child.pid, 'SIGKILL')
    } catch {
      try {
        this.child.kill('SIGKILL')
      } catch {}
    }
    this.child = undefined
    // Give the OS a moment to release the port.
    await sleep(150)
  }

  get(pathname, options) {
    return request(this.port, pathname, options)
  }

  head(pathname, options) {
    return request(this.port, pathname, { ...options, method: 'HEAD' })
  }
}

// Decodes the route marker rendered by the fixtures, from HTML or JSON.
export function routeState(response) {
  const type = response.headers['content-type'] || ''
  if (type.includes('application/json')) {
    return JSON.parse(response.body)
  }
  const match = /id="route-state">([\s\S]*?)<\/div>/.exec(response.body)
  assert(match, `response has no route state marker (status ${response.status})`)
  const decoded = match[1]
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
  return JSON.parse(decoded)
}

export function buildId(appDir) {
  return fs.readFileSync(path.join(appDir, '.next', 'BUILD_ID'), 'utf8').trim()
}

export async function waitFor(description, predicate, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs
  let last
  while (Date.now() < deadline) {
    last = await predicate()
    if (last) return last
    await sleep(300)
  }
  throw new Error(`timed out waiting for ${description}`)
}
