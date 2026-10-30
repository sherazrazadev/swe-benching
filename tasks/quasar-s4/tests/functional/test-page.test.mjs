import test from 'node:test'
import assert from 'node:assert/strict'

import { parse } from 'parse5'

import {
  loadRender,
  makeRequest,
  render,
  elements,
  scriptTexts
} from '../support/page.mjs'

const renderSSRError = await loadRender()

const EXPECTED = {
  uri: '/page?a=1&b=2',
  method: 'GET',
  client: '127.0.0.1',
  userAgent: 'agent-ok'
}

function benignPage() {
  return render(renderSSRError, {
    err: new Error('plain failure'),
    req: makeRequest({
      headers: { 'user-agent': EXPECTED.userAgent, 'x-note': 'ok' },
      url: EXPECTED.uri
    }),
    rootFolder: '/workspace'
  })
}

function matches(summary) {
  return (
    summary &&
    summary.uri === EXPECTED.uri &&
    summary.method === EXPECTED.method &&
    summary.client === EXPECTED.client &&
    summary.userAgent === EXPECTED.userAgent
  )
}

// Every element attribute that carries a JSON object.
function summariesInAttributes(html) {
  const found = []

  for (const element of elements(html)) {
    for (const attr of element.attrs || []) {
      const value = attr.value.trim()
      if (!value.startsWith('{') || !value.endsWith('}')) continue

      try {
        found.push(JSON.parse(value))
      } catch {
        // not the value this page carries as JSON
      }
    }
  }

  return found
}

// Every short inline script that evaluates to an object carrying a request summary.
// The packaged application script is much larger and is skipped.
function summariesInScripts(html) {
  const found = []

  for (const text of scriptTexts(html)) {
    if (text.length > 20000) continue

    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start < 0 || end <= start) continue

    try {
      const value = new Function(`return (${text.slice(start, end + 1)})`)()
      if (value && value.summary) found.push(value.summary)
      else if (value && value.uri !== undefined) found.push(value)
    } catch {
      // not a diagnostics value
    }
  }

  return found
}

test('the page still returns the documented response headers', () => {
  const { errorHeaders } = benignPage()
  assert.equal(errorHeaders['Content-Type'], 'text/html; charset=utf-8')
  assert.equal(
    errorHeaders['Cache-Control'],
    'no-cache, no-store, must-revalidate'
  )
})

test('the page still carries its application shell', () => {
  const { errorHtml } = benignPage()
  const parsed = parse(errorHtml)
  assert.notEqual(parsed, null)
  assert.equal(errorHtml.includes('<div id="app"></div>'), true)
})

test('an element attribute still carries the request summary', () => {
  const { errorHtml } = benignPage()
  assert.equal(
    summariesInAttributes(errorHtml).some(matches),
    true,
    'the page stopped carrying the request summary as element data'
  )
})

test('an inline script still carries the request summary', () => {
  const { errorHtml } = benignPage()
  assert.equal(
    summariesInScripts(errorHtml).some(matches),
    true,
    'the page stopped carrying the request summary as script data'
  )
})
