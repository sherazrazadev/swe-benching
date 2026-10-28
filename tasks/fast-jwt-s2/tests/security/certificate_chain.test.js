'use strict'

const { test } = require('node:test')
const { key, expectRefused } = require('../helpers')

const certificate = key('rs-x509-public.key')

test('[security/certificate_chain] a certificate with surrounding text is not a shared secret', () => {
  const material = '.' + certificate
  expectRefused({ certificateChain: [material] }, material)
})

test('[security/certificate_chain] a certificate that cannot be imported is not a shared secret', () => {
  const material = '-----BEGIN CERTIFICATE-----\nGARBAGE\n-----END CERTIFICATE-----'
  expectRefused({ certificateChain: [material] }, material)
})
