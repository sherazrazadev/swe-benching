'use strict'

const path = require('node:path')
const { createHmac } = require('node:crypto')
const { readFileSync } = require('node:fs')

const WORKSPACE = process.env.WORKSPACE_DIR || '/workspace'

// The product under test: its public entry point.
const { createSigner, createVerifier } = require(path.join(WORKSPACE, 'src'))

function key(name) {
  return readFileSync(path.join(__dirname, 'keys', name), 'utf-8')
}

function algorithmOf(token) {
  return JSON.parse(Buffer.from(String(token).split('.')[0], 'base64url').toString('utf-8')).alg
}

// Anyone who knows public key material can compute this signature themselves, which
// is why the material must never be used as a shared secret.
function forgeHsToken(secret, alg = 'HS256') {
  const header = Buffer.from(JSON.stringify({ alg, typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ sub: 'attacker', admin: true })).toString('base64url')
  const signature = createHmac(`sha${alg.slice(2)}`, secret).update(`${header}.${payload}`).digest('base64url')

  return `${header}.${payload}.${signature}`
}

// The attack is blocked when building or using the verifier does not hand the
// attacker's claims back. The library reports a refusal with an error.
function expectRefused(options, secret, alg) {
  const token = forgeHsToken(secret, alg)
  let returned

  try {
    returned = createVerifier(options)(token)
  } catch {
    return
  }

  throw new Error(`the forged token was accepted: ${JSON.stringify(returned)}`)
}

async function expectRefusedAsync(options, secret, alg) {
  const token = forgeHsToken(secret, alg)
  let returned

  try {
    returned = await createVerifier(options)(token)
  } catch {
    return
  }

  throw new Error(`the forged token was accepted: ${JSON.stringify(returned)}`)
}

module.exports = {
  WORKSPACE,
  createSigner,
  createVerifier,
  key,
  algorithmOf,
  forgeHsToken,
  expectRefused,
  expectRefusedAsync
}
