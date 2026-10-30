'use strict';
// With the operator opt-in on, the bundled sample and fixture files, and the reachability page,
// must keep being served from their existing URLs.
const h = require('../support/harness');

async function withOptedInServer(fn) {
  return h.withOptIn('1', async function () {
    const {srv, base} = await h.startServer();
    try {
      return await fn(base);
    } finally {
      await h.stopServer(srv);
    }
  });
}

describe('the bundled test files work while the opt-in is on', function () {
  this.timeout(60000);

  it('serves the bundled image', async function () {
    await withOptedInServer(async function (base) {
      const res = await h.request(base, '/appium.png');
      if (res.status !== 200 || res.buffer.length < 1000) {
        throw new Error(`the bundled image is not served (status ${res.status}, ${res.buffer.length} bytes)`);
      }
    });
  });

  it('serves a bundled fixture document', async function () {
    await withOptedInServer(async function (base) {
      const res = await h.request(base, '/test/welcome.html');
      h.assertServed(res, ['Appium/welcome']);
    });
  });

  it('serves the bundled favicon', async function () {
    await withOptedInServer(async function (base) {
      const res = await h.request(base, '/favicon.ico');
      if (res.status !== 200 || res.buffer.length < 100) {
        throw new Error(`the favicon is not served (status ${res.status}, ${res.buffer.length} bytes)`);
      }
    });
  });

  it('serves the driver-suite sample assets', async function () {
    await withOptedInServer(async function (base) {
      const page = await h.request(base, '/ci-assets/reachability.html');
      h.assertServed(page, ['Appium reachability sample']);
      const data = await h.request(base, '/ci-assets/sample.json');
      h.assertServed(data, ['appium-sample']);
    });
  });

  it('serves the reachability page and binds its value unchanged', async function () {
    await withOptedInServer(async function (base) {
      const value = 'RAW<&>M';
      const res = await h.request(base, '/sample-page?message=' + encodeURIComponent(value));
      h.assertServed(res, ['Appium sample page', value]);
    });
  });
});
