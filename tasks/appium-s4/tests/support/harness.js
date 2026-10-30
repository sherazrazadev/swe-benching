'use strict';
// Shared helpers for the hidden suites. Everything here drives the product through its public
// entry points (the server factory and the server-configuration API); no product helper is used
// to compute an expected value.
const assert = require('node:assert');
const path = require('node:path');

const ROOT = process.env.PRODUCT_ROOT || '/workspace';
const LIB = path.join(ROOT, 'packages/base-driver/build/lib');
const OPT_IN = 'APPIUM_ENABLE_LEGACY_TEST_PAGES';

function product(rel) {
  return require(path.join(LIB, rel));
}

function expressApp() {
  return require(path.join(ROOT, 'node_modules/express'))();
}

function normalRoutes(app) {
  app.get('/session', (_req, res) => res.json({ok: true}));
}

async function startServer(opts = {}) {
  const {server} = product('express/server.js');
  const srv = await server({
    routeConfiguringFunction: opts.routes || normalRoutes,
    port: 0,
    ...(opts.serverOpts || {}),
  });
  return {srv, base: `http://127.0.0.1:${srv.address().port}`};
}

async function stopServer(srv) {
  await srv.close();
}

async function startConfiguredApp(opts = {}) {
  const {configureServer} = product('express/server.js');
  const app = expressApp();
  configureServer({
    app,
    addRoutes: opts.addRoutes || normalRoutes,
    ...(opts.config || {}),
  });
  const httpServer = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    httpServer.once('listening', resolve);
    httpServer.once('error', reject);
  });
  return {httpServer, base: `http://127.0.0.1:${httpServer.address().port}`};
}

async function stopConfiguredApp(httpServer) {
  await new Promise((resolve) => httpServer.close(resolve));
}

async function request(base, urlPath, init) {
  const res = await fetch(base + urlPath, init);
  const buffer = Buffer.from(await res.arrayBuffer());
  return {status: res.status, headers: res.headers, buffer, body: buffer.toString('utf8')};
}

async function withOptIn(value, fn) {
  const previous = Object.prototype.hasOwnProperty.call(process.env, OPT_IN)
    ? process.env[OPT_IN]
    : undefined;
  try {
    if (value === undefined) {
      delete process.env[OPT_IN];
    } else {
      process.env[OPT_IN] = value;
    }
    return await fn();
  } finally {
    if (previous === undefined) {
      delete process.env[OPT_IN];
    } else {
      process.env[OPT_IN] = previous;
    }
  }
}

function isClientError(res) {
  return res.status >= 400 && res.status < 500;
}

// The surface is closed: a client error and none of the material the surface would return.
function assertSurfaceClosed(res, markers = []) {
  assert.ok(
    isClientError(res),
    `expected a client error, got ${res.status} for a request the support must not answer`,
  );
  for (const marker of markers) {
    assert.ok(
      !res.body.includes(marker),
      `the response still returned built-in test material (${JSON.stringify(marker)})`,
    );
  }
}

function assertServed(res, markers = []) {
  assert.strictEqual(res.status, 200, `expected the opted-in page to be served, got ${res.status}`);
  for (const marker of markers) {
    assert.ok(res.body.includes(marker), `response did not contain ${JSON.stringify(marker)}`);
  }
}

module.exports = {
  ROOT,
  LIB,
  OPT_IN,
  product,
  expressApp,
  startServer,
  stopServer,
  startConfiguredApp,
  stopConfiguredApp,
  request,
  withOptIn,
  assertSurfaceClosed,
  assertServed,
};
