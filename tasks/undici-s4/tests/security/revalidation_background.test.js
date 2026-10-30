'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { undici, startServer, req, storedHeaders, hasSetCookie, readBody, sleep } = require('../support/harness')

test('a shared cache drops a stored response when a background refresh answer carries Set-Cookie', async () => {
  let hits = 0
  let conditional = 0
  let answerConditional
  const conditionalSeen = new Promise(resolve => { answerConditional = resolve })

  const origin = await startServer((request, response) => {
    if (request.headers['if-none-match'] || request.headers['if-modified-since']) {
      conditional++
      response.statusCode = 304
      response.setHeader('set-cookie', 'session=background')
      response.end()
      answerConditional()
      return
    }
    hits++
    response.setHeader('date', new Date().toUTCString())
    if (hits === 1) {
      response.setHeader('cache-control', 'public, max-age=2, stale-while-revalidate=10')
      response.setHeader('etag', '"v1"')
      response.end('first')
      return
    }
    response.setHeader('cache-control', 'public, max-age=60')
    response.end('third')
  })

  const store = new undici.cacheStores.MemoryCacheStore()
  const client = new undici.Client(origin.url).compose(undici.interceptors.cache({ store }))

  try {
    const first = await client.request(req('/inbox'))
    assert.strictEqual(await readBody(first), 'first')

    await sleep(2400)

    // Stale within the revalidation window: the stale copy is served and a
    // background refresh is started.
    const second = await client.request(req('/inbox'))
    assert.strictEqual(await readBody(second), 'first')
    await conditionalSeen
    await sleep(300)

    assert.strictEqual(conditional, 1, 'the background refresh did not run')
    assert.strictEqual(
      storedHeaders(store, '/inbox'),
      undefined,
      'the shared cache kept the stored response although the refresh answer carried Set-Cookie'
    )

    // The next caller must not be answered from the old stored response.
    const third = await client.request(req('/inbox'))
    const body = await readBody(third)
    assert.strictEqual(body, 'third')
    assert.ok(!hasSetCookie(third.headers))
  } finally {
    await client.close()
    await origin.close()
  }
})
