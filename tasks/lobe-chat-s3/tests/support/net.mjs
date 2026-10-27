import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

export const MARKER = 'INTERNAL_SECRET_7f3a91';
export const PUBLIC_BODY = 'PUBLIC_ASSET_BODY';
export const PUBLIC_ZIP = 'PUBLIC_ZIP_BYTES';

const strip = (h) => String(h || '').replace(/^\[/, '').replace(/\]$/, '').toLowerCase();

export function isNonPublicAddress(address) {
  if (!address) return true;
  const bare = strip(address);
  const family = net.isIP(bare);
  if (family === 4) {
    const parts = bare.split('.').map(Number);
    const [a, b, c] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 0 && c === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a === 198 && b === 51 && c === 100) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    if (a >= 224) return true;
    return false;
  }
  if (family === 6) {
    const lower = bare;
    if (lower === '::' || lower === '::1') return true;
    if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
    if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;
    if (/^ff[0-9a-f]{2}:/.test(lower)) return true;
    if (/^2001:0*db8:/.test(lower)) return true;
    const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(lower);
    if (mapped) return isNonPublicAddress(mapped[1]);
    const hexMapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1], 16), lo = parseInt(hexMapped[2], 16);
      return isNonPublicAddress([hi >> 8, hi & 255, lo >> 8, lo & 255].join('.'));
    }
    return false;
  }
  return true;
}

function makeTable(path) {
  const raw = JSON.parse(fs.readFileSync(path, 'utf8'));
  const map = new Map();
  for (const [host, address] of Object.entries(raw.hosts || {})) map.set(strip(host), address);
  for (const [host, record] of Object.entries(raw.dns || {})) map.set(strip(host), record.AAAA || record.A);
  return map;
}

export async function installNetwork({ tablePath, virtualHost = '127.0.0.1' }) {
  const table = makeTable(tablePath);
  const contacts = [];
  let site = null;

  const addressOf = (host) => {
    const key = strip(host);
    if (net.isIP(key)) return key;
    return table.get(key) || null;
  };

  const record = (host, url, via) => {
    const address = addressOf(host);
    const internal = address !== null && isNonPublicAddress(address);
    contacts.push({ address, host: strip(host), internal, path: url.pathname + url.search, port: url.port, via });
    return { address, internal };
  };

  const defaultResponse = (internal) =>
    internal
      ? { status: 200, headers: { 'content-type': 'text/plain' }, body: MARKER }
      : { status: 200, headers: { 'content-type': 'text/plain' }, body: PUBLIC_BODY };

  const resolveRecord = (host, url) => {
    const { address, internal } = record(host, url, 'server');
    const custom = site ? site({ host: strip(host), url, address, internal }) : null;
    return custom || defaultResponse(internal);
  };

  // virtual origin server used by the patched clients
  const virtual = http.createServer((req, res) => {
    let url;
    try {
      url = new URL(req.url || '/', req.headers['x-virtual-target'] || 'http://invalid.local');
    } catch {
      res.writeHead(400); res.end(); return;
    }
    const response = resolveRecord(url.hostname, url);
    res.writeHead(response.status || 200, response.headers || {});
    res.end(response.body === undefined ? '' : response.body);
  });
  await new Promise((resolve) => virtual.listen(0, virtualHost, resolve));
  const vport = virtual.address().port;

  // global fetch stand-in
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    // A caller-supplied dispatcher or agent owns the connection decision; let the real stack
    // exercise it rather than serving the destination from the stand-in.
    if (init && (init.dispatcher || init.agent)) return realFetch(input, init);
    let current = new URL(typeof input === 'string' ? input : String(input && input.url ? input.url : input));
    const mode = init.redirect === undefined ? 'follow' : init.redirect;
    for (let hop = 0; hop < 20; hop += 1) {
      const response = resolveRecord(current.hostname, current);
      const location = response.headers && (response.headers.location || response.headers.Location);
      if (mode === 'error' && response.status >= 300 && response.status < 400) throw new TypeError('unexpected redirect');
      if (mode === 'follow' && response.status >= 300 && response.status < 400 && location) {
        current = new URL(location, current);
        continue;
      }
      return new Response(response.body === undefined ? '' : response.body, {
        headers: response.headers || {}, status: response.status || 200,
      });
    }
    throw new TypeError('redirect count exceeded');
  };

  // node:http / node:https clients
  const origHttpRequest = http.request.bind(http);
  const origHttpsRequest = https.request.bind(https);

  const isCustomAgent = (agent) => Boolean(agent) && agent !== http.globalAgent && agent !== https.globalAgent;

  function normalizeArgs(moduleIsHttps, input, options, cb) {
    let callback = cb;
    if (typeof input === 'string' || input instanceof URL) {
      let opts;
      if (typeof options === 'function') { callback = options; opts = {}; }
      else opts = { ...(options || {}) };
      const url = new URL(input.toString());
      const target = {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: opts.path || (url.pathname + url.search),
      };
      return { opts, target, cb: callback };
    }
    const opts = { ...input };
    if (typeof options === 'function') callback = options;
    const protocol = opts.protocol || (moduleIsHttps ? 'https:' : 'http:');
    return {
      opts,
      target: { protocol, hostname: opts.hostname || opts.host || 'localhost', port: opts.port || '', path: opts.path || '/' },
      cb: callback,
    };
  }

  function patched(moduleIsHttps, realRequest) {
    return function patchedRequest(input, options, cb) {
      const { opts, target, cb: callback } = normalizeArgs(moduleIsHttps, input, options, cb);
      if (isCustomAgent(opts.agent) || typeof opts.lookup === 'function') {
        // A caller-supplied connection agent or resolver keeps control of the socket; the
        // request goes to the real stack so a connection-time check is exercised as written.
        if (typeof input === 'string' || input instanceof URL) {
          if (typeof options === 'function') return realRequest(input, options);
          if (callback) return realRequest(input, options, callback);
          return realRequest(input, options);
        }
        if (callback) return realRequest(opts, callback);
        return realRequest(opts);
      }
      const port = target.port ? `:${target.port}` : '';
      const headers = { ...(opts.headers || {}), 'x-virtual-target': `${target.protocol}//${strip(target.hostname)}${port}` };
      const rewritten = { ...opts, protocol: 'http:', host: virtualHost, hostname: virtualHost, port: vport, path: target.path, headers };
      delete rewritten.agent;
      return origHttpRequest(rewritten, callback);
    };
  }
  const realHttpsRequest = origHttpsRequest;
  http.request = patched(false, origHttpRequest);
  https.request = patched(true, realHttpsRequest);
  http.get = function patchedGet(...args) { const r = http.request(...args); r.end(); return r; };
  https.get = function patchedGet(...args) { const r = https.request(...args); r.end(); return r; };

  return {
    contacts,
    port: vport,
    addressOf,
    setSite(fn) { site = fn; },
    reset() { contacts.length = 0; },
    internalContacted() { return contacts.some((c) => c.internal); },
    publicContacted(host) { return contacts.some((c) => c.host === strip(host) && !c.internal); },
    contacted(host) { return contacts.filter((c) => c.host === strip(host)); },
    restore() { globalThis.fetch = realFetch; virtual.close(); },
  };
}
