import { describe, expect, it } from "vitest"

import * as h from "../support/harness.js"

/**
 * The sealed OAuth check values (state, PKCE verifier, nonce) are minted during a sign-in for
 * one provider and consumed during a callback. Each case below starts a real sign-in, then
 * presents the cookies it produced to a real callback. A value minted for one provider must not
 * authenticate another provider's callback; a value that carries no record of the provider that
 * minted it must not be accepted either.
 *
 * The providers configure only the check under test, so a rejection cannot be masked by a
 * different check. Tests never depend on a particular cookie name: they replay whatever the real
 * sign-in response set, and for the "saved earlier" cases they replace the value of the cookie
 * the same provider's sign-in just used.
 */

function nameWithoutCallbackUrl(cookies: Record<string, string>): string {
  const names = Object.keys(cookies).filter((name) => !name.includes("callback-url"))
  return names[names.length - 1]
}

describe("OAuth state value is bound to its provider", () => {
  it("rejects a state cookie minted for another provider", async () => {
    const calls: string[] = []
    const config = h.testConfig({
      providers: [
        h.oauthProvider({ id: "alpha", checks: ["state"] }, calls),
        h.oauthProvider({ id: "beta", checks: ["state"] }, calls),
      ],
    })
    const start = await h.signIn(config, "alpha")
    const state = h.locationOf(start)!.searchParams.get("state")!

    const response = await h.callback(config, "beta", {
      cookies: h.cookiesOf(start),
      query: { state, code: "attacker-code" },
    })

    expect(response.status).toBeLessThan(500)
    expect(h.hasSession(response)).toBe(false)
    expect(calls.filter((url) => url.includes("beta.example"))).toEqual([])
  })

  it("rejects a state value saved before the provider was recorded", async () => {
    const calls: string[] = []
    const config = h.testConfig({
      providers: [
        h.oauthProvider({ id: "alpha", checks: ["state"] }, calls),
        h.oauthProvider({ id: "beta", checks: ["state"] }, calls),
      ],
    })
    // Same provider, same cookie the product itself uses; only the saved value predates the
    // record of which provider stored it.
    const start = await h.signIn(config, "beta")
    const state = h.locationOf(start)!.searchParams.get("state")!
    const savedCookies = h.cookiesOf(start)
    const name = nameWithoutCallbackUrl(savedCookies)
    const legacy = await h.seal({ value: state }, name)

    const response = await h.callback(config, "beta", {
      cookies: { [name]: legacy },
      query: { state, code: "attacker-code" },
    })

    expect(response.status).toBeLessThan(500)
    expect(h.hasSession(response)).toBe(false)
    expect(calls.filter((url) => url.includes("beta.example"))).toEqual([])
  })
})

describe("OAuth PKCE verifier is bound to its provider", () => {
  it("rejects a PKCE cookie minted for another provider", async () => {
    const calls: string[] = []
    const config = h.testConfig({
      providers: [
        h.oauthProvider({ id: "alpha", checks: ["pkce"] }, calls),
        h.oauthProvider({ id: "beta", checks: ["pkce"] }, calls),
      ],
    })
    const start = await h.signIn(config, "alpha")

    const response = await h.callback(config, "beta", {
      cookies: h.cookiesOf(start),
      query: { code: "attacker-code" },
    })

    expect(response.status).toBeLessThan(500)
    expect(h.hasSession(response)).toBe(false)
    expect(calls.filter((url) => url.includes("beta.example"))).toEqual([])
  })

  it("rejects a verifier saved before the provider was recorded", async () => {
    const calls: string[] = []
    const config = h.testConfig({
      providers: [
        h.oauthProvider({ id: "alpha", checks: ["pkce"] }, calls),
        h.oauthProvider({ id: "beta", checks: ["pkce"] }, calls),
      ],
    })
    const start = await h.signIn(config, "beta")
    const name = nameWithoutCallbackUrl(h.cookiesOf(start))
    const legacy = await h.seal({ value: "legacy-verifier" }, name)

    const response = await h.callback(config, "beta", {
      cookies: { [name]: legacy },
      query: { code: "attacker-code" },
    })

    expect(response.status).toBeLessThan(500)
    expect(h.hasSession(response)).toBe(false)
    expect(calls.filter((url) => url.includes("beta.example"))).toEqual([])
  })
})

describe("OIDC nonce is bound to its provider", () => {
  it("rejects a nonce cookie minted for another provider", async () => {
    const calls: string[] = []
    const nonces: Record<string, string> = {}
    const config = h.testConfig({
      providers: [
        h.oidcProvider({ id: "alpha", checks: ["nonce"], nonces }, calls),
        h.oidcProvider({ id: "beta", checks: ["nonce"], nonces }, calls),
      ],
    })
    const start = await h.signIn(config, "alpha")
    // The beta authorization server echoes the nonce it was handed.
    nonces.beta = h.locationOf(start)!.searchParams.get("nonce")!

    const response = await h.callback(config, "beta", {
      cookies: h.cookiesOf(start),
      query: { code: "attacker-code" },
    })

    expect(response.status).toBeLessThan(500)
    expect(h.hasSession(response)).toBe(false)
  })

  it("rejects a nonce saved before the provider was recorded", async () => {
    const calls: string[] = []
    const nonces: Record<string, string> = {}
    const config = h.testConfig({
      providers: [
        h.oidcProvider({ id: "alpha", checks: ["nonce"], nonces }, calls),
        h.oidcProvider({ id: "beta", checks: ["nonce"], nonces }, calls),
      ],
    })
    const start = await h.signIn(config, "beta")
    const name = nameWithoutCallbackUrl(h.cookiesOf(start))
    nonces.beta = "legacy-nonce"
    const legacy = await h.seal({ value: "legacy-nonce" }, name)

    const response = await h.callback(config, "beta", {
      cookies: { [name]: legacy },
      query: { code: "attacker-code" },
    })

    expect(response.status).toBeLessThan(500)
    expect(h.hasSession(response)).toBe(false)
  })
})
