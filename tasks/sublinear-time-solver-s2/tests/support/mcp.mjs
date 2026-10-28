// Shared MCP driver for the hidden suites.
// Spawns the product's real MCP servers over stdio and speaks JSON-RPC to them.
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const WORKSPACE = process.env.WORKSPACE_DIR || '/workspace';

// A scratch root with a private home, a working directory and a clearly
// "outside" area. Everything a test asserts about is under this root.
export function sandbox(tag = 'cwe') {
  const root = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), `${tag}-`));
  const home = path.join(root, 'home');
  const work = path.join(root, 'work');
  const outside = path.join(root, 'outside');
  for (const d of [home, work, outside]) fs.mkdirSync(d, { recursive: true });
  return { root, home, work, outside };
}

export function allFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = path.join(cur, e.name);
      let st;
      try { st = fs.lstatSync(p); } catch { continue; }
      if (st.isDirectory()) stack.push(p);
      else out.push({ path: p, stat: st });
    }
  }
  return out;
}

// Find a regular file whose basename equals `name` anywhere under root.
export function findByName(root, name) {
  return allFiles(root).filter((f) => f.stat.isFile() && path.basename(f.path) === name).map((f) => f.path);
}

// Find regular files whose contents include `marker`.
export function findByContent(root, marker) {
  return allFiles(root)
    .filter((f) => f.stat.isFile())
    .filter((f) => {
      try { return fs.readFileSync(f.path, 'utf8').includes(marker); } catch { return false; }
    })
    .map((f) => f.path);
}

export function resultText(result) {
  if (!result || !Array.isArray(result.content)) return '';
  return result.content.map((c) => (typeof c.text === 'string' ? c.text : '')).join('\n');
}

class Client {
  constructor(kind, box, extraEnv) {
    this.box = box;
    this.nextId = 1;
    this.pending = new Map();
    this.stderr = '';
    this.closed = false;
    const script = kind === 'ce'
      ? path.join(WORKSPACE, '.htests', 'support', 'ce-server.mjs')
      : path.join(WORKSPACE, 'dist', 'mcp', 'server.js');
    this.child = spawn(process.execPath, [script], {
      cwd: box.work,
      env: { ...process.env, HOME: box.home, TMPDIR: box.root, WORKSPACE_DIR: WORKSPACE, ...(extraEnv || {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child.stderr.on('data', (d) => { this.stderr += String(d); });
    this.child.stdout.on('data', (d) => { this.rawOut = (this.rawOut || '') + String(d); });
    this.child.on('exit', (code, signal) => {
      this.closed = true;
      this.exit = { code, signal };
      for (const [, resolve] of this.pending) resolve({ closed: true, exit: this.exit });
      this.pending.clear();
    });
    this.rl = readline.createInterface({ input: this.child.stdout });
    this.rl.on('line', (line) => {
      let msg;
      try { msg = JSON.parse(line); } catch { return; }
      if (msg && msg.id != null && this.pending.has(msg.id)) {
        const resolve = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        resolve(msg);
      }
    });
  }

  request(method, params, timeoutMs = 20000) {
    const id = this.nextId++;
    const msg = { jsonrpc: '2.0', id, method };
    if (params !== undefined) msg.params = params;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); resolve({ timeout: true, method }); }
      }, timeoutMs);
      this.pending.set(id, (v) => { clearTimeout(timer); resolve(v); });
      try { this.child.stdin.write(JSON.stringify(msg) + '\n'); }
      catch { clearTimeout(timer); resolve({ closed: true }); }
    });
  }

  notify(method, params) {
    const msg = { jsonrpc: '2.0', method };
    if (params !== undefined) msg.params = params;
    try { this.child.stdin.write(JSON.stringify(msg) + '\n'); } catch { /* child gone */ }
  }

  async init() {
    const r = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'cwe-bench', version: '1.0' },
    });
    if (r.closed || r.timeout || r.error || !r.result) {
      throw new Error(`MCP server did not initialize: ${JSON.stringify(r).slice(0, 400)}\n${this.stderr.slice(-800)}`);
    }
    this.notify('notifications/initialized');
  }

  // A tools/call whose outcome is classified. `refused` is true only when the
  // server answered with a clean client error (JSON-RPC error or isError=true)
  // and the process is still running. A crash or a timeout is not a refusal.
  async call(name, args) {
    const r = await this.request('tools/call', { name, arguments: args });
    if (r.closed || r.timeout) {
      return { crashed: true, refused: false, timeout: !!r.timeout, text: '', result: null, error: r.error || null };
    }
    if (r.error) {
      return { crashed: false, refused: true, timeout: false, error: r.error, result: null, text: '' };
    }
    const result = r.result || {};
    return { crashed: false, refused: result.isError === true, timeout: false, error: null, result,
      text: resultText(result) };
  }

  async alive() {
    const r = await this.request('tools/list', {});
    return !r.closed && !r.timeout && !r.error && !!r.result;
  }

  async close() {
    try { this.rl.close(); } catch { /* ignore */ }
    try { this.child.kill('SIGKILL'); } catch { /* ignore */ }
    await new Promise((resolve) => {
      if (this.closed) return resolve();
      const t = setTimeout(resolve, 2000);
      this.child.once('exit', () => { clearTimeout(t); resolve(); });
    });
  }
}

// kind: 'ce' (consciousness explorer MCP) or 'main' (sublinear solver MCP).
export async function startServer(kind, box, extraEnv) {
  const c = new Client(kind, box, extraEnv);
  await c.init();
  return c;
}

export async function withServer(kind, box, fn) {
  const c = await startServer(kind, box);
  try { return await fn(c); } finally { await c.close(); }
}
