'use strict';
// The built-in test pages must not be reachable while the operator opt-in is off. Each case
// drives the server factory and asks for one page with one kind of client-supplied value.
const h = require('../support/harness');

const PAGE_MARKER = 'I am some page content';

async function expectClosed(requestPath, init, markers) {
  const {srv, base} = await h.startServer();
  try {
    const res = await h.request(base, requestPath, init);
    h.assertSurfaceClosed(res, markers);
  } finally {
    await h.stopServer(srv);
  }
}

describe('built-in test pages are closed while the opt-in is off', function () {
  this.timeout(60000);

  it('does not serve a built-in page for a query value', async function () {
    await h.withOptIn(undefined, () =>
      expectClosed(
        '/test/guinea-pig?throwError=' + encodeURIComponent('MARK<inj>'),
        undefined,
        [PAGE_MARKER, 'MARK<inj>'],
      ),
    );
  });

  it('does not serve a built-in page for a form body value', async function () {
    await h.withOptIn(undefined, () =>
      expectClosed(
        '/test/guinea-pig',
        {
          method: 'POST',
          headers: {'content-type': 'application/x-www-form-urlencoded'},
          body: 'comments=' + encodeURIComponent('CMTMARK<inj>'),
        },
        [PAGE_MARKER, 'CMTMARK<inj>'],
      ),
    );
  });

  it('does not serve a built-in page for a header value', async function () {
    await h.withOptIn(undefined, () =>
      expectClosed(
        '/test/guinea-pig',
        {headers: {'user-agent': 'UAMARK<inj>'}},
        [PAGE_MARKER, 'UAMARK<inj>'],
      ),
    );
  });

  it('does not serve a built-in page for a repeated query key', async function () {
    await h.withOptIn(undefined, () =>
      expectClosed(
        '/test/guinea-pig?throwError=AA&throwError=BB',
        undefined,
        [PAGE_MARKER, 'AA,BB'],
      ),
    );
  });

  it('does not serve a built-in page for a non-read method', async function () {
    await h.withOptIn(undefined, () =>
      expectClosed('/test/guinea-pig', {method: 'PUT'}, [PAGE_MARKER]),
    );
  });

  it('does not serve the second built-in page', async function () {
    await h.withOptIn(undefined, () =>
      expectClosed('/test/guinea-pig-scrollable', undefined, ['That is looooong!']),
    );
  });

  it('does not serve the third built-in page', async function () {
    await h.withOptIn(undefined, () =>
      expectClosed('/test/guinea-pig-app-banner', undefined, ['apple-itunes-app']),
    );
  });

  it('does not serve the welcome page', async function () {
    await h.withOptIn(undefined, () =>
      expectClosed('/welcome', undefined, ["Let's browse!"]),
    );
  });
});
