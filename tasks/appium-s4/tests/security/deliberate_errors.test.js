'use strict';
// The deliberate error endpoints are debug support: they must not be reachable, and a refusal
// must be a client error rather than the server failing on purpose.
const h = require('../support/harness');

async function expectClosed(requestPath, init, serverOpts) {
  const {srv, base} = await h.startServer({serverOpts});
  try {
    const res = await h.request(base, requestPath, init);
    h.assertSurfaceClosed(res, ['We just tried to crash Appium!', 'Produced generic error for testing']);
  } finally {
    await h.stopServer(srv);
  }
}

describe('deliberate error triggers are closed while the opt-in is off', function () {
  this.timeout(60000);

  it('does not run the crash trigger', async function () {
    await h.withOptIn(undefined, () => expectClosed('/crash'));
  });

  it('does not run the generic-error trigger', async function () {
    await h.withOptIn(undefined, () => expectClosed('/produce_error'));
  });

  it('does not run the triggers under a configured base path', async function () {
    await h.withOptIn(undefined, () =>
      expectClosed('/wd/hub/crash', undefined, {basePath: '/wd/hub'}),
    );
  });
});
