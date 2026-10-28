'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { createSigner, createVerifier, key, algorithmOf } = require('../helpers')

const pairs = [
  ['RSA', 'rs-512-private.key', 'rs-512-public.key', 'RS256'],
  ['EC', 'es-256-private.key', 'es-256-public.key', 'ES256'],
  ['Ed25519', 'ed-25519-private.key', 'ed-25519-public.key', 'EdDSA']
]

test('[functional/asymmetric_use] every asymmetric key type signs and verifies', () => {
  for (const [name, privateFile, publicFile, algorithm] of pairs) {
    const token = createSigner({ key: key(privateFile) })({ sub: name })
    assert.strictEqual(algorithmOf(token), algorithm)
    assert.strictEqual(createVerifier({ key: key(publicFile) })(token).sub, name)
  }
})

test('[functional/asymmetric_use] certificates verify the tokens of their private key', () => {
  const token = createSigner({ key: key('rs-x509-private.key'), algorithm: 'RS256' })({ sub: 'owner' })
  assert.strictEqual(createVerifier({ key: key('rs-x509-public.key') })(token).sub, 'owner')
})

test('[functional/asymmetric_use] a certificate stored with a comment line keeps verifying', () => {
  const token = createSigner({ key: key('rs-x509-private.key'), algorithm: 'RS256' })({ sub: 'owner' })
  const certificate = '# some comment\n' + key('rs-x509-public.key')
  assert.strictEqual(createVerifier({ key: certificate })(token).sub, 'owner')
})

test('[functional/asymmetric_use] a passphrase-protected private key signs', () => {
  const ppk = key('pprs-512-private.key')
  const token = createSigner({ key: { key: ppk, passphrase: 'secret' }, algorithm: 'RS256' })({ sub: 'owner' })
  assert.strictEqual(createVerifier({ key: key('pprs-512-public.key') })(token).sub, 'owner')
})

test('[functional/asymmetric_use] explicitly requested asymmetric algorithms keep working', () => {
  const cases = [
    ['rs-512-private.key', 'rs-512-public.key', 'RS512'],
    ['ps-512-private.key', 'ps-512-public.key', 'PS256']
  ]

  for (const [privateFile, publicFile, algorithm] of cases) {
    const token = createSigner({ key: key(privateFile), algorithm })({ sub: 'owner' })
    assert.strictEqual(algorithmOf(token), algorithm)
    assert.strictEqual(createVerifier({ key: key(publicFile), algorithms: [algorithm] })(token).sub, 'owner')
  }
})
