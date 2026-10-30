'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { undici, startServer, req, storedHeaders, hasSetCookie, readBody, sleep } = require('../support/harness')

test('a shared cache does not reuse a stored response when its refresh answer carries Set-Cookie', async () => {
  let hits = 0
  let conditional = 0
  const origin = await startServer((request, response) => {
    if (request.headers['if-none-match'] || request.headers['if-modified-since']) {
      conditional++
      response.statusCode = 304
      response.setHeader('set-cookie', 'session=rotated')
      response.end()
      return
    }
    hits++
    response.setHeader('date', new Date().toUTCString())
    if (hits === 1) {
      response.setHeader('cache-control', 'public, max-age=2')
      response.setHeader('etag', '"v1"')
      response.end('first')
      return
    }
    response.setHeader('cache-control', 'public, max-age=60')
    response.end('second')
  })

  const store = new undici.cacheStores.MemoryCacheStore()
  const client = new undici.Client(origin.url).compose(undici.interceptors.cache({ store }))

  try {
    const first = await client.request(req('/feed'))
    assert.strictEqual(await readBody(first), 'first')

    await sleep(2400)

    const second = await client.request(req('/feed'))
    const body = await readBody(second)
    assert.strictEqual(conditional, 1, 'the stale entry was not revalidated')
    assert.notStrictEqual(
      body,
      'first',
      'the shared cache answered from the stored response although the refresh answer carried Set-Cookie'
    )
    assert.ok(!hasSetCookie(second.headers), 'the caller received Set-Cookie from the cache')
    assert.ok(
      !hasSetCookie(storedHeaders(store, '/feed')),
      'the shared cache store still holds a response carrying Set-Cookie'
    )
  } finally {
    await client.close()
    await origin.close()
  }
})
