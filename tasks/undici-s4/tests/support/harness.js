'use strict'

/*
 * Shared harness for the hidden suites. It loads the product from the tree under
 * test and exposes small helpers for driving it over a loopback origin.
 */

const { createServer } = require('node:http')
const { once } = require('node:events')
const { setTimeout: sleep } = require('node:timers/promises')
const path = require('node:path')

const APP_DIR = process.env.APP_DIR || '/workspace'
const undici = require(path.join(APP_DIR, 'index.js'))

async function startServer (handler) {
  const server = createServer({ joinDuplicateHeaders: true }, handler)
  server.listen(0)
  await once(server, 'listening')
  return {
    server,
    url: `http://localhost:${server.address().port}`,
    close: () => new Promise(resolve => server.close(resolve))
  }
}

function req (p = '/', extra = {}) {
  return { origin: 'localhost', method: 'GET', path: p, ...extra }
}

/** Read the headers the cache store currently holds for a cached response. */
function storedHeaders (store, p = '/', extra = {}) {
  const value = store.get({ origin: 'localhost', method: 'GET', path: p, headers: {}, ...extra })
  return value && value.headers ? value.headers : undefined
}

function hasSetCookie (headers) {
  return headers != null && Object.hasOwn(headers, 'set-cookie')
}

async function readBody (res) {
  return res.body.text()
}

module.exports = {
  undici,
  startServer,
  req,
  storedHeaders,
  hasSetCookie,
  readBody,
  sleep
}
