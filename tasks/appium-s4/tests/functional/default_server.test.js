'use strict';
// Ordinary server behaviour must be unchanged while the built-in support is off: driver routes
// are served, an unknown path is a client error, and the base-path setting still applies.
const h = require('../support/harness');

describe('ordinary server behaviour is unchanged', function () {
  this.timeout(60000);

  it('serves a driver route', async function () {
    await h.withOptIn(undefined, async function () {
      const {srv, base} = await h.startServer();
      try {
        const res = await h.request(base, '/session');
        h.assertServed(res, ['"ok":true']);
      } finally {
        await h.stopServer(srv);
      }
    });
  });

  it('answers an unknown path with a client error', async function () {
    await h.withOptIn(undefined, async function () {
      const {srv, base} = await h.startServer();
      try {
        const res = await h.request(base, '/definitely-not-a-route');
        if (!(res.status >= 400 && res.status < 500)) {
          throw new Error(`expected a client error for an unknown path, got ${res.status}`);
        }
        if (!res.body.includes('unknown command')) {
          throw new Error('the standard unknown-command response changed');
        }
      } finally {
        await h.stopServer(srv);
      }
    });
  });

  it('applies the base-path setting to driver routes', async function () {
    await h.withOptIn(undefined, async function () {
      const {srv, base} = await h.startServer({
        serverOpts: {basePath: '/wd/hub'},
        routes: function (app, opts) {
          const prefix = (opts && opts.basePath) || '';
          app.get(`${prefix}/session`, (_req, res) => res.json({ok: true}));
        },
      });
      try {
        const res = await h.request(base, '/wd/hub/session');
        h.assertServed(res, ['"ok":true']);
        const outside = await h.request(base, '/session');
        if (!(outside.status >= 400 && outside.status < 500)) {
          throw new Error(`route outside the base path should not be served, got ${outside.status}`);
        }
      } finally {
        await h.stopServer(srv);
      }
    });
  });
});
