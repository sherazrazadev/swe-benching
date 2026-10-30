'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { undici, startServer, req, readBody } = require('../support/harness')

test('a shared cache still caches and reuses an ordinary response', async () => {
  let hits = 0
  const origin = await startServer((request, response) => {
    hits++
    response.setHeader('cache-control', 'public, max-age=300')
    response.setHeader('x-marker', 'ordinary')
    response.end(`payload-${hits}`)
  })

  const store = new undici.cacheStores.MemoryCacheStore()
  const client = new undici.Client(origin.url).compose(undici.interceptors.cache({ store }))

  try {
    const first = await client.request(req('/plain'))
    assert.strictEqual(await readBody(first), 'payload-1')
    assert.strictEqual(first.headers['x-marker'], 'ordinary')

    const second = await client.request(req('/plain'))
    assert.strictEqual(await readBody(second), 'payload-1')
    assert.strictEqual(hits, 1, 'the second request was not served from the cache')
    assert.strictEqual(second.headers['x-marker'], 'ordinary')
  } finally {
    await client.close()
    await origin.close()
  }
})

test('the default cache type caches ordinary responses like a shared cache', async () => {
  let hits = 0
  const origin = await startServer((request, response) => {
    hits++
    response.setHeader('cache-control', 'max-age=300')
    response.end(`payload-${hits}`)
  })

  const client = new undici.Client(origin.url).compose(undici.interceptors.cache())

  try {
    const first = await client.request(req('/default'))
    assert.strictEqual(await readBody(first), 'payload-1')
    const second = await client.request(req('/default'))
    assert.strictEqual(await readBody(second), 'payload-1')
    assert.strictEqual(hits, 1)
  } finally {
    await client.close()
    await origin.close()
  }
})

test('a shared cache still strips headers named by a qualified private directive', async () => {
  for (const cacheControl of [
    'public, max-age=60, private="x-secret"',
    'public, max-age=60, private = "x-secret"',
    'public, max-age=60, private\t=\t"x-secret"'
  ]) {
    let hits = 0
    const origin = await startServer((request, response) => {
      hits++
      response.setHeader('cache-control', cacheControl)
      response.setHeader('x-secret', 'inside')
      response.end('ok')
    })

    const client = new undici.Client(origin.url).compose(undici.interceptors.cache())

    try {
      const first = await client.request(req('/qualified-private'))
      assert.strictEqual(await readBody(first), 'ok')
      assert.strictEqual(first.headers['x-secret'], 'inside', cacheControl)

      const second = await client.request(req('/qualified-private'))
      assert.strictEqual(await readBody(second), 'ok')
      assert.strictEqual(hits, 1, `not cached for ${cacheControl}`)
      assert.strictEqual(second.headers['x-secret'], undefined, cacheControl)
    } finally {
      await client.close()
      await origin.close()
    }
  }
})

test('a shared cache still strips headers named by a qualified no-cache directive', async () => {
  const origin = await startServer((request, response) => {
    response.setHeader('cache-control', 'public, max-age=60, no-cache="x-private-note"')
    response.setHeader('x-private-note', 'inside')
    response.end('ok')
  })

  const client = new undici.Client(origin.url).compose(undici.interceptors.cache())

  try {
    const first = await client.request(req('/qualified-no-cache'))
    assert.strictEqual(first.headers['x-private-note'], 'inside')
    await readBody(first)

    const second = await client.request(req('/qualified-no-cache'))
    assert.strictEqual(second.headers['x-private-note'], undefined)
    assert.strictEqual(await readBody(second), 'ok')
  } finally {
    await client.close()
    await origin.close()
  }
})
