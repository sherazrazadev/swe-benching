import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { code, mount, restoreProviderFetch, stubProviderFetch } from '../support/oauth'

function issuedState(setCookie: string | null): string | undefined {
  if (!setCookie) return undefined
  const match = /(?:^|[;,\s])state=([^;,\s]+)/.exec(setCookie)
  return match?.[1]
}

describe('a state value the caller chose at login start', () => {
  let calls: string[]
  beforeEach(() => {
    calls = stubProviderFetch()
  })
  afterEach(() => restoreProviderFetch())

  it('discord: a caller-chosen state does not become the browser-issued proof', async () => {
    const chosen = 'caller-chosen-state'
    const app = mount('discord')
    // The visitor is first sent to the login entry point with a state the caller picked.
    const start = await app.app.request(`${app.path}?state=${chosen}`)
    const issued = issuedState(start.headers.get('set-cookie'))
    calls.length = 0
    // The callback then carries the attacker's code and the same chosen value, with
    // whatever state the browser was actually issued.
    const res = await app.app.request(`${app.path}?code=${code}&state=${chosen}`, {
      headers: issued ? { cookie: `state=${issued}` } : {},
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
    expect(app.ran()).toBe(false)
    expect(calls).toEqual([])
  })
})
