'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { createSigner, createVerifier, key, expectRefused } = require('../helpers')

const pubRsa = key('rs-512-public.key')
const privRsa = key('rs-512-private.key')
const pubEc = key('es-256-public.key')
const privEc = key('es-256-private.key')

test('[security/recognized_keys] surrounding text does not stop an RSA public key verifying its own tokens', () => {
  const material = '# some comment\n' + pubRsa
  const token = createSigner({ key: privRsa, algorithm: 'RS256' })({ sub: 'owner' })

  assert.strictEqual(createVerifier({ key: material })(token).sub, 'owner')
  expectRefused({ key: material }, material)
})

test('[security/recognized_keys] surrounding text does not stop an EC public key verifying its own tokens', () => {
  const material = 'HTTP/1.1 200 OK\r\n\r\n' + pubEc
  const token = createSigner({ key: privEc, algorithm: 'ES256' })({ sub: 'owner' })

  assert.strictEqual(createVerifier({ key: material })(token).sub, 'owner')
  expectRefused({ key: material }, material)
})
