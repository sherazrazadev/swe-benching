import nock from 'nock';
import { getRegistryCredentials } from '../../packages/oci/src/credentials';
import { attachArtifactToImage } from '../../packages/oci/src/index';
import { basicAuth, createSandbox } from '../support/sandbox';
import type { Sandbox } from '../support/sandbox';

const VICTIM_USER = 'victim-user';
const VICTIM_PASS = 'victim-pass';
const IMAGE_DIGEST = 'sha256:deadbeef';

describe('a request to a registry only carries that registry\'s credentials', () => {
  let sandbox: Sandbox;
  const seen: Array<{ host: string; authorization: string }> = [];

  beforeEach(() => {
    sandbox = createSandbox();
    seen.length = 0;
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    sandbox.restore();
  });

  it('does not send credentials stored for one host to another registry', async () => {
    sandbox.writeConfig({
      auths: {
        'notdocker.io': { auth: basicAuth(VICTIM_USER, VICTIM_PASS) },
      },
    });

    const record = function (this: any) {
      seen.push({
        host: String(this.req.headers.host || ''),
        authorization: String(this.req.headers.authorization || ''),
      });
      return [404, {}];
    };

    nock('https://registry-1.docker.io')
      .post('/v2/acme/app/blobs/uploads/')
      .reply(401, {}, { 'WWW-Authenticate': 'Basic realm="registry"' })
      .head(`/v2/acme/app/manifests/${IMAGE_DIGEST}`)
      .reply(record);

    let credentials;
    try {
      credentials = getRegistryCredentials('notdocker.io/acme/app');
    } catch {
      // Refusing the lookup is an acceptable way to keep the credential bound.
      return;
    }

    try {
      await attachArtifactToImage({
        credentials,
        artifact: Buffer.from('probe-artifact'),
        imageDigest: IMAGE_DIGEST,
        imageName: 'notdocker.io/acme/app',
        mediaType: 'application/vnd.example.probe',
        fetchOpts: { retry: false },
      });
    } catch {
      // A refusal later in the flow is fine; only the leak matters here.
    }

    const leaked = seen.some((request) =>
      request.authorization.includes(basicAuth(VICTIM_USER, VICTIM_PASS))
    );
    expect(leaked).toBe(false);
  });
});
