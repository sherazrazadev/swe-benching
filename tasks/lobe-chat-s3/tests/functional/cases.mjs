/*
 * Functional cases. They assert that publicly routable destinations keep working and that the
 * associated features keep their current behaviour. A destination counts as attempted when the
 * hermetic origin served it or when the server resolved the name; a submission that refuses a
 * legitimate destination before either happens fails.
 */

const fail = (message) => {
  throw new Error(message);
};

const assertAttempted = (ctx, host, label) => {
  if (!ctx.attempted(host)) fail(`${label}: the server never tried to reach the public destination`);
};

const served = (ctx, host) => ctx.net.publicContacted(host);

export default (ctx) => [
  {
    name: 'a plain-HTTP public asset is still retrieved',
    async run() {
      const result = await ctx.proxy('http://assets.lobe.test/asset');
      assertAttempted(ctx, 'assets.lobe.test', 'plain HTTP');
      if (served(ctx, 'assets.lobe.test')) {
        if (!result.ok || result.status !== 200) fail(`plain HTTP: status ${result.ok ? result.status : 'threw'}`);
        if (result.text !== ctx.PUBLIC_BODY) fail('plain HTTP: the answer was not the retrieved body');
        if (result.headers.get('x-test-header') !== 'kept') fail('plain HTTP: the response headers were not preserved');
      }
    },
  },
  {
    name: 'a public asset on a non-standard port is still retrieved',
    async run() {
      const result = await ctx.proxy('http://assets.lobe.test:8443/asset');
      assertAttempted(ctx, 'assets.lobe.test', 'non-standard port');
      if (served(ctx, 'assets.lobe.test')) {
        if (!result.ok || result.status !== 200) fail(`non-standard port: status ${result.ok ? result.status : 'threw'}`);
        if (result.text !== ctx.PUBLIC_BODY) fail('non-standard port: the answer was not the retrieved body');
      }
    },
  },
  {
    name: 'an HTTPS public asset is still retrieved',
    async run() {
      const result = await ctx.proxy('https://assets.lobe.test/asset');
      assertAttempted(ctx, 'assets.lobe.test', 'HTTPS');
      if (served(ctx, 'assets.lobe.test')) {
        if (!result.ok || result.status !== 200) fail(`HTTPS: status ${result.ok ? result.status : 'threw'}`);
        if (result.text !== ctx.PUBLIC_BODY) fail('HTTPS: the answer was not the retrieved body');
      }
    },
  },
  {
    name: 'a public asset with a path and query is still retrieved',
    async run() {
      const result = await ctx.proxy('http://assets.lobe.test/asset?name=demo&size=large');
      assertAttempted(ctx, 'assets.lobe.test', 'path and query');
      if (served(ctx, 'assets.lobe.test')) {
        if (!result.ok || result.status !== 200) fail(`path and query: status ${result.ok ? result.status : 'threw'}`);
        if (result.text !== ctx.PUBLIC_BODY) fail('path and query: the answer was not the retrieved body');
      }
    },
  },
  {
    name: 'a public destination named outside the body is still retrieved',
    async run() {
      const result = await ctx.proxy('', { headers: { 'X-Proxy-Target': 'http://assets.lobe.test/asset' } });
      assertAttempted(ctx, 'assets.lobe.test', 'header carrier');
      if (served(ctx, 'assets.lobe.test')) {
        if (!result.ok || result.status !== 200) fail(`header carrier: status ${result.ok ? result.status : 'threw'}`);
        if (result.text !== ctx.PUBLIC_BODY) fail('header carrier: the answer was not the retrieved body');
      }
    },
  },
  {
    name: 'a public bundle on the streaming path is still retrieved',
    async run() {
      const result = await ctx.proxy('http://assets.lobe.test/bundle.zip');
      assertAttempted(ctx, 'assets.lobe.test', 'streaming');
      if (served(ctx, 'assets.lobe.test')) {
        if (!result.ok || result.status !== 200) fail(`streaming: status ${result.ok ? result.status : 'threw'}`);
        if (result.text !== ctx.PUBLIC_ZIP) fail('streaming: the answer was not the retrieved bundle');
      }
    },
  },
  {
    name: 'a public manifest still has its referenced document resolved',
    async run() {
      const result = await ctx.proxy('http://assets.lobe.test/legit-manifest.json');
      assertAttempted(ctx, 'assets.lobe.test', 'manifest');
      if (served(ctx, 'assets.lobe.test')) {
        if (!result.ok || result.status !== 200) fail(`manifest: status ${result.ok ? result.status : 'threw'}`);
        let parsed;
        try { parsed = JSON.parse(result.text); } catch { fail('manifest: the answer was not JSON'); }
        if (parsed.openapiDocument !== '{"openapi":"3.0.0"}') {
          fail('manifest: the referenced document was not resolved and inlined');
        }
      }
    },
  },
  {
    name: 'a public image is still imported from its URL',
    async run() {
      const result = await ctx.image({ url: 'http://assets.lobe.test/demo.png' });
      assertAttempted(ctx, 'assets.lobe.test', 'image import');
      if (served(ctx, 'assets.lobe.test')) {
        if (!result.ok || result.status !== 200) fail(`image import: status ${result.ok ? result.status : 'threw'}`);
        let parsed;
        try { parsed = JSON.parse(result.text); } catch { fail('image import: the answer was not JSON'); }
        if (parsed.url !== 'https://i.imgur.com/demo.png') fail('image import: the imported URL was not returned');
      }
    },
  },
];
