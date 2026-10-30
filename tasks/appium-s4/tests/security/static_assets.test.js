'use strict';
// The bundled sample and fixture files are part of the built-in test support; while the operator
// opt-in is off the server must not hand them out from its own paths.
const h = require('../support/harness');

async function expectAssetClosed(urlPath) {
  const {srv, base} = await h.startServer();
  try {
    const res = await h.request(base, urlPath);
    h.assertSurfaceClosed(res);
  } finally {
    await h.stopServer(srv);
  }
}

describe('bundled test files are closed while the opt-in is off', function () {
  this.timeout(60000);

  it('does not serve the bundled image', async function () {
    await h.withOptIn(undefined, () => expectAssetClosed('/appium.png'));
  });

  it('does not serve a bundled fixture document from the server root', async function () {
    await h.withOptIn(undefined, () => expectAssetClosed('/test/welcome.html'));
  });

  it('does not serve the bundled favicon', async function () {
    await h.withOptIn(undefined, () => expectAssetClosed('/favicon.ico'));
  });

  it('does not serve the driver-suite sample assets', async function () {
    await h.withOptIn(undefined, () => expectAssetClosed('/ci-assets/reachability.html'));
  });
});
