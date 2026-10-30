'use strict';
// With the operator opt-in on, the deliberate error endpoints must keep producing their errors
// (that is what driver suites use them for), and the server must keep serving normal requests.
const h = require('../support/harness');

async function withOptedInServer(fn) {
  return h.withOptIn('1', async function () {
    const {srv, base} = await h.startServer();
    try {
      return await fn(base, srv);
    } finally {
      await h.stopServer(srv);
    }
  });
}

describe('the deliberate error endpoints work while the opt-in is on', function () {
  this.timeout(60000);

  it('runs the crash trigger', async function () {
    await withOptedInServer(async function (base) {
      const res = await h.request(base, '/crash');
      if (res.status < 500) {
        throw new Error(`the crash trigger no longer fails (status ${res.status})`);
      }
      if (!res.body.includes('We just tried to crash Appium!')) {
        throw new Error('the crash trigger no longer reports its error');
      }
    });
  });

  it('runs the generic-error trigger', async function () {
    await withOptedInServer(async function (base) {
      const res = await h.request(base, '/produce_error');
      if (!res.body.includes('Produced generic error for testing')) {
        throw new Error(`the generic-error trigger no longer reports its error (status ${res.status})`);
      }
    });
  });

  it('keeps serving normal requests next to the enabled support', async function () {
    await withOptedInServer(async function (base) {
      const res = await h.request(base, '/session');
      h.assertServed(res, ['"ok":true']);
    });
  });
});
