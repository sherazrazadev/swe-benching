'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { undici, startServer, req, storedHeaders, hasSetCookie, readBody, sleep } = require('../support/harness')

test('a shared cache does not keep a background replacement that carries Set-Cookie', async () => {
  let hits = 0
  let answerRefresh
  let refreshSeen = new Promise(resolve => { answerRefresh = resolve })

  const origin = await startServer((request, response) => {
    hits++
    response.setHeader('date', new Date().toUTCString())
    if (hits === 1) {
      response.setHeader('cache-control', 'public, max-age=2, stale-while-revalidate=10')
      response.end('first')
      return
    }
    // The background refresh replaces the entry with a personalised response.
    response.setHeader('cache-control', 'public, max-age=60')
    if (hits === 2) {
      response.setHeader('set-cookie', 'session=refreshed')
    }
    response.end('refreshed')
    answerRefresh()
  })

  const store = new undici.cacheStores.MemoryCacheStore()
  const client = new undici.Client(origin.url).compose(undici.interceptors.cache({ store }))

  try {
    const first = await client.request(req('/dashboard'))
    assert.strictEqual(await readBody(first), 'first')

    await sleep(2400)

    // Stale within the revalidation window: the stale copy is served and the
    // replacement is fetched in the background.
    const second = await client.request(req('/dashboard'))
    assert.strictEqual(await readBody(second), 'first')
    await refreshSeen
    await sleep(400)

    assert.ok(
      !hasSetCookie(storedHeaders(store, '/dashboard')),
      'the shared cache kept the background replacement carrying Set-Cookie'
    )

    const third = await client.request(req('/dashboard'))
    await readBody(third)
    assert.ok(!hasSetCookie(third.headers), 'a later caller received the background Set-Cookie')
  } finally {
    await client.close()
    await origin.close()
  }
})
