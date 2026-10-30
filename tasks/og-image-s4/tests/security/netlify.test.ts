import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { defaultFontsComponent, ogPath, startCanary, startPlatformServer, type Canary, type RunningApp } from '../support/harness'

let canary: Canary
let app: RunningApp
const component = defaultFontsComponent()

beforeAll(async () => {
  canary = await startCanary()
  app = await startPlatformServer('netlify')
}, 300_000)

afterAll(async () => {
  app?.stop()
  await canary?.stop()
})

async function assertNotContacted(fonts: unknown): Promise<void> {
  canary.reset()
  await fetch(app.base + ogPath(component, fonts), { signal: AbortSignal.timeout(60_000) })
    .then(r => r.arrayBuffer())
    .catch(() => null)
  await new Promise(r => setTimeout(r, 250))
  expect(canary.hits(), `font value: ${JSON.stringify(fonts)}`).toBe(0)
}

describe('a visitor-supplied font value cannot reach another host (Netlify handler)', () => {
  it('does not fetch an absolute address that names another host', async () => {
    await assertNotContacted([{ name: 'probe', weight: 400, path: `${canary.url}/probe` }])
  })

  it('does not fetch an absolute address with extra leading whitespace', async () => {
    await assertNotContacted([{ name: 'probe', weight: 400, path: `\t${canary.url}/probe` }])
  })
})
