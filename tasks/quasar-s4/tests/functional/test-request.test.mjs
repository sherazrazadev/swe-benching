import test from 'node:test'
import assert from 'node:assert/strict'

import { loadRender, makeRequest, render, readMainData } from '../support/page.mjs'

const renderSSRError = await loadRender()

test('forwarded request details keep being reported', () => {
  const { errorHtml } = render(renderSSRError, {
    err: new Error('plain failure'),
    req: makeRequest({
      headers: {
        'user-agent': 'agent-ok',
        'x-forwarded-proto': 'https, http',
        'x-forwarded-for': '203.0.113.9, 10.0.0.1'
      },
      url: '/page'
    }),
    rootFolder: '/workspace'
  })

  const data = readMainData(errorHtml)
  assert.equal(data.env.Request['Server protocol'], 'HTTPS/1.1')
  assert.equal(data.env.Request['Remote address'], '203.0.113.9')
})

test('ordinary cookie values keep parsing', () => {
  const { errorHtml } = render(renderSSRError, {
    err: new Error('plain failure'),
    req: makeRequest({
      headers: {
        'user-agent': 'agent-ok',
        cookie: 'a=1; b=two words; c=x=y; d=hello%20world'
      },
      url: '/page'
    }),
    rootFolder: '/workspace'
  })

  const data = readMainData(errorHtml)
  assert.deepEqual(
    { ...data.env.Cookies },
    { a: '1', b: 'two words', c: 'x=y', d: 'hello world' }
  )
})

test('a request without cookies keeps reporting an empty set', () => {
  const { errorHtml } = render(renderSSRError, {
    err: new Error('plain failure'),
    req: makeRequest({
      headers: { 'user-agent': 'agent-ok' },
      url: '/page'
    }),
    rootFolder: '/workspace'
  })

  const data = readMainData(errorHtml)
  assert.deepEqual({ ...data.env.Cookies }, {})
})
