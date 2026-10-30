'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { undici, startServer, req, storedHeaders, hasSetCookie, readBody } = require('../support/harness')

test('a shared cache does not serve an entry that a private cache left in the same store', async () => {
  let hits = 0
  const origin = await startServer((request, response) => {
    hits++
    response.setHeader('cache-control', 'public, max-age=300')
    if (hits === 1) {
      response.setHeader('set-cookie', 'session=private-owner')
      response.end('private-body')
      return
    }
    response.end(`shared-body-${hits}`)
  })

  const store = new undici.cacheStores.MemoryCacheStore()
  const privateClient = new undici.Client(origin.url)
    .compose(undici.interceptors.cache({ store, type: 'private' }))
  const sharedClient = new undici.Client(origin.url)
    .compose(undici.interceptors.cache({ store, type: 'shared' }))

  try {
    const first = await privateClient.request(req('/account'))
    assert.strictEqual(await readBody(first), 'private-body')
    assert.strictEqual(first.headers['set-cookie'], 'session=private-owner')

    // A shared cache reading the same store must not hand that entry to another caller.
    const second = await sharedClient.request(req('/account'))
    await readBody(second)
    assert.ok(
      !hasSetCookie(second.headers),
      'the shared cache served Set-Cookie from an entry it did not create'
    )

    // It must not keep a copy of the header either.
    assert.ok(
      !hasSetCookie(storedHeaders(store, '/account')),
      'the shared cache store still holds a response carrying Set-Cookie'
    )
  } finally {
    await privateClient.close()
    await sharedClient.close()
    await origin.close()
  }
})
