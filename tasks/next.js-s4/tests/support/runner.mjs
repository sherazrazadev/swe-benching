// Runs one hidden group (security or functional) and writes JUnit XML.
// Usage: node runner.mjs <group> <output.xml>
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  AppServer,
  assert,
  buildFixture,
  buildId,
  materializeFixture,
  routeState,
  waitFor,
  WORKSPACE,
} from './harness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const group = process.argv[2]
const outXml = process.argv[3]
const CASE_TIMEOUT_MS = 240000

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function xmlEscape(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function loadCases() {
  const modulePath = path.join(HERE, '..', group, 'cases.mjs')
  const module = await import(pathToFileURL(modulePath).href)
  if (!Array.isArray(module.cases) || module.cases.length === 0) {
    throw new Error(`no cases exported by ${modulePath}`)
  }
  return module.cases
}

const built = new Map()
const buildErrors = new Map()

async function ensureBuilt(fixture, overlay) {
  const key = overlay ? `${fixture}+${overlay}` : fixture
  if (buildErrors.has(key)) throw buildErrors.get(key)
  if (!built.has(key)) {
    try {
      const appDir = materializeFixture(fixture, overlay, key)
      await buildFixture(appDir)
      built.set(key, appDir)
    } catch (error) {
      buildErrors.set(key, error)
      throw error
    }
  }
  return built.get(key)
}

async function runCase(testCase) {
  const appDir = await ensureBuilt(testCase.fixture, testCase.overlay)
  const server = new AppServer(appDir)
  try {
    await server.start()
    const context = {
      appDir,
      buildId: () => buildId(appDir),
      get: (pathname, options) => server.get(pathname, options),
      head: (pathname, options) => server.head(pathname, options),
      routeState,
      assert,
      waitFor,
      sleep,
      workspace: WORKSPACE,
    }
    return await Promise.race([
      Promise.resolve().then(() => testCase.run(context)),
      sleep(CASE_TIMEOUT_MS).then(() => {
        throw new Error(`case timed out after ${CASE_TIMEOUT_MS}ms`)
      }),
    ])
  } finally {
    await server.stop()
  }
}

async function main() {
  let cases
  try {
    cases = await loadCases()
  } catch (error) {
    fs.writeFileSync(
      outXml,
      `<?xml version="1.0"?><testsuite tests="0" failures="0" errors="1"><testcase classname="${xmlEscape(
        group
      )}" name="load"><error message="${xmlEscape(error.message)}"/></testcase></testsuite>`
    )
    return
  }

  const results = []
  for (const testCase of cases) {
    try {
      await runCase(testCase)
      results.push({ name: testCase.name, status: 'pass' })
    } catch (error) {
      results.push({
        name: testCase.name,
        status: 'fail',
        message: error && error.message ? error.message : String(error),
        stack: error && error.stack ? error.stack : '',
      })
    }
  }

  const failures = results.filter((result) => result.status === 'fail')
  const body = results
    .map((result) => {
      const name = xmlEscape(result.name)
      if (result.status === 'pass') {
        return `<testcase classname="${xmlEscape(group)}" name="${name}"/>`
      }
      return `<testcase classname="${xmlEscape(group)}" name="${name}"><failure message="${xmlEscape(
        result.message
      )}">${xmlEscape(result.stack || result.message)}</failure></testcase>`
    })
    .join('\n')
  fs.writeFileSync(
    outXml,
    `<?xml version="1.0"?><testsuite tests="${results.length}" failures="${failures.length}" errors="0">\n${body}\n</testsuite>`
  )
}

main().then(
  () => process.exit(0),
  (error) => {
    try {
      fs.writeFileSync(
        outXml,
        `<?xml version="1.0"?><testsuite tests="0" failures="0" errors="1"><testcase classname="${xmlEscape(
          group
        )}" name="runner"><error message="${xmlEscape(error.message)}"/></testcase></testsuite>`
      )
    } catch {}
    process.exit(0)
  }
)
