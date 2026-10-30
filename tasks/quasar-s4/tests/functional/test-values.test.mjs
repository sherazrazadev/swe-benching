import test from 'node:test'
import assert from 'node:assert/strict'

import { loadRender, makeRequest, render, readMainData } from '../support/page.mjs'

const renderSSRError = await loadRender()

const LINE_SEPARATOR = String.fromCharCode(0x2028)

test('legitimate values round-trip through the page data unchanged', () => {
  const message =
    'plain <tag> & "quote" \'apos\' ' + LINE_SEPARATOR + ' separator'
  const url = '/page?a=1&b=2'
  const cookie = 'gdpr=true; theme=dark; token=a=b; greeting=hello%20world'
  const headers = {
    'user-agent': 'agent-ok',
    'x-note': 'a&b<c>d"e\'f',
    cookie
  }

  const { errorHtml } = render(renderSSRError, {
    err: new Error(message),
    req: makeRequest({ headers, url }),
    rootFolder: '/workspace'
  })

  const data = readMainData(errorHtml)

  assert.equal(data.error.message, message)
  assert.equal(data.env.Headers['x-note'], headers['x-note'])
  assert.equal(data.env.Headers['user-agent'], 'agent-ok')
  assert.equal(data.env.Request['Request URI'], url)
  assert.deepEqual(
    { ...data.env.Cookies },
    {
      gdpr: 'true',
      theme: 'dark',
      token: 'a=b',
      greeting: 'hello world'
    }
  )
})
