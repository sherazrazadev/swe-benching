'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { undici, startServer, req, readBody } = require('../support/harness')

test('a network-forbidden request is still served from a fresh stored response', async () => {
  let hits = 0
  const origin = await startServer((request, response) => {
    hits++
    response.setHeader('cache-control', 'public, max-age=300')
    response.end(`payload-${hits}`)
  })

  const client = new undici.Client(origin.url).compose(undici.interceptors.cache())

  try {
    assert.strictEqual(await readBody(await client.request(req('/offline-hit'))), 'payload-1')
    const second = await client.request(req('/offline-hit', {
      headers: { 'cache-control': 'only-if-cached' }
    }))
    assert.strictEqual(await readBody(second), 'payload-1')
    assert.strictEqual(hits, 1)
  } finally {
    await client.close()
    await origin.close()
  }
})

test('a network-forbidden request for an uncached response is refused without reaching the origin', async () => {
  let hits = 0
  const origin = await startServer((request, response) => {
    hits++
    response.setHeader('cache-control', 'public, max-age=300')
    response.end('payload')
  })

  const client = new undici.Client(origin.url).compose(undici.interceptors.cache())

  try {
    const res = await client.request(req('/offline-miss', {
      headers: { 'cache-control': 'only-if-cached' }
    }))
    await readBody(res)
    assert.strictEqual(res.statusCode, 504)
    assert.strictEqual(hits, 0, 'a network-forbidden request reached the origin')
  } finally {
    await client.close()
    await origin.close()
  }
})
