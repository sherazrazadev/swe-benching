import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  dataFontUri,
  defaultFontsComponent,
  loadedFonts,
  ogPath,
  startNodeServer,
  type RunningApp,
} from '../support/harness'

let app: RunningApp
const component = defaultFontsComponent()

beforeAll(async () => {
  app = await startNodeServer()
}, 300_000)

afterAll(() => {
  app?.stop()
})

function isPng(buf: ArrayBuffer): boolean {
  const b = new Uint8Array(buf)
  return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47
}

async function debugFontFamilies(fonts: unknown): Promise<string[]> {
  const res = await fetch(app.base + ogPath(component, fonts, 'json'), { signal: AbortSignal.timeout(60_000) })
  const body = await res.text()
  return loadedFonts(body).map(f => String(f.family || f.name || ''))
}

describe('legitimate font use keeps working (node handler)', () => {
  it('renders an ordinary image', async () => {
    const res = await fetch(app.base + ogPath(component, []), { signal: AbortSignal.timeout(60_000) })
    expect(res.status).toBe(200)
    expect(isPng(await res.arrayBuffer())).toBe(true)
  })

  it('loads a font served by the site origin at a relative path', async () => {
    const families = await debugFontFamilies([{ name: 'sitefont', weight: 800, path: '/OPTIEinstein-Black.otf' }])
    expect(families).toContain('sitefont')
  })

  it('loads a font supplied inline as a data: URI', async () => {
    const families = await debugFontFamilies([{ name: 'inlinefont', weight: 400, path: dataFontUri('node') }])
    expect(families).toContain('inlinefont')
  })

  it('ignores malformed entries without failing the request', async () => {
    const fonts = [null, 'string-entry', { name: 'no-path' }, { name: 'badweight', weight: 'abc', path: '/OPTIEinstein-Black.otf' }]
    const res = await fetch(app.base + ogPath(component, fonts), { signal: AbortSignal.timeout(60_000) })
    expect(res.status).toBe(200)
    expect(isPng(await res.arrayBuffer())).toBe(true)
  })
})
