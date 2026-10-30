import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, restoreProviderFetch, stubProviderFetch } from '../support/oauth'

describe('a login continuation that carries a provider token instead of a code', () => {
  let calls: string[]
  beforeEach(() => {
    calls = stubProviderFetch()
  })
  afterEach(() => restoreProviderFetch())

  it('github: a pre-obtained provider token with no state does not sign anyone in', async () => {
    const app = mount('github')
    const res = await app.app.request(`${app.path}?access_token=pre-obtained-provider-token`)
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
    expect(app.ran()).toBe(false)
    expect(calls).toEqual([])
  })
})
