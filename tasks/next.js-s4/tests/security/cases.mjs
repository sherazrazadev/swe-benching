// Security cases: every case drives the real HTTP server of a fixture app.
// Each case uses its own request paths so cases do not share cached state.

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
    name: 'a catch-all page cannot read a sibling page prerendered entry',
    fixture: 'base',
    async run(context) {
      const alias = await context.get('/%76ictim/known')
      expectRoute(context, alias, 'pages-catchall')

      const canonical = await context.get('/victim/known')
      expectRoute(context, canonical, 'victim')
    },
  },
  {
    name: 'a catch-all page cannot write the entry a sibling page later reads',
    fixture: 'base',
    async run(context) {
      const attacker = await context.get('/%76ictim/rt-write-1')
      expectRoute(context, attacker, 'pages-catchall')

      const victim = await context.get('/victim/rt-write-1')
      expectRoute(context, victim, 'victim')
    },
  },
  {
    name: 'a sibling not-found result does not deny another route',
    fixture: 'base',
    async run(context) {
      const alias = await context.get('/%76ictim/missing-1')
      expectRoute(context, alias, 'pages-catchall')

      const victim = await context.get('/victim/missing-1')
      context.assert(
        victim.status === 404, // gate: exact-status-ok -- the owning page's own not-found result
        `the owning page must keep its not-found result, got ${victim.status}`
      )
    },
  },
  {
    name: 'a catch-all page cannot serve an app page prerendered entry',
    fixture: 'base',
    async run(context) {
      const alias = await context.get('/%61pp-victim/%6Bnown')
      expectRoute(context, alias, 'pages-catchall')

      const appPage = await context.get('/app-victim/known')
      expectRoute(context, appPage, 'app-victim')
    },
  },
  {
    name: 'a catch-all page cannot serve or break an app route handler entry',
    fixture: 'base',
    async run(context) {
      const alias = await context.get('/%61pi/victim/%6Bnown')
      expectRoute(context, alias, 'pages-catchall')

      const route = await context.get('/api/victim/known')
      expectRoute(context, route, 'route-victim')
    },
  },
  {
    name: 'app pages and route handlers stay separate from other owners',
    fixture: 'base',
    async run(context) {
      const alias = await context.get('/%61pp-victim/%6Bnown-b')
      expectRoute(context, alias, 'pages-catchall')

      const appPage = await context.get('/app-victim/known-b')
      expectRoute(context, appPage, 'app-victim')

      const route = await context.get('/api/victim/known-b')
      expectRoute(context, route, 'route-victim')
    },
  },
  {
    name: 'an in-memory entry is not reused for another page',
    fixture: 'base',
    async run(context) {
      const attacker = await context.get('/%76ictim/memory-1')
      expectRoute(context, attacker, 'pages-catchall')

      const victim = await context.get('/victim/memory-1')
      expectRoute(context, victim, 'victim')
    },
  },
  {
    name: 'a persisted copy does not feed a sibling prerendered entry',
    fixture: 'base',
    async run(context) {
      const attacker = await context.get('/%76ictim/known-b')
      expectRoute(context, attacker, 'pages-catchall')

      const victim = await context.get('/victim/known-b')
      expectRoute(context, victim, 'victim')
    },
  },
  {
    name: 'two app router owners stay separate',
    fixture: 'base',
    async run(context) {
      const attacker = await context.get('/%61pp-victim/vendor/known')
      expectRoute(context, attacker, 'route-catchall')

      const victim = await context.get('/app-victim/vendor/known')
      expectRoute(context, victim, 'app-vendor')
    },
  },
  {
    name: 'a configured cache handler keeps owners apart',
    fixture: 'base',
    overlay: 'handler-overlay',
    async run(context) {
      const attacker = await context.get('/%76ictim/handler-1')
      expectRoute(context, attacker, 'pages-catchall')

      const victim = await context.get('/victim/handler-1')
      expectRoute(context, victim, 'victim')

      const attackerAgain = await context.get('/%76ictim/handler-2')
      expectRoute(context, attackerAgain, 'pages-catchall')
    },
  },
  {
    name: 'a configured cache handler keeps route kinds apart',
    fixture: 'base',
    overlay: 'handler-overlay',
    async run(context) {
      const attacker = await context.get('/%61pi/victim/%6Bnown')
      expectRoute(context, attacker, 'pages-catchall')

      const route = await context.get('/api/victim/known')
      expectRoute(context, route, 'route-victim')
    },
  },
]
