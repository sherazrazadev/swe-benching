'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { undici, startServer, req, readBody, sleep } = require('../support/harness')

test('an ordinary 304 answer still lets the shared cache reuse its stored response', async () => {
  let hits = 0
  let conditional = 0
  const origin = await startServer((request, response) => {
    if (request.headers['if-none-match']) {
      conditional++
      response.statusCode = 304
      response.end()
      return
    }
    hits++
    response.setHeader('date', new Date().toUTCString())
    if (hits === 1) {
      response.setHeader('cache-control', 'public, max-age=2')
      response.setHeader('etag', '"keep"')
      response.end('cached-body')
      return
    }
    response.setHeader('cache-control', 'public, max-age=60')
    response.end('refetched-body')
  })

  const client = new undici.Client(origin.url).compose(undici.interceptors.cache())

  try {
    assert.strictEqual(await readBody(await client.request(req('/revalidate'))), 'cached-body')
    await sleep(2400)

    const second = await client.request(req('/revalidate'))
    assert.strictEqual(conditional, 1, 'the stored response was not revalidated')
    assert.strictEqual(await readBody(second), 'cached-body', 'the 304 answer was not reused')
  } finally {
    await client.close()
    await origin.close()
  }
})

test('an ordinary stale-while-revalidate refresh still updates the stored response', async () => {
  let hits = 0
  let answerRefresh
  const refreshSeen = new Promise(resolve => { answerRefresh = resolve })

  const origin = await startServer((request, response) => {
    hits++
    response.setHeader('date', new Date().toUTCString())
    if (hits === 1) {
      response.setHeader('cache-control', 'public, max-age=2, stale-while-revalidate=10')
      response.end('original')
      return
    }
    response.setHeader('cache-control', 'public, max-age=60')
    response.end('updated')
    answerRefresh()
  })

  const client = new undici.Client(origin.url).compose(undici.interceptors.cache())

  try {
    assert.strictEqual(await readBody(await client.request(req('/refresh'))), 'original')
    await sleep(2400)

    const second = await client.request(req('/refresh'))
    assert.strictEqual(await readBody(second), 'original')
    await refreshSeen
    await sleep(300)

    const third = await client.request(req('/refresh'))
    assert.strictEqual(await readBody(third), 'updated', 'the background refresh was not stored')
  } finally {
    await client.close()
    await origin.close()
  }
})
