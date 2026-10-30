'use strict';
// The same rule holds when an application assembles its own server with the exported
// configuration API instead of using the server factory. The support must not appear there
// either while the operator opt-in is off.
const h = require('../support/harness');

async function expectClosed(requestPath, markers = ['I am some page content', "Let's browse!"]) {
  const {httpServer, base} = await h.startConfiguredApp();
  try {
    const res = await h.request(base, requestPath);
    h.assertSurfaceClosed(res, markers);
  } finally {
    await h.stopConfiguredApp(httpServer);
  }
}

describe('library-assembled servers keep the support closed while the opt-in is off', function () {
  this.timeout(60000);

  it('does not serve a built-in page from an assembled server', async function () {
    await h.withOptIn(undefined, () => expectClosed('/test/guinea-pig'));
  });

  it('does not serve the welcome page from an assembled server', async function () {
    await h.withOptIn(undefined, () => expectClosed('/welcome'));
  });

  it('does not serve bundled files from an assembled server', async function () {
    await h.withOptIn(undefined, () => expectClosed('/appium.png'));
  });

  it('does not serve the reachability page from an assembled server', async function () {
    await h.withOptIn(undefined, () =>
      expectClosed('/sample-page?message=MARKER', ['Appium sample page', 'MARKER']),
    );
  });
});
