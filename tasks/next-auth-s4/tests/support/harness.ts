/**
 * Test harness for the next-auth / @auth/core task. Everything here drives the product through
 * its real entry point: the `Auth(request, config)` handler receives ordinary web `Request`
 * objects for the sign-in, callback and webauthn-options actions, and the OAuth/OpenID provider
 * endpoints are answered by an in-process stub installed through the product's `customFetch`
 * symbol. No network is used.
 */
import { hkdf } from "@panva/hkdf"
import { EncryptJWT, base64url, calculateJwkThumbprint } from "jose"

import { Auth, customFetch, skipCSRFCheck } from "../../src/index.js"
import type { AuthConfig } from "../../src/index.js"

export const BASE_URL = "https://authjs.test"
export const SECRET = "next-auth-s4-harness-secret"
export const SESSION_COOKIE = "__Secure-authjs.session-token"
export const STATE_COOKIE = "__Secure-authjs.state"
export const NONCE_COOKIE = "__Secure-authjs.nonce"
export const PKCE_COOKIE = "__Secure-authjs.pkce.code_verifier"
export const CHALLENGE_COOKIE = "__Secure-authjs.challenge"
export const LINK_INTENT_COOKIE = "__Secure-authjs.link-intent"

type Json = Record<string, any>

export interface Reply {
  status: number
  location: string | null
  cookies: Record<string, string>
  body: any
}

export interface ProviderSpec {
  id: string
  /** "state" | "pkce" | "nonce" */
  checks: string[]
  /** Values the provider's token endpoint should echo into the id_token. */
  nonces?: Record<string, string>
  profile?: Json
}

function json(body: Json): Response {
  return Response.json(body, { headers: { "content-type": "application/json" } })
}

function b64url(value: Json): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

/** An unsigned OIDC id_token carrying `nonce`; Auth.js trusts the token endpoint response. */
function idToken(spec: ProviderSpec): string {
  const claims = {
    iss: `https://${spec.id}.example`,
    aud: `${spec.id}-client`,
    sub: `${spec.id}-user`,
    name: `${spec.id} user`,
    email: `${spec.id}@example.com`,
    nonce: spec.nonces?.[spec.id],
    exp: Math.floor(Date.now() / 1000) + 600,
    iat: Math.floor(Date.now() / 1000),
  }
  return `${b64url({ alg: "none", typ: "JWT" })}.${b64url(claims)}.`
}

function fetchStub(spec: ProviderSpec, calls: string[]): typeof fetch {
  return (async (input: any) => {
    const url = typeof input === "string" ? input : input.url
    calls.push(url)
    if (url.includes("/token")) {
      if (spec.checks.includes("nonce")) {
        return json({
          access_token: `access-${spec.id}`,
          token_type: "bearer",
          id_token: idToken(spec),
        })
      }
      return json({
        access_token: `access-${spec.id}`,
        token_type: "bearer",
        scope: "read",
      })
    }
    if (url.includes("/userinfo")) {
      return json(
        spec.profile ?? {
          id: `${spec.id}-user`,
          name: `${spec.id} user`,
          email: `${spec.id}@example.com`,
        }
      )
    }
    return new Response("not found", { status: 404 })
  }) as typeof fetch
}

export function oauthProvider(spec: ProviderSpec, calls: string[]): any {
  return {
    id: spec.id,
    name: spec.id,
    type: "oauth",
    clientId: `${spec.id}-client`,
    clientSecret: `${spec.id}-secret`,
    authorization: {
      url: `https://${spec.id}.example/authorize`,
      params: { scope: "read" },
    },
    token: { url: `https://${spec.id}.example/token` },
    userinfo: { url: `https://${spec.id}.example/userinfo` },
    checks: spec.checks,
    profile(profile: any) {
      return { id: profile.id, name: profile.name, email: profile.email }
    },
    [customFetch]: fetchStub(spec, calls),
  }
}

export function oidcProvider(spec: ProviderSpec, calls: string[]): any {
  return {
    id: spec.id,
    name: spec.id,
    type: "oidc",
    clientId: `${spec.id}-client`,
    clientSecret: `${spec.id}-secret`,
    issuer: `https://${spec.id}.example`,
    authorization: {
      url: `https://${spec.id}.example/authorize`,
      params: { scope: "openid" },
    },
    token: { url: `https://${spec.id}.example/token` },
    userinfo: { url: `https://${spec.id}.example/userinfo` },
    checks: spec.checks,
    // The stub token endpoint is the trusted TLS channel; the test only needs the claim set.
    client: { id_token_signed_response_alg: "none" },
    profile(profile: any) {
      return { id: profile.sub, name: profile.name, email: profile.email }
    },
    [customFetch]: fetchStub(spec, calls),
  }
}

/** A WebAuthn provider whose authenticator/verifier are deterministic stubs. */
export function webauthnProvider(id: string, verified: boolean): any {
  return {
    id,
    name: id,
    type: "webauthn",
    relayingParty: { id: "authjs.test", name: "authjs.test", origin: BASE_URL },
    getUserInfo: async (_options: any, request: any) => {
      const email = request.query?.email ?? request.body?.email
      return typeof email === "string" ? { user: { email }, exists: false } : null
    },
    getRelayingParty: () => ({
      id: "authjs.test",
      name: "authjs.test",
      origin: BASE_URL,
    }),
    simpleWebAuthn: {
      generateRegistrationOptions: async (opts: any) => ({
        challenge: `challenge-${id}`,
        rp: { id: "authjs.test", name: "authjs.test" },
        user: { id: "user", name: opts.userName, displayName: opts.userName },
        pubKeyCredParams: [],
        timeout: 60000,
        attestation: "none",
        excludeCredentials: [],
        authenticatorSelection: {},
      }),
      generateAuthenticationOptions: async () => ({
        challenge: `challenge-${id}`,
        rpId: "authjs.test",
        timeout: 60000,
        allowCredentials: [],
      }),
      verifyRegistrationResponse: async () => {
        if (!verified) throw new Error("registration verification failed")
        return {
          verified: true,
          registrationInfo: {
            credentialID: new Uint8Array([1, 2, 3, 4]),
            credentialPublicKey: new Uint8Array([5, 6, 7, 8]),
            counter: 0,
            credentialDeviceType: "singleDevice",
            credentialBackedUp: false,
            origin: BASE_URL,
            rpID: "authjs.test",
          },
        }
      },
      verifyAuthenticationResponse: async () => ({
        verified,
        authenticationInfo: { newCounter: 1 },
      }),
    },
  }
}

export interface MemoryAdapter {
  _users: Json[]
  _accounts: Json[]
  _createdUsers: number
  [k: string]: any
}

/** A tiny in-memory adapter that records the account-linking side effects. */
export function memoryAdapter(seedUsers: Json[] = []): MemoryAdapter {
  const users: Json[] = seedUsers.map((u) => ({ ...u }))
  const accounts: Json[] = []
  const adapter: any = {
    _users: users,
    _accounts: accounts,
    _createdUsers: 0,
    createUser: async (user: Json) => {
      adapter._createdUsers += 1
      const created = { ...user, id: crypto.randomUUID() }
      users.push(created)
      return created
    },
    getUser: async (id: string) => users.find((u) => u.id === id) ?? null,
    getUserByEmail: async (email: string) =>
      users.find((u) => u.email === email) ?? null,
    getUserByAccount: async ({ providerAccountId, provider }: Json) => {
      const account = accounts.find(
        (a) =>
          a.providerAccountId === providerAccountId && a.provider === provider
      )
      if (!account) return null
      return users.find((u) => u.id === account.userId) ?? null
    },
    linkAccount: async (account: Json) => {
      accounts.push({ ...account })
      return account
    },
    createSession: async () => ({}),
    getSessionAndUser: async () => null,
    updateSession: async () => null,
    deleteSession: async () => null,
    updateUser: async (user: Json) => user,
    deleteUser: async () => undefined,
    unlinkAccount: async () => undefined,
    createVerificationToken: async () => undefined,
    useVerificationToken: async () => null,
    createAuthenticator: async () => undefined,
    listAuthenticatorsByUserId: async () => [],
    getAuthenticator: async () => null,
    updateAuthenticatorCounter: async () => undefined,
    getAccount: async () => null,
  }
  return adapter
}

export function testConfig(overrides: Partial<AuthConfig> = {}): AuthConfig {
  return {
    secret: SECRET,
    trustHost: true,
    basePath: "/auth",
    skipCSRFCheck,
    session: { strategy: "jwt" },
    ...overrides,
  } as AuthConfig
}

export interface RequestOptions {
  method?: "GET" | "POST"
  cookies?: Record<string, string | undefined>
  query?: Record<string, string>
  body?: Record<string, string>
  host?: string
}

export async function call(
  config: AuthConfig,
  path: string,
  options: RequestOptions = {}
): Promise<Response> {
  const {
    method = options.body ? "POST" : "GET",
    cookies = {},
    query,
    body,
    host = "authjs.test",
  } = options
  const url = new URL(path, `https://${host}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value)
  }
  const headers = new Headers({ host })
  const cookieHeader = Object.entries(cookies)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ")
  if (cookieHeader) headers.set("cookie", cookieHeader)
  let payload: string | undefined
  if (body) {
    headers.set("content-type", "application/x-www-form-urlencoded")
    payload = new URLSearchParams(body).toString()
  }
  return (await Auth(
    new Request(url, { method, headers, body: payload }),
    config
  )) as Response
}

export function cookiesOf(response: Response): Record<string, string> {
  const out: Record<string, string> = {}
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(";")[0]
    const index = pair.indexOf("=")
    if (index > 0) out[pair.slice(0, index)] = pair.slice(index + 1)
  }
  return out
}

export function locationOf(response: Response): URL | null {
  const location = response.headers.get("location")
  return location ? new URL(location) : null
}

export async function reply(response: Response): Promise<Reply> {
  let body: any = undefined
  const text = await response.clone().text()
  try {
    body = text ? JSON.parse(text) : undefined
  } catch {
    body = text
  }
  return {
    status: response.status,
    location: response.headers.get("location"),
    cookies: cookiesOf(response),
    body,
  }
}

/**
 * Seals `payload` exactly the way the product's JWT helpers do, using the independent `jose`
 * library so a hardened product helper cannot change what a test fixture means.
 */
export async function seal(
  payload: Json,
  salt: string,
  secret: string = SECRET,
  maxAge = 900
): Promise<string> {
  const key = await hkdf(
    "sha256",
    secret,
    salt,
    `Auth.js Generated Encryption Key (${salt})`,
    64
  )
  const kid = await calculateJwkThumbprint(
    { kty: "oct", k: base64url.encode(key) },
    `sha${key.byteLength << 3}` as any
  )
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256CBC-HS512", kid })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAge)
    .setJti(crypto.randomUUID())
    .encrypt(key)
}

/** A session JWT for `userId`, as the product's session cookie would carry one. */
export function sessionCookie(userId: string, name = "Victim"): Promise<string> {
  return seal(
    { sub: userId, name, email: `${userId}@example.com` },
    SESSION_COOKIE
  )
}

/** Starts an OAuth sign-in through the real action and returns its reply. */
export function signIn(
  config: AuthConfig,
  providerId: string,
  options: RequestOptions = {}
): Promise<Response> {
  return call(config, `/auth/signin/${providerId}`, {
    ...options,
    body: options.body ?? {},
  })
}

/** Reaches the callback action for `providerId` through the real action. */
export function callback(
  config: AuthConfig,
  providerId: string,
  options: RequestOptions = {}
): Promise<Response> {
  return call(config, `/auth/callback/${providerId}`, options)
}

export function hasSession(response: Response): boolean {
  return SESSION_COOKIE in cookiesOf(response)
}

export async function sessionFor(response: Response): Promise<Json | null> {
  const token = cookiesOf(response)[SESSION_COOKIE]
  if (!token) return null
  const { jwtDecrypt } = await import("jose")
  const key = await hkdf(
    "sha256",
    SECRET,
    SESSION_COOKIE,
    `Auth.js Generated Encryption Key (${SESSION_COOKIE})`,
    64
  )
  const { payload } = await jwtDecrypt(token, key)
  return payload as Json
}
