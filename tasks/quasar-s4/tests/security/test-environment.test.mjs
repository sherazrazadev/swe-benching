import test from 'node:test'
import assert from 'node:assert/strict'

import { loadRender, makeRequest, render } from '../support/page.mjs'

const renderSSRError = await loadRender()

function page() {
  return render(renderSSRError, {
    err: new Error('plain failure'),
    req: makeRequest({
      headers: { 'user-agent': 'agent-ok', 'x-note': 'ok' },
      url: '/page?a=1&b=2'
    })
  }).errorHtml
}

function withEnvironment(name, value, run) {
  const previous = process.env[name]
  process.env[name] = value

  try {
    return run()
  } finally {
    if (previous === void 0) delete process.env[name]
    else process.env[name] = previous
  }
}

test('a process environment value is never disclosed by the page', () => {
  const name = 'SSR_GATE_PRIVATE_VALUE'
  const value = 'ssr-gate-private-value-4d81c6'

  withEnvironment(name, value, () => {
    const html = page()
    assert.equal(html.includes(value), false, 'an environment value reached the page')
    assert.equal(html.includes(name), false, 'an environment name reached the page')
  })
})

test('a project-named environment value is never disclosed by the page', () => {
  const name = 'QUASAR_SSR_GATE_PRIVATE'
  const value = 'quasar-ssr-gate-private-91f2ba'

  withEnvironment(name, value, () => {
    const html = page()
    assert.equal(html.includes(value), false, 'an environment value reached the page')
    assert.equal(html.includes(name), false, 'an environment name reached the page')
  })
})
