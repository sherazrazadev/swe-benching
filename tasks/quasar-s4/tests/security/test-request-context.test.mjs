import test from 'node:test'
import assert from 'node:assert/strict'

import {
  loadRender,
  makeRequest,
  render,
  structure,
  visibleText
} from '../support/page.mjs'
import {
  MARKER,
  mixedCaseClose,
  spacedClose,
  selfClosingClose,
  quoteBreakout
} from '../support/payloads.mjs'

const renderSSRError = await loadRender()

function requestWithUserAgent(value) {
  return makeRequest({
    headers: { 'user-agent': value, 'x-note': 'ok' },
    url: '/page?a=1&b=2'
  })
}

function assertInert(userAgent) {
  const good = render(renderSSRError, {
    err: new Error('plain failure'),
    req: requestWithUserAgent('agent-ok')
  })
  const bad = render(renderSSRError, {
    err: new Error('plain failure'),
    req: requestWithUserAgent(userAgent)
  })

  assert.deepEqual(
    structure(bad.errorHtml),
    structure(good.errorHtml),
    'a request value changed the document the browser parses'
  )
  assert.equal(
    visibleText(bad.errorHtml).includes(MARKER),
    false,
    'a request value became visible page text'
  )
}

for (const [shape, payload] of [
  ['mixed-case closing tag', mixedCaseClose],
  ['closing tag with whitespace', spacedClose],
  ['self-closing closing tag', selfClosingClose]
]) {
  test(`request summary in the page script stays inert (${shape})`, () => {
    assertInert(payload)
  })
}

test('request summary in the page markup stays inert', () => {
  assertInert(quoteBreakout)
})
