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
