import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

import { loadRender, makeRequest, render, readMainData } from '../support/page.mjs'

const require = createRequire(import.meta.url)
const { throwFromFixtureSource } = require('./source-fixture.cjs')

const renderSSRError = await loadRender()

test('a literal closing-tag lookalike in displayed source text round-trips exactly', () => {
  let error
  try {
    throwFromFixtureSource()
  } catch (caught) {
    error = caught
  }

  const { errorHtml } = render(renderSSRError, {
    err: error,
    req: makeRequest({
      headers: { 'user-agent': 'agent-ok' },
      url: '/page'
    }),
    rootFolder: '/workspace'
  })

  const data = readMainData(errorHtml)
  const displayed = data.stack
    .filter(entry => entry.sourceCode)
    .flatMap(entry => entry.sourceCode.linesList)

  assert.equal(
    displayed.some(line =>
      line.includes('literal closing tag in displayed source: </script>')
    ),
    true,
    'the source line containing a closing-tag lookalike was changed'
  )
})
