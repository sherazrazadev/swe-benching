'use strict'

const { test } = require('node:test')
const { key, expectRefused, expectRefusedAsync } = require('../helpers')

const pubRsa = key('rs-512-public.key')
const privRsa = key('rs-512-private.key')
const pubEc = key('es-256-public.key')
const pubEd = key('ed-25519-public.key')

test('[security/verify_prefixed_keys] a public key preceded by a comment line is not a shared secret', () => {
  const material = '# some comment\n' + pubRsa
  expectRefused({ key: material }, material)
})

test('[security/verify_prefixed_keys] a public key preceded by a line comment is not a shared secret', () => {
  const material = '// comment\n' + pubRsa
  expectRefused({ key: material }, material)
})

test('[security/verify_prefixed_keys] a public key preceded by an arbitrary printable byte is not a shared secret', () => {
  const material = '.' + pubRsa
  expectRefused({ key: material }, material)
})

test('[security/verify_prefixed_keys] a public key preceded by an HTTP-style header is not a shared secret', () => {
  const material = 'HTTP/1.1 200 OK\r\n\r\n' + pubRsa
  expectRefused({ key: material }, material)
})

test('[security/verify_prefixed_keys] a public key preceded by control bytes is not a shared secret', () => {
  for (const prefix of ['\x00', '\x01', '\x1b', '\x7f']) {
    const material = prefix + pubRsa
    expectRefused({ key: material }, material)
  }
})

test('[security/verify_prefixed_keys] a public key preceded by zero-width characters is not a shared secret', () => {
  for (const prefix of ['​', '‍', '᠎']) {
    const material = prefix + pubRsa
    expectRefused({ key: material }, material)
  }
})

test('[security/verify_prefixed_keys] an EC public key preceded by a comment line is not a shared secret', () => {
  const material = '# some comment\n' + pubEc
  expectRefused({ key: material }, material)
})

test('[security/verify_prefixed_keys] an Ed25519 public key preceded by a comment line is not a shared secret', () => {
  const material = '# some comment\n' + pubEd
  expectRefused({ key: material }, material)
})

test('[security/verify_prefixed_keys] a private key preceded by a comment line cannot verify tokens', () => {
  const material = '# some comment\n' + privRsa
  expectRefused({ key: material }, material)
})

test('[security/verify_prefixed_keys] a real key behind an unrelated PEM block is not a shared secret', () => {
  const material = '-----BEGIN COMMENT-----\nQUJD\n-----END COMMENT-----\n' + pubRsa
  expectRefused({ key: material }, material)
})

test('[security/verify_prefixed_keys] a public key supplied as a buffer with a prefix is not a shared secret', () => {
  const material = '# some comment\n' + pubRsa
  expectRefused({ key: Buffer.from(material) }, material)
})

test('[security/verify_prefixed_keys] a prefixed public key is not a shared secret when an HMAC algorithm is allowed', () => {
  const material = '# some comment\n' + pubRsa
  expectRefused({ key: material, algorithms: ['HS256', 'RS256'] }, material)
})

test('[security/verify_prefixed_keys] a prefixed public key returned by a key fetcher is not a shared secret', async () => {
  const material = '# some comment\n' + pubRsa
  await expectRefusedAsync({ key: async () => material }, material)
})

test('[security/verify_prefixed_keys] the same applies to a longer HMAC algorithm', () => {
  const material = '# some comment\n' + pubRsa
  expectRefused({ key: material }, material, 'HS384')
})
