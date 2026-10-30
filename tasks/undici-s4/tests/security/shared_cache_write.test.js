'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { undici, startServer, req, storedHeaders, hasSetCookie, readBody } = require('../support/harness')

test('a shared cache does not keep a response whose header list carries Set-Cookie', async () => {
  let hits = 0
  const origin = await startServer((request, response) => {
    hits++
    response.setHeader('cache-control', 'public, max-age=300')
    if (hits === 1) {
      response.setHeader('set-cookie', 'session=alpha')
    }
    response.end(`body-${hits}`)
  })

  const store = new undici.cacheStores.MemoryCacheStore()
  const client = new undici.Client(origin.url).compose(undici.interceptors.cache({ store }))

  try {
    const first = await client.request(req('/profile'))
    await readBody(first)
    assert.strictEqual(first.headers['set-cookie'], 'session=alpha')

    // The shared cache must not retain the response in its store.
    assert.ok(
      !hasSetCookie(storedHeaders(store, '/profile')),
      'the shared cache store kept a response carrying Set-Cookie'
    )

    // A later caller must not receive that header from the cache.
    const second = await client.request(req('/profile'))
    await readBody(second)
    assert.ok(
      !hasSetCookie(second.headers),
      'a later caller received Set-Cookie that the cache had retained'
    )
  } finally {
    await client.close()
    await origin.close()
  }
})

