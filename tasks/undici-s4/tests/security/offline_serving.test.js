'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { undici, startServer, req, storedHeaders, hasSetCookie, readBody } = require('../support/harness')

test('a shared cache does not answer a network-forbidden request from a Set-Cookie entry', async () => {
  let hits = 0
  const origin = await startServer((request, response) => {
    hits++
    response.setHeader('cache-control', 'public, max-age=300')
    if (hits === 1) {
      response.setHeader('set-cookie', 'session=stored')
      response.end('stored-body')
      return
    }
    response.end(`fresh-body-${hits}`)
  })

  const store = new undici.cacheStores.MemoryCacheStore()
  const privateClient = new undici.Client(origin.url)
    .compose(undici.interceptors.cache({ store, type: 'private' }))
  const sharedClient = new undici.Client(origin.url)
    .compose(undici.interceptors.cache({ store, type: 'shared' }))

  try {
    const first = await privateClient.request(req('/session'))
    assert.strictEqual(await readBody(first), 'stored-body')
    assert.strictEqual(first.headers['set-cookie'], 'session=stored')

    const offline = await sharedClient.request(req('/session', {
      headers: { 'cache-control': 'only-if-cached' }
    }))
    await readBody(offline)

    assert.ok(
      !hasSetCookie(offline.headers),
      'the shared cache answered a network-forbidden request with a stored Set-Cookie header'
    )
    assert.ok(
      !hasSetCookie(storedHeaders(store, '/session')),
      'the shared cache store still holds a response carrying Set-Cookie'
    )
  } finally {
    await privateClient.close()
    await sharedClient.close()
    await origin.close()
  }
})
