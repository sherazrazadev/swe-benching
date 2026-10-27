#!/usr/bin/env node
/*
 * Hidden-suite runner. Usage:
 *     node --import tsx runner.mjs <security|functional> <output.xml>
 *
 * Loads the product's real App Router handlers from the submitted /workspace, serves every
 * outbound destination from a hermetic in-process origin (no sockets leave the container;
 * loopback listeners stand in for any client that bypasses the stand-in), runs the cases for
 * the requested group, and writes a JUnit XML file the scorer reads. Expected values are
 * literals in the case tables; no product code computes them.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { MARKER, PUBLIC_BODY, PUBLIC_ZIP, installNetwork } from './net.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE = process.env.WORKSPACE || '/workspace';
const TABLE = process.env.TABLE || path.join(HERE, 'table.json');
const DNS_LOG = process.env.DNS_LOG || '';
const GROUP = process.argv[2];
const OUT = process.argv[3];

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function writeXml(results) {
  const failures = results.filter((result) => !result.ok).length;
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="${esc(GROUP)}" tests="${results.length}" failures="${failures}" errors="0" skipped="0">`,
  ];
  for (const result of results) {
    if (result.ok) {
      lines.push(`  <testcase classname="${esc(GROUP)}" name="${esc(result.name)}"/>`);
    } else {
      lines.push(`  <testcase classname="${esc(GROUP)}" name="${esc(result.name)}">`);
      lines.push(`    <failure message="${esc(result.message).slice(0, 500)}">${esc(result.message).slice(0, 4000)}</failure>`);
      lines.push('  </testcase>');
    }
  }
  lines.push('</testsuite>', '');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lines.join('\n'));
}

function walk(dir, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name === 'route.ts') out.push(full);
  }
  return out;
}

function findRoute(relative, pattern) {
  const app = path.join(WORKSPACE, 'src', 'app');
  const files = walk(app);
  return (
    files.find((file) => file.endsWith(relative)) ||
    files.find((file) => pattern.test(file.slice(app.length))) ||
    null
  );
}

function listen(server, host) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, host, () => resolve(server.address().port));
  });
}

function readDnsLines() {
  if (!DNS_LOG) return [];
  try {
    return fs.readFileSync(DNS_LOG, 'utf8').split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

async function invoke(handler, request) {
  try {
    const response = await handler(request);
    let text = '';
    try { text = await response.text(); } catch { /* a streaming body may be consumed */ }
    return { ok: true, status: response.status, text, headers: response.headers };
  } catch (error) {
    return { ok: false, error: error && (error.stack || error.message) };
  }
}

const json = (body) => ({
  status: 200,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

async function main() {
  const net = await installNetwork({ tablePath: TABLE });

  // A real listener on each loopback family: any submitted client that bypasses the
  // stand-in still reaches a server that records the contact and answers with the marker.
  const hits = [];
  const onRequest = (req, res) => {
    hits.push({ path: req.url });
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end(MARKER);
  };
  const v4 = http.createServer(onRequest);
  const ports = { v4: await listen(v4, '127.0.0.1'), v6: 0 };
  let v6 = null;
  try {
    v6 = http.createServer(onRequest);
    ports.v6 = await listen(v6, '::1');
  } catch {
    v6 = null;
  }

  net.setSite(({ host, url }) => {
    const route = url.pathname;
    if (host === 'assets.lobe.test') {
      if (route === '/redir') return { status: 302, headers: { location: `http://intranet.lobe.test:${ports.v4}/secret` } };
      if (route === '/manifest.json') return json({ identifier: 'demo', openapi: `http://intranet.lobe.test:${ports.v4}/spec` });
      if (route === '/legit-manifest.json') return json({ identifier: 'demo', openapi: 'https://cdn.lobe.test/spec.json' });
      if (route === '/bundle.zip') return { status: 200, headers: { 'content-type': 'application/zip' }, body: PUBLIC_ZIP };
      if (route === '/demo.png') return { status: 200, headers: { 'content-type': 'image/png' }, body: 'PNGDATA' };
      if (route === '/asset') return { status: 200, headers: { 'content-type': 'text/unusual', 'x-test-header': 'kept' }, body: PUBLIC_BODY };
    }
    if (host === 'cdn.lobe.test' && route === '/spec.json') return json({ openapi: '3.0.0' });
    if (host === 'api.imgur.com' && route === '/3/upload') return json({ success: true, data: { link: 'https://i.imgur.com/demo.png' } });
    return null;
  });

  let dnsMark = readDnsLines().length;

  const ctx = {
    MARKER,
    PUBLIC_BODY,
    PUBLIC_ZIP,
    ports,
    net,
    hits,
    reset() { net.reset(); hits.length = 0; },
    mark() { dnsMark = readDnsLines().length; },
    dnsSaw(host) {
      return readDnsLines().slice(dnsMark).some((line) => line.startsWith(`${host} `));
    },
    internalTouched() { return net.internalContacted() || hits.length > 0; },
    attempted(host) { return net.publicContacted(host) || ctx.dnsSaw(host); },
    clientError(result) { return result.ok && result.status >= 400 && result.status < 500; },
    async proxy(target, { headers = {}, query = '' } = {}) {
      const address = `http://localhost/api/proxy${query ? `?${query}` : ''}`;
      return invoke(ctx.proxyHandler, new Request(address, { method: 'POST', body: target, headers }));
    },
    async image(payload) {
      return invoke(ctx.imageHandler, new Request('http://localhost/api/files/image', {
        body: JSON.stringify(payload),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }));
    },
  };

  let loadError = null;
  try {
    const proxyFile = findRoute(path.join('api', 'proxy', 'route.ts'), /(^|\/)proxy\/route\.ts$/);
    const imageFile = findRoute(path.join('api', 'files', 'image', 'route.ts'), /(^|\/)files\/image\/route\.ts$/);
    if (!proxyFile) throw new Error('the proxy route was not found under src/app');
    if (!imageFile) throw new Error('the image route was not found under src/app');
    ctx.proxyHandler = (await import(pathToFileURL(proxyFile).href)).POST;
    ctx.imageHandler = (await import(pathToFileURL(imageFile).href)).POST;
  } catch (error) {
    loadError = error;
  }

  let cases = [];
  try {
    const suite = (await import(pathToFileURL(path.join(HERE, '..', GROUP, 'cases.mjs')).href)).default;
    cases = suite(ctx);
  } catch (error) {
    cases = [{ name: `suite ${GROUP} loads`, run: () => { throw error; } }];
  }

  const results = [];
  for (const entry of cases) {
    ctx.reset();
    ctx.mark();
    if (loadError) {
      results.push({ name: entry.name, ok: false, message: `the product route could not be loaded: ${loadError.message}` });
      continue;
    }
    try {
      await entry.run();
      results.push({ name: entry.name, ok: true });
    } catch (error) {
      results.push({ name: entry.name, ok: false, message: (error && (error.stack || error.message)) || String(error) });
    }
  }

  writeXml(results);
  net.restore();
  v4.close();
  if (v6) v6.close();
}

main().catch((error) => {
  try {
    writeXml([{ name: 'runner', ok: false, message: String((error && (error.stack || error.message)) || error) }]);
  } catch {
    process.exitCode = 1;
  }
});
