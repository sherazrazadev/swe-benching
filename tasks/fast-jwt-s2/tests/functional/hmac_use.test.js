'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { createSigner, createVerifier } = require('../helpers')

test('[functional/hmac_use] shared secrets round-trip with every HMAC algorithm', () => {
  for (const algorithm of ['HS256', 'HS384', 'HS512']) {
    const token = createSigner({ key: 'a-shared-secret-value', algorithm })({ sub: 'owner' })
    assert.strictEqual(createVerifier({ key: 'a-shared-secret-value', algorithms: [algorithm] })(token).sub, 'owner')
  }
})

test('[functional/hmac_use] buffer secrets round-trip', () => {
  const secret = Buffer.from('another-shared-secret')
  const token = createSigner({ key: secret })({ sub: 'owner' })
  assert.strictEqual(createVerifier({ key: secret })(token).sub, 'owner')
})

test('[functional/hmac_use] a wrong secret is still refused', () => {
  const token = createSigner({ key: 'the-right-secret' })({ sub: 'owner' })
  assert.throws(() => createVerifier({ key: 'the-wrong-secret' })(token))
})

test('[functional/hmac_use] a caller that asks for HMAC may use a PEM-shaped string as a secret', () => {
  const secret = '-----BEGIN PUBLIC KEY-----\nTHIS IS A SHARED SECRET'
  const token = createSigner({ key: secret, algorithm: 'HS256' })({ sub: 'owner' })
  assert.strictEqual(createVerifier({ key: secret, algorithms: ['HS256'] })(token).sub, 'owner')
})

test('[functional/hmac_use] the same holds when that secret carries surrounding text', () => {
  const secret = '# a note\n-----BEGIN PUBLIC KEY-----\nTHIS IS A SHARED SECRET'
  const token = createSigner({ key: secret, algorithm: 'HS256' })({ sub: 'owner' })
  assert.strictEqual(createVerifier({ key: secret, algorithms: ['HS256'] })(token).sub, 'owner')
})
