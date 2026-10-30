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
  cookieBreakout
} from '../support/payloads.mjs'

const renderSSRError = await loadRender()

function baseRequest(overrides = {}) {
  return makeRequest({
    headers: { 'user-agent': 'agent-ok', 'x-note': 'ok' },
    url: '/page?a=1&b=2',
    ...overrides
  })
}

// A request value may only ever be carried as data. If it becomes part of the document,
// the parsed structure changes or the marker shows up as visible text.
function assertInert({ err, req }) {
  const good = render(renderSSRError, {
    err: new Error('plain failure'),
    req: baseRequest()
  })
  const bad = render(renderSSRError, { err, req })

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
  test(`error text stays inert in the page data (${shape})`, () => {
    assertInert({ err: new Error(payload), req: baseRequest() })
  })
}

test('header value stays inert in the page data', () => {
  assertInert({
    err: new Error('plain failure'),
    req: baseRequest({
      headers: { 'user-agent': 'agent-ok', 'x-note': mixedCaseClose }
    })
  })
})

test('cookie value stays inert in the page data', () => {
  assertInert({
    err: new Error('plain failure'),
    req: baseRequest({
      headers: { 'user-agent': 'agent-ok', 'x-note': 'ok', cookie: cookieBreakout }
    })
  })
})
