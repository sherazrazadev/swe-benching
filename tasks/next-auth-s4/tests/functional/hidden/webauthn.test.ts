import { describe, expect, it } from "vitest"

import * as h from "../support/harness.js"

/** A normal WebAuthn registration with the provider that issued the challenge keeps working. */

describe("same-provider WebAuthn registration", () => {
  it("completes registration and signs the new user in", async () => {
    const adapter = h.memoryAdapter()
    const config = h.testConfig({
      adapter,
      experimental: { enableWebAuthn: true },
      providers: [
        h.webauthnProvider("wa", true),
        h.webauthnProvider("wb", true),
      ],
    } as any)

    const options = await h.call(config, "/auth/webauthn-options/wa", {
      query: { action: "register", email: "new@example.com" },
    })
    expect(options.status).toBe(200)

    const response = await h.callback(config, "wa", {
      cookies: h.cookiesOf(options),
      body: {
        action: "register",
        data: JSON.stringify({
          id: Buffer.from([1, 2, 3, 4]).toString("base64"),
          rawId: "",
          type: "public-key",
          response: { clientDataJSON: "", attestationObject: "" },
        }),
      },
    })

    expect(h.hasSession(response)).toBe(true)
    expect(adapter._createdUsers).toBe(1)
    expect(adapter._accounts).toHaveLength(1)
    expect(adapter._accounts[0].provider).toBe("wa")
  })
})
