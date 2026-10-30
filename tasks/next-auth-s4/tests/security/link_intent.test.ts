import { describe, expect, it } from "vitest"

import * as h from "../support/harness.js"

/**
 * When a signed-in user starts a provider sign-in to link that provider account to their own
 * account, the product stores the target account in the browser and finishes the link on the
 * callback. That stored value is scoped to the provider that stored it: a link intent minted
 * for one provider must not be applied when a different provider handles the callback, and one
 * that carries no record of the provider must not be applied either.
 *
 * The providers here configure no OAuth checks, so the link intent is the only stored value
 * involved and a rejection cannot be masked by another check. Tests replay the cookies the real
 * sign-in response set and never depend on a particular cookie name.
 */

function linkConfig() {
  const calls: string[] = []
  const adapter = h.memoryAdapter([
    { id: "victim-1", name: "Victim", email: "victim@example.com" },
  ])
  const config = h.testConfig({
    adapter,
    providers: [
      h.oauthProvider({ id: "alpha", checks: [] }, calls),
      h.oauthProvider({ id: "beta", checks: [] }, calls),
    ],
  })
  return { config, adapter }
}

function nameWithoutCallbackUrl(cookies: Record<string, string>): string {
  const names = Object.keys(cookies).filter((name) => !name.includes("callback-url"))
  return names[names.length - 1]
}

async function startLinking(config: any, provider: string) {
  const session = await h.sessionCookie("victim-1")
  const start = await h.signIn(config, provider, {
    cookies: { [h.SESSION_COOKIE]: session },
  })
  return h.cookiesOf(start)
}

function linkedToVictim(adapter: h.MemoryAdapter) {
  return adapter._accounts.filter((account) => account.userId === "victim-1")
}

describe("account-link intent is bound to its provider", () => {
  it("does not apply a link intent minted for another provider", async () => {
    const { config, adapter } = linkConfig()
    const cookies = await startLinking(config, "alpha")
    expect(Object.keys(cookies).length).toBeGreaterThan(0)

    const response = await h.callback(config, "beta", {
      cookies,
      query: { code: "attacker-code" },
    })

    expect(response.status).toBeLessThan(500)
    expect(linkedToVictim(adapter)).toEqual([])
    expect((await h.sessionFor(response))?.sub).not.toBe("victim-1")
  })

  it("does not apply a link intent saved before the provider was recorded", async () => {
    const { config, adapter } = linkConfig()
    const cookies = await startLinking(config, "beta")
    const name = nameWithoutCallbackUrl(cookies)
    const legacy = await h.seal({ value: "victim-1" }, name)

    const response = await h.callback(config, "beta", {
      cookies: { [name]: legacy },
      query: { code: "attacker-code" },
    })

    expect(response.status).toBeLessThan(500)
    expect(linkedToVictim(adapter)).toEqual([])
    expect((await h.sessionFor(response))?.sub).not.toBe("victim-1")
  })
})

describe("a provider account already belongs to one account", () => {
  it("does not attach a provider account that is already attached to a different account", async () => {
    const calls: string[] = []
    const adapter = h.memoryAdapter([
      { id: "victim-1", name: "Victim", email: "victim@example.com" },
      { id: "owner-1", name: "Owner", email: "owner@example.com" },
    ])
    // owner-1 has already signed in with this provider account before.
    adapter._accounts.push({
      userId: "owner-1",
      type: "oauth",
      provider: "beta",
      providerAccountId: "beta-user",
    })
    const config = h.testConfig({
      adapter,
      providers: [
        h.oauthProvider({ id: "alpha", checks: [] }, calls),
        h.oauthProvider({ id: "beta", checks: [] }, calls),
      ],
    })
    const session = await h.sessionCookie("victim-1")
    const start = await h.signIn(config, "beta", {
      cookies: { [h.SESSION_COOKIE]: session },
    })

    const response = await h.callback(config, "beta", {
      cookies: h.cookiesOf(start),
      query: { code: "attacker-code" },
    })

    expect(response.status).toBeLessThan(500)
    // The already-attached account is not attached a second time, to any account.
    expect(adapter._accounts).toHaveLength(1)
    expect(adapter._accounts[0].userId).toBe("owner-1")
    expect(linkedToVictim(adapter)).toEqual([])
    expect((await h.sessionFor(response))?.sub).not.toBe("victim-1")
  })
})

describe("the account to link is not taken from where the browser returns to", () => {
  it("does not attach the provider account to an account named in the address the sign-in started from", async () => {
    const calls: string[] = []
    const adapter = h.memoryAdapter([
      { id: "victim-1", name: "Victim", email: "victim@example.com" },
    ])
    const config = h.testConfig({
      adapter,
      providers: [
        h.oauthProvider({ id: "alpha", checks: [] }, calls),
        h.oauthProvider({ id: "beta", checks: [] }, calls),
      ],
    })
    // Nobody is signed in when the sign-in starts, so the product stores no link
    // target for this flow; the address it must return to names one.
    const start = await h.signIn(config, "alpha", {
      query: { callbackUrl: "/account?linkTo=victim-1" },
    })

    const response = await h.callback(config, "alpha", {
      cookies: h.cookiesOf(start),
      query: { code: "attacker-code" },
    })

    expect(response.status).toBeLessThan(500)
    expect(linkedToVictim(adapter)).toEqual([])
    expect((await h.sessionFor(response))?.sub).not.toBe("victim-1")
  })
})
