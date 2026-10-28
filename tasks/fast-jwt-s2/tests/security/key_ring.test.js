'use strict'

const { test } = require('node:test')
const { key, expectRefused } = require('../helpers')

const pubRsa = key('rs-512-public.key')
const pubEc = key('es-256-public.key')
const certificate = key('rs-x509-public.key')

test('[security/key_ring] a prefixed public key in a key ring is not a shared secret', () => {
  const material = '# some comment\n' + pubRsa
  expectRefused({ keyRing: [material] }, material)
})

test('[security/key_ring] a public key supplied as a buffer in a key ring is not a shared secret', () => {
  expectRefused({ keyRing: [Buffer.from(pubRsa)] }, pubRsa)
})

test('[security/key_ring] a prefixed certificate in a key ring is not a shared secret', () => {
  const material = '.' + certificate
  expectRefused({ keyRing: [material] }, material)
})

test('[security/key_ring] a prefixed EC public key in a key ring is not a shared secret', () => {
  const material = '.' + pubEc
  expectRefused({ keyRing: [material] }, material)
})
