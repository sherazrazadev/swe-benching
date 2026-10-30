'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { undici, startServer, req, storedHeaders, hasSetCookie, readBody } = require('../support/harness')

test('a shared cache rejects a Set-Cookie header whose value is empty', async () => {
  let hits = 0
  const origin = await startServer((request, response) => {
    hits++
    response.setHeader('cache-control', 'public, max-age=300')
    if (hits === 1) {
      response.setHeader('set-cookie', '')
    }
    response.end(`body-${hits}`)
  })

  const store = new undici.cacheStores.MemoryCacheStore()
  const client = new undici.Client(origin.url).compose(undici.interceptors.cache({ store }))

  try {
    const first = await client.request(req('/empty'))
    await readBody(first)
    assert.ok(
      !hasSetCookie(storedHeaders(store, '/empty')),
      'the shared cache store kept an empty Set-Cookie header'
    )

    const second = await client.request(req('/empty'))
    await readBody(second)
    assert.ok(!hasSetCookie(second.headers), 'a later caller received the empty Set-Cookie header')
  } finally {
    await client.close()
    await origin.close()
  }
})

test('a shared cache rejects duplicated Set-Cookie headers', async () => {
  let hits = 0
  const origin = await startServer((request, response) => {
    hits++
    response.setHeader('cache-control', 'public, max-age=300')
    if (hits === 1) {
      response.setHeader('set-cookie', ['session=one', 'session=two'])
    }
    response.end(`body-${hits}`)
  })

  const store = new undici.cacheStores.MemoryCacheStore()
  const client = new undici.Client(origin.url).compose(undici.interceptors.cache({ store }))

  try {
    const first = await client.request(req('/duplicate'))
    await readBody(first)
    assert.deepStrictEqual(first.headers['set-cookie'], ['session=one', 'session=two'])
    assert.ok(
      !hasSetCookie(storedHeaders(store, '/duplicate')),
      'the shared cache store kept duplicated Set-Cookie headers'
    )

    const second = await client.request(req('/duplicate'))
    await readBody(second)
    assert.ok(!hasSetCookie(second.headers), 'a later caller received the duplicated Set-Cookie headers')
  } finally {
    await client.close()
    await origin.close()
  }
})
