import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  code,
  expectedUser,
  mount,
  providerNames,
  restoreProviderFetch,
  state,
  stateCookie,
  stubProviderFetch,
} from '../support/oauth'

describe('a login callback that presents the state issued to the browser', () => {
  let calls: string[]
  beforeEach(() => {
    calls = stubProviderFetch()
  })
  afterEach(() => restoreProviderFetch())

  for (const provider of providerNames) {
    it(`${provider}: a matching state completes the login and exposes the account`, async () => {
      const app = mount(provider)
      const header =
        provider === 'x'
          ? `state=${state}; code-verifier=test-verifier`
          : stateCookie()
      const res = await app.app.request(`${app.path}?code=${code}&state=${state}`, {
        headers: { cookie: header },
      })
      expect(res.status).toBe(200)
      expect(app.ran()).toBe(true)
      expect(app.body()?.user).toEqual(expectedUser[provider])
      expect(calls.length).toBeGreaterThan(0)
    })
  }

  it('github: a provider token that comes with the matching state still completes the login', async () => {
    const app = mount('github')
    const res = await app.app.request(
      `${app.path}?access_token=pre-obtained-provider-token&state=${state}`,
      { headers: { cookie: stateCookie() } }
    )
    expect(res.status).toBe(200)
    expect(app.ran()).toBe(true)
    expect(app.body()?.user).toEqual(expectedUser.github)
  })

  it('twitch: a fixed-state deployment completes the login when the browser holds the issued state', async () => {
    const fixedState = 'configured-fixed-state'
    const app = mount('twitch', { state: fixedState })
    const res = await app.app.request(`${app.path}?code=${code}&state=${fixedState}`, {
      headers: { cookie: `state=${fixedState}` },
    })
    expect(res.status).toBe(200)
    expect(app.ran()).toBe(true)
    expect(app.body()?.user).toEqual(expectedUser.twitch)
  })

  describe('tampered or missing proof does not complete the login', () => {
    it('a different state than the one issued is not accepted', async () => {
      const app = mount('google')
      const res = await app.app.request(`${app.path}?code=${code}&state=other-state`, {
        headers: { cookie: stateCookie() },
      })
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(app.ran()).toBe(false)
    })

    it('a state in the request without the browser-issued value is not accepted', async () => {
      const app = mount('facebook')
      const res = await app.app.request(`${app.path}?code=${code}&state=${state}`)
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(app.ran()).toBe(false)
    })

    it('the browser-issued value without a state in the request is not accepted', async () => {
      const app = mount('discord')
      const res = await app.app.request(`${app.path}?code=${code}`, {
        headers: { cookie: stateCookie() },
      })
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(app.ran()).toBe(false)
    })
  })
})

describe('a login started and completed through the real entry point', () => {
  let calls: string[]
  beforeEach(() => {
    calls = stubProviderFetch()
  })
  afterEach(() => restoreProviderFetch())

  it('discord: the value issued at login start completes the login it belongs to', async () => {
    const app = mount('discord')
    const start = await app.app.request(`${app.path}?next=/account`)
    const setCookie = start.headers.get('set-cookie') ?? ''
    const match = /(?:^|[;,\s])state=([^;,\s]+)/.exec(setCookie)
    expect(match).not.toBeNull()
    const issued = match![1]
    const res = await app.app.request(`${app.path}?code=${code}&state=${encodeURIComponent(issued)}`, {
      headers: { cookie: `state=${issued}` },
    })
    expect(res.status).toBe(200)
    expect(app.ran()).toBe(true)
    expect(app.body()?.user).toEqual(expectedUser.discord)
    expect(calls.length).toBeGreaterThan(0)
  })
})
