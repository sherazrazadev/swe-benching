'use strict';
// With the operator opt-in on, the built-in pages must keep working exactly as today: submitted
// values are bound into the returned document unchanged, and the pages' cookies and delay
// handling are unchanged. A fix that escapes or validates these values breaks driver suites.
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

describe('the built-in pages work while the opt-in is on', function () {
  this.timeout(60000);

  it('binds a query value into the page unchanged', async function () {
    await withOptedInServer(async function (base) {
      const value = 'FUN<&>MARK';
      const res = await h.request(base, '/test/guinea-pig?throwError=' + encodeURIComponent(value));
      h.assertServed(res, ['I am some page content', value]);
    });
  });

  it('binds a form body value into the page unchanged', async function () {
    await withOptedInServer(async function (base) {
      const value = 'CMT<&>MARK';
      const res = await h.request(base, '/test/guinea-pig', {
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        body: 'comments=' + encodeURIComponent(value),
      });
      h.assertServed(res, ['I am some page content', value]);
    });
  });

  it('binds a header value into the page unchanged', async function () {
    await withOptedInServer(async function (base) {
      const value = 'UA<&>MARK';
      const res = await h.request(base, '/test/guinea-pig', {headers: {'user-agent': value}});
      h.assertServed(res, ['I am some page content', value]);
    });
  });

  it('serves the welcome page', async function () {
    await withOptedInServer(async function (base) {
      const res = await h.request(base, '/welcome');
      h.assertServed(res, ["Let's browse!"]);
    });
  });

  it('serves the second built-in page', async function () {
    await withOptedInServer(async function (base) {
      const res = await h.request(base, '/test/guinea-pig-scrollable');
      h.assertServed(res, ['That is looooong!']);
    });
  });

  it('serves the third built-in page', async function () {
    await withOptedInServer(async function (base) {
      const res = await h.request(base, '/test/guinea-pig-app-banner');
      h.assertServed(res, ['apple-itunes-app']);
    });
  });

  it('keeps the pages cookie behaviour', async function () {
    await withOptedInServer(async function (base) {
      const res = await h.request(base, '/test/guinea-pig');
      h.assertServed(res, ['I am some page content']);
      const cookies = res.headers.getSetCookie();
      const joined = cookies.join('\n');
      if (!joined.includes('guineacookie1') || !joined.includes('guineacookie2')) {
        throw new Error(`the built-in page no longer sets its cookies: ${joined}`);
      }
    });
  });

  it('keeps the pages delay handling', async function () {
    await withOptedInServer(async function (base) {
      const res = await h.request(base, '/test/guinea-pig?delay=25');
      h.assertServed(res, ['I am some page content']);
    });
  });

  it('serves the built-in pages independent of a configured base path', async function () {
    await h.withOptIn('1', async function () {
      const {srv, base} = await h.startServer({serverOpts: {basePath: '/wd/hub'}});
      try {
        const res = await h.request(base, '/test/guinea-pig');
        h.assertServed(res, ['I am some page content']);
      } finally {
        await h.stopServer(srv);
      }
    });
  });
});
