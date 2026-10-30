/*
 * Assertion helpers for the hidden suites. Values are computed here and never
 * taken from product code, so a hardened library cannot change what the tests
 * expect.
 */

export const APP_ORIGIN = 'https://app.test'

export type ConfinedExpectation = {
  /** Origin the generated URL must resolve to */
  origin?: string
  /** Number of path segments the URL must have (the value fills exactly one) */
  segments: number
  /** Query parameter names the URL must have, sorted */
  params?: string[]
}

export function inspect(url: string, base: string = APP_ORIGIN) {
  const parsed = new URL(url, `${base}/`)
  return {
    href: parsed.href,
    origin: parsed.origin,
    segments: parsed.pathname === '/' ? [] : parsed.pathname.replace(/^\//, '').split('/'),
    params: [...parsed.searchParams.keys()].sort(),
    hash: parsed.hash,
  }
}

/**
 * Asserts that the generated URL still points at the application origin and
 * that the parameter value did not add path, query or fragment structure.
 */
export function assertConfined(
  assert: any,
  url: string | undefined,
  expected: ConfinedExpectation,
  base: string = APP_ORIGIN
) {
  assert.isString(url, 'expected a generated URL')
  const found = inspect(url!, base)

  assert.equal(
    found.origin,
    expected.origin ?? new URL(`${base}/`).origin,
    `URL "${url}" does not point at the application origin (resolved ${found.href})`
  )
  assert.equal(found.hash, '', `URL "${url}" gained a fragment`)
  assert.deepEqual(
    found.params,
    expected.params ?? [],
    `URL "${url}" gained query parameters from a route parameter value`
  )
  assert.lengthOf(
    found.segments,
    expected.segments,
    `URL "${url}" was split into ${found.segments.length} path segments, expected ${expected.segments}`
  )
}
