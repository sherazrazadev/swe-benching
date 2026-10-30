import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  code,
  mount,
  providerNames,
  restoreProviderFetch,
  stubProviderFetch,
} from '../support/oauth'

describe('a login callback that carries no state issued to the browser', () => {
  let calls: string[]
  beforeEach(() => {
    calls = stubProviderFetch()
  })
  afterEach(() => restoreProviderFetch())

  for (const provider of providerNames) {
    it(`${provider}: a code with no state and no state cookie does not sign anyone in`, async () => {
      const app = mount(provider)
      const res = await app.app.request(`${app.path}?code=${code}`)
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
      expect(app.ran()).toBe(false)
      expect(calls).toEqual([])
    })
  }

  it('google: an unrelated query parameter next to the code does not stand in for the proof', async () => {
    const app = mount('google')
    const res = await app.app.request(`${app.path}?code=${code}&next=/account`)
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
    expect(app.ran()).toBe(false)
    expect(calls).toEqual([])
  })

  it('github: an unrelated query parameter next to the code does not stand in for the proof', async () => {
    const app = mount('github')
    const res = await app.app.request(`${app.path}?code=${code}&next=/account`)
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
    expect(app.ran()).toBe(false)
    expect(calls).toEqual([])
  })
})
