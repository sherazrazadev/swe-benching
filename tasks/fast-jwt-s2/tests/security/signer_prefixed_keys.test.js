'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { createSigner, createVerifier, key, algorithmOf } = require('../helpers')

const pubRsa = key('rs-512-public.key')
const privRsa = key('rs-512-private.key')

function signAutomatically(keyMaterial) {
  return createSigner({ key: keyMaterial })({ sub: 'owner' })
}

test('[security/signer_prefixed_keys] a private key with surrounding text signs with its own algorithm', () => {
  const privateMaterial = '# some comment\n' + privRsa
  const token = signAutomatically(privateMaterial)

  assert.strictEqual(algorithmOf(token), 'RS256', 'the asymmetric key was used as a shared secret')
  const verified = createVerifier({ key: '# some comment\n' + pubRsa })(token)
  assert.strictEqual(verified.sub, 'owner')
})

test('[security/signer_prefixed_keys] a public key with surrounding text is refused for signing', () => {
  assert.throws(() => signAutomatically('# some comment\n' + pubRsa))
})

test('[security/signer_prefixed_keys] a public key with a control-byte prefix is refused for signing', () => {
  assert.throws(() => signAutomatically('\x00' + pubRsa))
})

test('[security/signer_prefixed_keys] a public key with a printable prefix is refused for signing', () => {
  assert.throws(() => signAutomatically('.' + pubRsa))
})

test('[security/signer_prefixed_keys] a public key returned by a key fetcher is refused for signing', async () => {
  const signer = createSigner({ key: async () => '# some comment\n' + pubRsa })
  await assert.rejects(signer({ sub: 'owner' }))
})

test('[security/signer_prefixed_keys] a private key with a printable prefix is never used as a shared secret', () => {
  let token
  try {
    token = signAutomatically('.' + privRsa)
  } catch {
    return
  }

  assert.notStrictEqual(algorithmOf(token).slice(0, 2), 'HS', 'the asymmetric key was used as a shared secret')
})
