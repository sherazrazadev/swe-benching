// Functional cases: legitimate behaviour that must keep working, including the
// values coupled to the cache identity (data cache sharing, image caching and
// ordinary revalidation).

function expectRoute(context, response, route) {
  context.assert(
    response.status === 200,
    `expected a 200 response, got ${response.status}`
  )
  const state = context.routeState(response)
  context.assert(
    state.route === route,
    `expected the response produced by "${route}", got "${state.route}"`
  )
  return state
}

export const cases = [
  {
    name: 'a prerendered page is served and then reused',
    fixture: 'base',
    async run(context) {
      const first = expectRoute(context, await context.get('/victim/known'), 'victim')
      const second = expectRoute(context, await context.get('/victim/known'), 'victim')
      context.assert(
        first.generation === second.generation,
        'the second request must reuse the cached response'
      )
    },
  },
  {
    name: 'a runtime rendered page is cached',
    fixture: 'base',
    async run(context) {
      const first = expectRoute(context, await context.get('/victim/f-hit-1'), 'victim')
      const second = expectRoute(context, await context.get('/victim/f-hit-1'), 'victim')
      context.assert(
        first.generation === second.generation,
        'the second request must reuse the cached response'
      )
    },
  },
  {
    name: 'a page revalidates on its own schedule',
    fixture: 'base',
    async run(context) {
      const first = expectRoute(context, await context.get('/victim/fast-1'), 'victim')
      const changed = await context.waitFor(
        'the page to revalidate',
        async () => {
          const next = await context.get('/victim/fast-1')
          if (next.status !== 200) return false
          const state = context.routeState(next)
          return state.route === 'victim' && state.generation !== first.generation
            ? state
            : false
        },
        12000
      )
      context.assert(changed, 'the page never revalidated')
    },
  },
  {
    name: 'the data request of a page serves the same page',
    fixture: 'base',
    async run(context) {
      expectRoute(context, await context.get('/victim/known'), 'victim')
      const data = await context.get(
        `/_next/data/${context.buildId()}/victim/known.json`
      )
      context.assert(data.status === 200, `data request failed: ${data.status}`)
      const payload = JSON.parse(data.body)
      context.assert(
        payload.pageProps && payload.pageProps.route === 'victim',
        'the data request must serve the page it belongs to'
      )
    },
  },
  {
    name: 'the data cache is shared across pages by request URL',
    fixture: 'base',
    async run(context) {
      const a = expectRoute(context, await context.get('/data-a/shares-1'), 'data-a')
      const b = expectRoute(context, await context.get('/data-b/shares-1'), 'data-b')
      context.assert(
        a.count === b.count,
        `the shared data cache was not reused (${a.count} vs ${b.count})`
      )
    },
  },
  {
    name: 'app pages and route handlers respond and cache',
    fixture: 'base',
    async run(context) {
      expectRoute(context, await context.get('/app-victim/known'), 'app-victim')
      const first = expectRoute(context, await context.get('/api/victim/known'), 'route-victim')
      const second = expectRoute(context, await context.get('/api/victim/known'), 'route-victim')
      context.assert(
        JSON.stringify(first) === JSON.stringify(second),
        'the route handler response must stay stable'
      )
      expectRoute(context, await context.get('/app-victim/vendor/known'), 'app-vendor')
    },
  },
  {
    name: 'a fallback page renders and is then cached',
    fixture: 'base',
    async run(context) {
      const first = expectRoute(context, await context.get('/victim/f-fallback-1'), 'victim')
      const second = expectRoute(context, await context.get('/victim/f-fallback-1'), 'victim')
      context.assert(
        first.generation === second.generation,
        'the fallback render must be cached'
      )
    },
  },
  {
    name: 'a catch-all page keeps rendering arbitrary paths',
    fixture: 'base',
    async run(context) {
      expectRoute(context, await context.get('/anything/here'), 'pages-catchall')
      expectRoute(context, await context.get('/other/deep/path'), 'pages-catchall')
    },
  },
  {
    name: 'a configured cache handler keeps caching pages',
    fixture: 'base',
    overlay: 'handler-overlay',
    async run(context) {
      const first = expectRoute(context, await context.get('/victim/h-func-1'), 'victim')
      const second = expectRoute(context, await context.get('/victim/h-func-1'), 'victim')
      context.assert(
        first.generation === second.generation,
        'the custom handler must serve the cached response'
      )
      const fs = await import('node:fs')
      const path = await import('node:path')
      const operations = fs
        .readFileSync(path.join(context.appDir, 'cache-operations.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      context.assert(
        operations.some((operation) => operation.operation === 'set'),
        'the custom handler received no write'
      )
      context.assert(
        operations.some((operation) => operation.operation === 'get'),
        'the custom handler received no read'
      )
    },
  },
  {
    name: 'image optimization works with a configured cache handler',
    fixture: 'base',
    overlay: 'handler-overlay',
    async run(context) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await context.get('/_next/image?url=%2Fplain.png&w=64&q=75')
        context.assert(
          response.status === 200,
          `image optimization failed with ${response.status}`
        )
        context.assert(
          (response.headers['content-type'] || '').includes('image/png'),
          `unexpected image content type: ${response.headers['content-type']}`
        )
      }
    },
  },
]
