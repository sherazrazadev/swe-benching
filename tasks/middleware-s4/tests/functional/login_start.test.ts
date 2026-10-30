import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clientId,
  clientSecret,
  mount,
  restoreProviderFetch,
  stubProviderFetch,
} from '../support/oauth'

describe('starting a login keeps working', () => {
  let calls: string[]
  beforeEach(() => {
    calls = stubProviderFetch()
  })
  afterEach(() => restoreProviderFetch())

  for (const provider of ['google', 'github', 'x'] as const) {
    it(`${provider}: the entry request redirects and issues the state even with other query parameters`, async () => {
      const app = mount(provider)
      const res = await app.app.request(`${app.path}?next=/account`)
      expect(res.status).toBe(302)
      const location = res.headers.get('location') ?? ''
      expect(location).toContain('state=')
      const setCookie = res.headers.get('set-cookie') ?? ''
      expect(setCookie).toContain('state=')
      expect(setCookie.toLowerCase()).toContain('httponly')
      expect(calls).toEqual([])
    })
  }

  it('google: a bare entry request still redirects', async () => {
    const app = mount('google')
    const res = await app.app.request(app.path)
    expect(res.status).toBe(302)
    expect(res.headers.get('set-cookie') ?? '').toContain('state=')
  })

  it('google: a configured fixed state is issued and used in the redirect', async () => {
    const app = mount('google', { state: 'configured-fixed-state' })
    const res = await app.app.request(`${app.path}?next=/account`)
    expect(res.status).toBe(302)
    expect(res.headers.get('location') ?? '').toContain('state=configured-fixed-state')
    expect(res.headers.get('set-cookie') ?? '').toContain('state=configured-fixed-state')
  })

  it('twitch: a configured fixed state still starts a login', async () => {
    const app = mount('twitch', { state: 'configured-fixed-state' })
    const res = await app.app.request(`${app.path}?next=/account`)
    expect(res.status).toBe(302)
    expect(res.headers.get('location') ?? '').toContain('state=configured-fixed-state')
  })

  it('x: starting a login also issues the code verifier for the browser', async () => {
    const app = mount('x')
    const res = await app.app.request(`${app.path}?next=/account`)
    expect(res.status).toBe(302)
    expect(res.headers.get('set-cookie') ?? '').toContain('code-verifier=')
  })

  it('linkedin: the application-token mode still runs without a login callback', async () => {
    const app = mount('linkedin', { appAuth: true, client_id: clientId, client_secret: clientSecret })
    const res = await app.app.request(app.path)
    expect(res.status).toBe(200)
    expect(app.ran()).toBe(true)
    expect(app.body()?.token).toBeTruthy()
    expect(calls.length).toBeGreaterThan(0)
  })
})
