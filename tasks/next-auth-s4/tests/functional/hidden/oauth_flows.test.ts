import { describe, expect, it } from "vitest"

import * as h from "../support/harness.js"

/**
 * The behaviour that must keep working: a user who starts a sign-in with a provider can finish
 * it with that same provider, and the redirect-proxy hop keeps forwarding a callback to the app
 * that started the sign-in without needing any browser cookie of its own.
 */

describe("same-provider OAuth sign-in", () => {
  it("completes when the state and PKCE cookies belong to the provider handling the callback", async () => {
    const calls: string[] = []
    const config = h.testConfig({
      providers: [
        h.oauthProvider({ id: "alpha", checks: ["state", "pkce"] }, calls),
        h.oauthProvider({ id: "beta", checks: ["state", "pkce"] }, calls),
      ],
    })
    const start = await h.signIn(config, "alpha")
    const state = h.locationOf(start)!.searchParams.get("state")!

    const response = await h.callback(config, "alpha", {
      cookies: h.cookiesOf(start),
      query: { state, code: "legit-code" },
    })

    expect(h.hasSession(response)).toBe(true)
    expect(calls.some((url) => url.includes("alpha.example/token"))).toBe(true)
  })

  it("completes an OIDC sign-in with the nonce the provider issued", async () => {
    const calls: string[] = []
    const nonces: Record<string, string> = {}
    const config = h.testConfig({
      providers: [
        h.oidcProvider({ id: "alpha", checks: ["nonce"], nonces }, calls),
        h.oidcProvider({ id: "beta", checks: ["nonce"], nonces }, calls),
      ],
    })
    const start = await h.signIn(config, "alpha")
    nonces.alpha = h.locationOf(start)!.searchParams.get("nonce")!

    const response = await h.callback(config, "alpha", {
      cookies: h.cookiesOf(start),
      query: { code: "legit-code" },
    })

    expect(h.hasSession(response)).toBe(true)
  })
})

describe("redirect proxy hop", () => {
  it("forwards a callback to the app that started the sign-in, without browser cookies", async () => {
    const origin = "https://origin.example.com/auth/callback/github"
    const config = h.testConfig({
      redirectProxyUrl: "https://login.example.com",
      providers: [h.oauthProvider({ id: "github", checks: ["state"] }, [])],
    })
    // The proxy only has the state value from the authorization response; it decrypts it with
    // the shared secret to find the origin callback.
    const state = await h.seal(
      { origin, random: "proxy-random" },
      "encodedState"
    )

    const response = await h.call(config, "/auth/callback/github", {
      host: "login.example.com",
      query: { state, code: "legit-code" },
    })

    const location = h.locationOf(response)
    expect(response.status).toBe(302)
    expect(location?.origin).toBe("https://origin.example.com")
    expect(location?.pathname).toBe("/auth/callback/github")
    expect(location?.searchParams.get("code")).toBe("legit-code")
  })
})
