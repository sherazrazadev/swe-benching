import { describe, expect, it } from "vitest"

import * as h from "../support/harness.js"

/** Linking an account with the provider that stored the link intent keeps working. */

describe("same-provider account linking", () => {
  it("links the provider account to the target account and signs it in", async () => {
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
    const session = await h.sessionCookie("victim-1")
    const start = await h.signIn(config, "alpha", {
      cookies: { [h.SESSION_COOKIE]: session },
      })
    const cookies = h.cookiesOf(start)
    expect(Object.keys(cookies).length).toBeGreaterThan(0)

    const response = await h.callback(config, "alpha", {
      cookies,
      query: { code: "legit-code" },
    })

    expect(adapter._accounts).toHaveLength(1)
    expect(adapter._accounts[0].provider).toBe("alpha")
    expect(adapter._accounts[0].userId).toBe("victim-1")
    expect((await h.sessionFor(response))?.sub).toBe("victim-1")
  })
})

describe("signing in with an account's own provider account", () => {
  it("signs in the account the provider account is already attached to", async () => {
    const calls: string[] = []
    const adapter = h.memoryAdapter([
      { id: "owner-1", name: "Owner", email: "owner@example.com" },
    ])
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

    const response = await h.callback(config, "beta", {
      query: { code: "legit-code" },
    })

    expect((await h.sessionFor(response))?.sub).toBe("owner-1")
    expect(adapter._accounts).toHaveLength(1)
  })
})

describe("the page the sign-in started from", () => {
  it("is returned to, with the parameters it was opened with", async () => {
    const calls: string[] = []
    const config = h.testConfig({
      providers: [h.oauthProvider({ id: "alpha", checks: [] }, calls)],
    })
    const start = await h.signIn(config, "alpha", {
      query: { callbackUrl: "/account?tab=2" },
    })

    const response = await h.callback(config, "alpha", {
      cookies: h.cookiesOf(start),
      query: { code: "legit-code" },
    })

    const location = h.locationOf(response)
    expect(response.status).toBe(302)
    expect(location?.pathname).toBe("/account")
    expect(location?.searchParams.get("tab")).toBe("2")
    expect(h.hasSession(response)).toBe(true)
  })
})
