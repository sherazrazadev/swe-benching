'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { createSigner, key, algorithmOf } = require('../helpers')

const pubRsa = key('rs-512-public.key')
const pubEc = key('es-256-public.key')

test('[security/detection_cache] an earlier explicit HMAC use does not let a verified key sign as a secret', () => {
  // A caller may deliberately use this string as a shared secret for an HMAC signer.
  assert.strictEqual(algorithmOf(createSigner({ key: pubRsa, algorithm: 'HS256' })({ n: 1 })), 'HS256')

  // A later signer that was not asked for HMAC must not inherit that decision.
  assert.throws(() => createSigner({ key: pubRsa })({ n: 2 }))
})

test('[security/detection_cache] the same holds when the key carries surrounding text', () => {
  const material = '# cache check\n' + pubRsa
  assert.strictEqual(algorithmOf(createSigner({ key: material, algorithm: 'HS256' })({ n: 1 })), 'HS256')

  assert.throws(() => createSigner({ key: material })({ n: 2 }))
})

test('[security/detection_cache] an earlier refusal does not block a later explicit HMAC use', () => {
  // Automatic detection must refuse this material for signing.
  assert.throws(() => createSigner({ key: pubEc })({ n: 1 }))

  // The caller then explicitly asks for HMAC on the same string: that choice is theirs.
  const token = createSigner({ key: pubEc, algorithm: 'HS256' })({ n: 2 })
  assert.strictEqual(algorithmOf(token), 'HS256')
})
