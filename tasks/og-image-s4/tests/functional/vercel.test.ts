import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  dataFontUri,
  defaultFontsComponent,
  ogPath,
  startCanary,
  startPlatformServer,
  type Canary,
  type RunningApp,
} from '../support/harness'

let canary: Canary
let app: RunningApp
const component = defaultFontsComponent()

beforeAll(async () => {
  canary = await startCanary()
  app = await startPlatformServer('vercel')
}, 300_000)

afterAll(async () => {
  app?.stop()
  await canary?.stop()
})

function isPng(buf: ArrayBuffer): boolean {
  const b = new Uint8Array(buf)
  return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47
}

describe('legitimate font use keeps working (serverless handler)', () => {
  it('renders with a font supplied inline as a data: URI', async () => {
    const res = await fetch(app.base + ogPath(component, [{ name: 'inlinefont', weight: 400, path: dataFontUri('vercel') }]), {
      signal: AbortSignal.timeout(60_000),
    })
    expect(res.status).toBe(200)
    expect(isPng(await res.arrayBuffer())).toBe(true)
  })
})
