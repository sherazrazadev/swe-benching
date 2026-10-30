import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { defaultFontsComponent, ogPath, startCanary, startNodeServer, type Canary, type RunningApp } from '../support/harness'

let canary: Canary
let app: RunningApp
const component = defaultFontsComponent()

beforeAll(async () => {
  canary = await startCanary()
  app = await startNodeServer()
}, 300_000)

afterAll(async () => {
  app?.stop()
  await canary?.stop()
})

/** Drive the real image entry point and assert the internal service was never contacted. */
async function assertNotContacted(fonts: unknown): Promise<void> {
  canary.reset()
  await fetch(app.base + ogPath(component, fonts), { signal: AbortSignal.timeout(60_000) })
    .then(r => r.arrayBuffer())
    .catch(() => null)
  // The font fetch is awaited before the response is produced; a short settle covers clock skew.
  await new Promise(r => setTimeout(r, 250))
  expect(canary.hits(), `font value: ${JSON.stringify(fonts)}`).toBe(0)
}

describe('a visitor-supplied font value cannot reach another host (node handler)', () => {
  it('does not fetch an absolute address that names another host', async () => {
    await assertNotContacted([{ name: 'probe', weight: 400, path: `${canary.url}/probe` }])
  })

  it('does not fetch a network-path reference', async () => {
    await assertNotContacted([{ name: 'probe', weight: 400, path: `//127.0.0.1:${canary.port}/probe` }])
  })

  it('does not fetch a backslash-authority form', async () => {
    await assertNotContacted([{ name: 'probe', weight: 400, path: `\\\\127.0.0.1:${canary.port}/probe` }])
  })

  it('does not fetch a slash-then-backslash authority form', async () => {
    await assertNotContacted([{ name: 'probe', weight: 400, path: `/\\127.0.0.1:${canary.port}/probe` }])
  })

  it('does not fetch a space-prefixed network-path form', async () => {
    await assertNotContacted([{ name: 'probe', weight: 400, path: ` //127.0.0.1:${canary.port}/probe` }])
  })

  it('does not follow a redirect from the site origin to another host', async () => {
    await assertNotContacted([
      { name: 'probe', weight: 400, path: `/api/redirect?to=${encodeURIComponent(`${canary.url}/probe`)}` },
    ])
  })

  it('does not fetch a hostile value mixed with a legitimate one', async () => {
    await assertNotContacted([
      { name: 'legit', weight: 400, path: '/OPTIEinstein-Black.otf' },
      { name: 'probe', weight: 400, path: `${canary.url}/probe` },
    ])
  })
})
