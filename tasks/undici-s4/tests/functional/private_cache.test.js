'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { undici, startServer, req, readBody } = require('../support/harness')

test('a private cache still stores and serves a response carrying Set-Cookie', async () => {
  let hits = 0
  const origin = await startServer((request, response) => {
    hits++
    response.setHeader('cache-control', 'public, max-age=300')
    response.setHeader('set-cookie', 'session=private-user')
    response.end(`payload-${hits}`)
  })

  const store = new undici.cacheStores.MemoryCacheStore()
  const client = new undici.Client(origin.url).compose(undici.interceptors.cache({ store, type: 'private' }))

  try {
    const first = await client.request(req('/private-plain'))
    assert.strictEqual(await readBody(first), 'payload-1')
    assert.strictEqual(first.headers['set-cookie'], 'session=private-user')

    const second = await client.request(req('/private-plain'))
    assert.strictEqual(await readBody(second), 'payload-1')
    assert.strictEqual(hits, 1, 'the private cache did not reuse its own entry')
    assert.strictEqual(second.headers['set-cookie'], 'session=private-user')
  } finally {
    await client.close()
    await origin.close()
  }
})

test('a private cache still honours a qualified private directive naming Set-Cookie', async () => {
  let hits = 0
  const origin = await startServer((request, response) => {
    hits++
    response.setHeader('cache-control', 'public, max-age=60, private="set-cookie"')
    response.setHeader('set-cookie', 'session=stripped')
    response.end('ok')
  })

  const store = new undici.cacheStores.MemoryCacheStore()
  const client = new undici.Client(origin.url).compose(undici.interceptors.cache({ store, type: 'private' }))

  try {
    const first = await client.request(req('/private-qualified'))
    assert.strictEqual(first.headers['set-cookie'], 'session=stripped')
    await readBody(first)

    const second = await client.request(req('/private-qualified'))
    assert.strictEqual(await readBody(second), 'ok')
    assert.strictEqual(hits, 1, 'the private cache did not reuse its own entry')
    assert.strictEqual(second.headers['set-cookie'], undefined)
  } finally {
    await client.close()
    await origin.close()
  }
})

test('a private cache still stores an ordinary response with max-age', async () => {
  let hits = 0
  const origin = await startServer((request, response) => {
    hits++
    response.setHeader('cache-control', 'max-age=60')
    response.end(`payload-${hits}`)
  })

  const client = new undici.Client(origin.url).compose(undici.interceptors.cache({ type: 'private' }))

  try {
    await readBody(await client.request(req('/private-normal')))
    const second = await client.request(req('/private-normal'))
    assert.strictEqual(await readBody(second), 'payload-1')
    assert.strictEqual(hits, 1)
  } finally {
    await client.close()
    await origin.close()
  }
})
