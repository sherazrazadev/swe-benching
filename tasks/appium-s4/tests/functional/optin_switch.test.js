'use strict';
// Every documented spelling of the operator switch must turn the support on, in any letter case.
const h = require('../support/harness');

const ON_VALUES = ['1', 'true', 'TRUE', 'True', 'yes', 'Yes', 'YES'];

describe('the documented opt-in values turn the support on', function () {
  this.timeout(120000);

  for (const value of ON_VALUES) {
    it(`serves the built-in page for the value ${JSON.stringify(value)}`, async function () {
      await h.withOptIn(value, async function () {
        const {srv, base} = await h.startServer();
        try {
          const res = await h.request(base, '/test/guinea-pig');
          h.assertServed(res, ['I am some page content']);
        } finally {
          await h.stopServer(srv);
        }
      });
    });
  }
});
