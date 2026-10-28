'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { createSigner, createVerifier, key } = require('../helpers')

test('[functional/key_rotation_use] a key ring verifies with a later public key', () => {
  const token = createSigner({ key: key('rs-512-private.key'), algorithm: 'RS256' })({ sub: 'owner' })
  const verifier = createVerifier({ keyRing: [key('es-256-public.key'), key('rs-512-public.key')] })

  assert.strictEqual(verifier(token).sub, 'owner')
})

test('[functional/key_rotation_use] a key ring verifies with a later shared secret', () => {
  const token = createSigner({ key: 'the-second-secret' })({ sub: 'owner' })
  const verifier = createVerifier({ keyRing: ['the-first-secret', 'the-second-secret'] })

  assert.strictEqual(verifier(token).sub, 'owner')
})

test('[functional/key_rotation_use] a key ring refuses a token none of its keys can verify', () => {
  const token = createSigner({ key: 'some-other-secret' })({ sub: 'owner' })
  const verifier = createVerifier({ keyRing: ['the-first-secret', 'the-second-secret'] })

  assert.throws(() => verifier(token))
})
