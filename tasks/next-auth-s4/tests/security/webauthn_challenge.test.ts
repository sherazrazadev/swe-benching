import { describe, expect, it } from "vitest"

import * as h from "../support/harness.js"

/**
 * A WebAuthn challenge is stored in the browser while the browser talks to the authenticator
 * and is read back on the callback. Like the OAuth checks it is minted for the provider handling
 * the flow; a challenge minted for one provider must not be accepted by another provider's
 * callback.
 *
 * The test replays exactly the cookies the real options response set, so it does not depend on
 * any particular cookie name.
 */

function webauthnConfig(adapter: h.MemoryAdapter) {
  return h.testConfig({
    adapter,
    experimental: { enableWebAuthn: true },
    providers: [
      h.webauthnProvider("wa", true),
      h.webauthnProvider("wb", true),
    ],
  } as any)
}

async function challengeCookies(config: any, provider: string) {
  const options = await h.call(config, `/auth/webauthn-options/${provider}`, {
    query: { action: "register", email: "new@example.com" },
  })
  expect(options.status).toBe(200)
  const cookies = h.cookiesOf(options)
  expect(Object.keys(cookies).length).toBeGreaterThan(0)
  return cookies
}

function registrationBody() {
  return {
    action: "register",
    data: JSON.stringify({
      id: Buffer.from([1, 2, 3, 4]).toString("base64"),
      rawId: "",
      type: "public-key",
      response: { clientDataJSON: "", attestationObject: "" },
    }),
  }
}

describe("WebAuthn challenge is bound to its provider", () => {
  it("rejects a challenge minted for another provider", async () => {
    const adapter = h.memoryAdapter()
    const config = webauthnConfig(adapter)
    const cookies = await challengeCookies(config, "wa")

    const response = await h.callback(config, "wb", {
      cookies,
      body: registrationBody(),
    })

    expect(response.status).toBeLessThan(500)
    expect(h.hasSession(response)).toBe(false)
    expect(adapter._createdUsers).toBe(0)
    expect(adapter._accounts).toEqual([])
  })
})
