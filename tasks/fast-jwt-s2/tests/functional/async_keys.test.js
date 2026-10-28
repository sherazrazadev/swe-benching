'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { createSigner, createVerifier, key } = require('../helpers')

test('[functional/async_keys] a key fetched per token works for signing and verifying', async () => {
  const token = await createSigner({ key: async () => 'a-shared-secret-value' })({ sub: 'owner' })
  const payload = await createVerifier({ key: async () => 'a-shared-secret-value' })(token)
  assert.strictEqual(payload.sub, 'owner')
})

test('[functional/async_keys] a PEM key fetched per token works for signing and verifying', async () => {
  const token = await createSigner({ key: async () => key('rs-512-private.key') })({ sub: 'owner' })
  const payload = await createVerifier({ key: async () => key('rs-512-public.key') })(token)
  assert.strictEqual(payload.sub, 'owner')
})

test('[functional/async_keys] a callback-style key fetcher works for verifying', () => {
  const token = createSigner({ key: key('rs-512-private.key') })({ sub: 'owner' })
  const verifier = createVerifier({ key: (decoded, callback) => callback(null, key('rs-512-public.key')) })

  return new Promise((resolve, reject) => {
    verifier(token, (error, payload) => (error ? reject(error) : resolve(payload)))
  }).then(payload => assert.strictEqual(payload.sub, 'owner'))
})
