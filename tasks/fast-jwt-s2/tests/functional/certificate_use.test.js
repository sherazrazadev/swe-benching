'use strict'

const { test } = require('node:test')
const assert = require('node:assert')
const { createSigner, createVerifier, key } = require('../helpers')

test('[functional/certificate_use] a certificate chain verifies tokens of its private key', () => {
  const token = createSigner({ key: key('rs-x509-private.key'), algorithm: 'RS256' })({ sub: 'owner' })
  const verifier = createVerifier({ certificateChain: [key('rs-x509-public.key')] })

  assert.strictEqual(verifier(token).sub, 'owner')
})

test('[functional/certificate_use] a certificate chain supplied as buffers verifies too', () => {
  const token = createSigner({ key: key('rs-x509-private.key'), algorithm: 'RS256' })({ sub: 'owner' })
  const verifier = createVerifier({ certificateChain: [Buffer.from(key('rs-x509-public.key'))] })

  assert.strictEqual(verifier(token).sub, 'owner')
})
