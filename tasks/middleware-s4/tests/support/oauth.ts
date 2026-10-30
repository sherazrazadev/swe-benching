import { Hono } from 'hono'
import { googleAuth } from '../../packages/oauth-providers/src/providers/google'
import { facebookAuth } from '../../packages/oauth-providers/src/providers/facebook'
import { githubAuth } from '../../packages/oauth-providers/src/providers/github'
import { linkedinAuth } from '../../packages/oauth-providers/src/providers/linkedin'
import { discordAuth } from '../../packages/oauth-providers/src/providers/discord'
import { twitchAuth } from '../../packages/oauth-providers/src/providers/twitch'
import { msentraAuth } from '../../packages/oauth-providers/src/providers/msentra'
import { xAuth } from '../../packages/oauth-providers/src/providers/x'

export const clientId = 'test-client-id'
export const clientSecret = 'test-client-secret'
export const code = 'test-code'
export const state = 'browser-state-1'

export type Provider =
  | 'google'
  | 'facebook'
  | 'github'
  | 'github-oauth-app'
  | 'linkedin'
  | 'discord'
  | 'twitch'
  | 'msentra'
  | 'x'

const paths: Record<Provider, string> = {
  google: '/google',
  facebook: '/facebook',
  github: '/github/app',
  'github-oauth-app': '/github/oauth-app',
  linkedin: '/linkedin',
  discord: '/discord',
  twitch: '/twitch',
  msentra: '/msentra',
  x: '/x',
}

const userKeys: Record<Provider, string> = {
  google: 'user-google',
  facebook: 'user-facebook',
  github: 'user-github',
  'github-oauth-app': 'user-github',
  linkedin: 'user-linkedin',
  discord: 'user-discord',
  twitch: 'user-twitch',
  msentra: 'user-msentra',
  x: 'user-x',
}

export const providerNames: Provider[] = [
  'google',
  'facebook',
  'github',
  'github-oauth-app',
  'linkedin',
  'discord',
  'twitch',
  'msentra',
  'x',
]

function middleware(provider: Provider, opts: Record<string, unknown>) {
  switch (provider) {
    case 'google':
      return googleAuth({
        client_id: clientId,
        client_secret: clientSecret,
        scope: ['openid', 'email', 'profile'],
        ...opts,
      } as never)
    case 'facebook':
      return facebookAuth({
        client_id: clientId,
        client_secret: clientSecret,
        scope: ['email', 'public_profile'],
        fields: ['id', 'name', 'email'],
        ...opts,
      } as never)
    case 'github':
      return githubAuth({
        client_id: clientId,
        client_secret: clientSecret,
        scope: ['user'],
        ...opts,
      } as never)
    case 'github-oauth-app':
      return githubAuth({
        client_id: clientId,
        client_secret: clientSecret,
        scope: ['user'],
        oauthApp: true,
        ...opts,
      } as never)
    case 'linkedin':
      return linkedinAuth({
        client_id: clientId,
        client_secret: clientSecret,
        scope: ['openid', 'profile', 'email'],
        ...opts,
      } as never)
    case 'discord':
      return discordAuth({
        client_id: clientId,
        client_secret: clientSecret,
        scope: ['identify', 'email'],
        ...opts,
      } as never)
    case 'twitch':
      return twitchAuth({
        client_id: clientId,
        client_secret: clientSecret,
        scope: ['user:read:email'],
        ...opts,
      } as never)
    case 'msentra':
      return msentraAuth({
        client_id: clientId,
        client_secret: clientSecret,
        tenant_id: 'test-tenant',
        scope: ['openid', 'email'],
        ...opts,
      } as never)
    case 'x':
      return xAuth({
        client_id: clientId,
        client_secret: clientSecret,
        scope: ['tweet.read', 'users.read'],
        ...opts,
      } as never)
  }
}

export type Mounted = {
  app: Hono
  ran: () => boolean
  body: () => Record<string, unknown> | undefined
  path: string
}

/** Mount one provider middleware on a real Hono app with a terminal route that
 *  records whether the sign-in completed and what account it exposed. */
export function mount(provider: Provider, opts: Record<string, unknown> = {}): Mounted {
  const app = new Hono()
  const path = paths[provider]
  let ran = false
  let body: Record<string, unknown> | undefined
  app.use(path, middleware(provider, opts))
  app.get(path, (c) => {
    ran = true
    body = {
      user: c.get(userKeys[provider] as never) as unknown,
      token: c.get('token') as unknown,
    }
    return c.json(body as never)
  })
  return { app, ran: () => ran, body: () => body, path }
}

export const fixtures = {
  googleToken: {
    access_token: 'access-token-google',
    expires_in: 3600,
    scope: 'openid email profile',
    refresh_token: 'refresh-token-google',
    refresh_token_expires_in: 7200,
  },
  googleUser: { id: 'google-user-1', email: 'g@example.com', name: 'Google User' },
  facebookToken: { access_token: 'access-token-facebook', expires_in: 3600 },
  facebookUser: { id: 'facebook-user-1', name: 'Facebook User', email: 'f@example.com' },
  githubToken: {
    access_token: 'access-token-github',
    expires_in: 3600,
    scope: 'user,public_repo',
    refresh_token: 'refresh-token-github',
    refresh_token_expires_in: 7200,
  },
  githubUser: { login: 'github-user-1', id: 4242, email: 'gh@example.com' },
  githubEmails: [{ email: 'gh@example.com', primary: true, verified: true }],
  linkedinToken: {
    access_token: 'access-token-linkedin',
    expires_in: 3600,
    scope: 'openid,profile,email',
    refresh_token: 'refresh-token-linkedin',
    refresh_token_expires_in: 7200,
  },
  linkedinUser: { sub: 'linkedin-user-1', name: 'LinkedIn User', email: 'li@example.com' },
  discordToken: {
    access_token: 'access-token-discord',
    expires_in: 7200,
    scope: 'identify email',
    refresh_token: 'refresh-token-discord',
  },
  discordUser: { user: { id: 'discord-user-1', username: 'discord-user' } },
  twitchToken: {
    access_token: 'access-token-twitch',
    expires_in: 3600,
    scope: ['user:read:email'],
    refresh_token: 'refresh-token-twitch',
  },
  twitchUser: { data: [{ id: 'twitch-user-1', login: 'twitch-user' }] },
  msentraToken: {
    access_token: 'access-token-msentra',
    expires_in: 3600,
    scope: 'openid email',
    refresh_token: 'refresh-token-msentra',
  },
  msentraUser: { id: 'msentra-user-1', displayName: 'Entra User', mail: 'm@example.com' },
  xToken: {
    access_token: 'access-token-x',
    expires_in: 7200,
    scope: 'tweet.read users.read',
    refresh_token: 'refresh-token-x',
  },
  xUser: { data: { id: 'x-user-1', username: 'x-user', name: 'X User' } },
}

const originalFetch = globalThis.fetch

/** Replace the provider network with a per-endpoint success stub. Returns the
 *  list of requests the product attempted, so a refusal can be checked for
 *  having contacted the provider at all. */
export function stubProviderFetch(): string[] {
  const calls: string[] = []
  const json = (value: unknown) =>
    new Response(JSON.stringify(value), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  globalThis.fetch = (async (input: unknown, init?: { method?: string }) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : String((input as { url: string }).url)
    const method = (init?.method ?? 'GET').toUpperCase()
    calls.push(`${method} ${url}`)
    const u = url
    if (u.startsWith('https://oauth2.googleapis.com/token')) return json(fixtures.googleToken)
    if (u.startsWith('https://www.googleapis.com/oauth2/v2/userinfo')) return json(fixtures.googleUser)
    if (u.startsWith('https://graph.facebook.com/v18.0/oauth/access_token'))
      return json(fixtures.facebookToken)
    if (u.startsWith('https://graph.facebook.com/v18.0/me')) return json({ id: fixtures.facebookUser.id })
    if (u.startsWith('https://graph.facebook.com/')) return json(fixtures.facebookUser)
    if (u.startsWith('https://github.com/login/oauth/access_token')) return json(fixtures.githubToken)
    if (u.startsWith('https://api.github.com/user/emails')) return json(fixtures.githubEmails)
    if (u.startsWith('https://api.github.com/user')) return json(fixtures.githubUser)
    if (u.startsWith('https://www.linkedin.com/oauth/v2/accessToken'))
      return json(fixtures.linkedinToken)
    if (u.startsWith('https://api.linkedin.com/v2/userinfo')) return json(fixtures.linkedinUser)
    if (u.startsWith('https://api.twitter.com/2/oauth2/token')) return json(fixtures.xToken)
    if (u.startsWith('https://api.twitter.com/2/users/me')) return json(fixtures.xUser)
    if (u.startsWith('https://discord.com/api/oauth2/token')) return json(fixtures.discordToken)
    if (u.startsWith('https://discord.com/api/oauth2/@me')) return json(fixtures.discordUser)
    if (u.startsWith('https://id.twitch.tv/oauth2/token')) return json(fixtures.twitchToken)
    if (u.startsWith('https://api.twitch.tv/helix/users')) return json(fixtures.twitchUser)
    if (u.includes('/oauth2/v2.0/token')) return json(fixtures.msentraToken)
    if (u.startsWith('https://graph.microsoft.com/v1.0/me')) return json(fixtures.msentraUser)
    return new Response('{"error":"unexpected-provider-request"}', {
      status: 404,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
  return calls
}

export function restoreProviderFetch(): void {
  globalThis.fetch = originalFetch
}

/** Expected signed-in account marker for each provider's successful callback. */
export const expectedUser: Record<Provider, Record<string, unknown>> = {
  google: fixtures.googleUser,
  facebook: fixtures.facebookUser,
  github: fixtures.githubUser,
  'github-oauth-app': fixtures.githubUser,
  linkedin: fixtures.linkedinUser,
  discord: fixtures.discordUser.user,
  twitch: fixtures.twitchUser.data[0],
  msentra: fixtures.msentraUser,
  x: fixtures.xUser.data,
}

/** The cookie header that carries the state value issued at login start. */
export function stateCookie(value: string = state): string {
  return `state=${value}`
}
