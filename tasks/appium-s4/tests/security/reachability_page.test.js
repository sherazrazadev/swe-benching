'use strict';
// A second built-in page exists for driver suites to confirm a running server is reachable; it
// echoes a client-supplied value. It is part of the same test support and must stay closed while
// the operator opt-in is off.
const h = require('../support/harness');

describe('the reachability page is closed while the opt-in is off', function () {
  this.timeout(60000);

  it('does not serve the reachability page', async function () {
    await h.withOptIn(undefined, async function () {
      const {srv, base} = await h.startServer();
      try {
        const res = await h.request(base, '/sample-page?message=RPMARK');
        h.assertSurfaceClosed(res, ['Appium sample page', 'RPMARK']);
      } finally {
        await h.stopServer(srv);
      }
    });
  });

  it('does not serve the reachability page for a non-read method', async function () {
    await h.withOptIn(undefined, async function () {
      const {srv, base} = await h.startServer();
      try {
        const res = await h.request(base, '/sample-page', {method: 'POST'});
        h.assertSurfaceClosed(res, ['Appium sample page']);
      } finally {
        await h.stopServer(srv);
      }
    });
  });
});
