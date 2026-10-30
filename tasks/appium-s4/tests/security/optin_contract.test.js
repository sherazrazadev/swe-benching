'use strict';
// The operator switch is a value contract: only 1, true and yes (any letter case) turn the
// support on. Every other value must leave it off, so a plain "non-empty means on" test is wrong.
const h = require('../support/harness');

const OFF_VALUES = ['0', 'false', 'no', 'off', '', 'enabled'];

async function expectClosedFor(value) {
  const {srv, base} = await h.startServer();
  try {
    const page = await h.request(base, '/test/guinea-pig');
    h.assertSurfaceClosed(page, ['I am some page content']);
    const sample = await h.request(base, '/sample-page?message=SMARK');
    h.assertSurfaceClosed(sample, ['Appium sample page', 'SMARK']);
  } finally {
    await h.stopServer(srv);
  }
}

describe('only the documented values turn the support on', function () {
  this.timeout(120000);

  for (const value of OFF_VALUES) {
    it(`stays closed for the value ${JSON.stringify(value)}`, async function () {
      await h.withOptIn(value, () => expectClosedFor(value));
    });
  }
});
