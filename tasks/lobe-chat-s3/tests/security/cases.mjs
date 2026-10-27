/*
 * Security cases. Each one drives a real product entry point and asserts the protected
 * outcome: the server must not connect to a non-public destination, and nothing from such a
 * destination may appear in the answer. A refusal is accepted whatever client-error status
 * the submission chooses.
 */

const fail = (message) => {
  throw new Error(message);
};

const assertNoInternal = (ctx, label) => {
  if (ctx.internalTouched()) fail(`${label}: the server connected to a non-public destination`);
};

const assertNoMarker = (ctx, result, label) => {
  if (result.text && result.text.includes(ctx.MARKER)) fail(`${label}: the answer contained internal data`);
};

const assertCleanRefusal = (ctx, result, label) => {
  if (!ctx.clientError(result)) {
    fail(`${label}: expected a client error, got ${result.ok ? `status ${result.status}` : 'a thrown error'}`);
  }
};

export default (ctx) => [
  {
    name: 'proxy refuses a loopback address supplied as the location',
    async run() {
      const result = await ctx.proxy(`http://127.0.0.1:${ctx.ports.v4}/secret`);
      assertNoInternal(ctx, 'loopback');
      assertNoMarker(ctx, result, 'loopback');
      assertCleanRefusal(ctx, result, 'loopback');
    },
  },
  {
    name: 'proxy refuses a name whose answer is a loopback address',
    async run() {
      const result = await ctx.proxy(`http://intranet.lobe.test:${ctx.ports.v4}/secret`);
      assertNoInternal(ctx, 'resolved loopback');
      assertNoMarker(ctx, result, 'resolved loopback');
      assertCleanRefusal(ctx, result, 'resolved loopback');
    },
  },
  {
    name: 'proxy refuses an IPv6 loopback address',
    async run() {
      if (!ctx.ports.v6) fail('this verifier has no IPv6 loopback');
      const result = await ctx.proxy(`http://[::1]:${ctx.ports.v6}/secret`);
      assertNoInternal(ctx, 'ipv6 loopback');
      assertNoMarker(ctx, result, 'ipv6 loopback');
      assertCleanRefusal(ctx, result, 'ipv6 loopback');
    },
  },
  {
    name: 'proxy refuses an IPv4 address written in IPv6 form',
    async run() {
      const result = await ctx.proxy(`http://[::ffff:127.0.0.1]:${ctx.ports.v4}/secret`);
      assertNoInternal(ctx, 'mapped loopback');
      assertNoMarker(ctx, result, 'mapped loopback');
      assertCleanRefusal(ctx, result, 'mapped loopback');
    },
  },
  {
    name: 'proxy refuses a name whose answer is a private address',
    async run() {
      const result = await ctx.proxy(`http://rfc1918.lobe.test:${ctx.ports.v4}/secret`);
      assertNoInternal(ctx, 'private address');
      assertNoMarker(ctx, result, 'private address');
      assertCleanRefusal(ctx, result, 'private address');
    },
  },
  {
    name: 'proxy refuses a name whose answer is link-local',
    async run() {
      const result = await ctx.proxy('http://metadata.lobe.test/latest/meta-data/');
      assertNoInternal(ctx, 'link-local address');
      assertNoMarker(ctx, result, 'link-local address');
      assertCleanRefusal(ctx, result, 'link-local address');
    },
  },
  {
    name: 'proxy refuses a non-public location named in a request header',
    async run() {
      const result = await ctx.proxy('', { headers: { 'X-Proxy-Target': `http://127.0.0.1:${ctx.ports.v4}/secret` } });
      assertNoInternal(ctx, 'header carrier');
      assertNoMarker(ctx, result, 'header carrier');
      assertCleanRefusal(ctx, result, 'header carrier');
    },
  },
  {
    name: 'proxy refuses a non-public location named in the query string',
    async run() {
      const query = `url=${encodeURIComponent(`http://127.0.0.1:${ctx.ports.v4}/secret`)}`;
      const result = await ctx.proxy('', { query });
      assertNoInternal(ctx, 'query carrier');
      assertNoMarker(ctx, result, 'query carrier');
      assertCleanRefusal(ctx, result, 'query carrier');
    },
  },
  {
    name: 'proxy does not follow a redirect from a public origin to a non-public one',
    async run() {
      const result = await ctx.proxy('http://assets.lobe.test/redir');
      assertNoInternal(ctx, 'redirect');
      assertNoMarker(ctx, result, 'redirect');
    },
  },
  {
    name: 'proxy does not fetch a location it derives from an earlier answer when that location is non-public',
    async run() {
      const result = await ctx.proxy('http://assets.lobe.test/manifest.json');
      assertNoInternal(ctx, 'derived location');
      assertNoMarker(ctx, result, 'derived location');
    },
  },
  {
    name: 'proxy refuses a non-public location on the streaming path',
    async run() {
      const result = await ctx.proxy(`http://127.0.0.1:${ctx.ports.v4}/secret.zip`);
      assertNoInternal(ctx, 'streaming path');
      assertNoMarker(ctx, result, 'streaming path');
      assertCleanRefusal(ctx, result, 'streaming path');
    },
  },
  {
    name: 'image import refuses a non-public location',
    async run() {
      const result = await ctx.image({ url: `http://127.0.0.1:${ctx.ports.v4}/secret.png` });
      assertNoInternal(ctx, 'image import');
      assertNoMarker(ctx, result, 'image import');
    },
  },
];
