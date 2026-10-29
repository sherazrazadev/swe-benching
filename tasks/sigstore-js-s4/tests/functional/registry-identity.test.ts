import nock from 'nock';
import { getRegistryCredentials } from '../../packages/oci/src/credentials';
import { attachArtifactToImage } from '../../packages/oci/src/index';
import { basicAuth, createSandbox } from '../support/sandbox';
import type { Sandbox } from '../support/sandbox';
import { fakeRegistry } from '../support/registry';
import type { RecordedRequest } from '../support/registry';

const IMAGE_DIGEST = 'sha256:deadbeef';

const attach = (
  imageName: string,
  credentials: { username: string; password: string }
) =>
  attachArtifactToImage({
    credentials,
    artifact: Buffer.from('probe-artifact'),
    imageDigest: IMAGE_DIGEST,
    imageName,
    mediaType: 'application/vnd.example.probe',
    fetchOpts: { retry: false },
  });

describe('requests go to the registry the credentials belong to', () => {
  let sandbox: Sandbox;
  const seen: RecordedRequest[] = [];

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

  it('authenticates to a plain registry with its own credentials', async () => {
    sandbox.writeConfig({
      auths: {
        'registry.example.com': { auth: basicAuth('user', 'pass') },
      },
    });
    fakeRegistry('registry.example.com', 'acme/app', IMAGE_DIGEST, seen);

    const credentials = getRegistryCredentials('registry.example.com/acme/app');
    await attach('registry.example.com/acme/app', credentials);

    expect(
      seen.some((request) =>
        request.authorization.includes(basicAuth('user', 'pass'))
      )
    ).toBe(true);
    expect(seen.every((request) => request.path.includes('acme/app'))).toBe(true);
  });

  it('authenticates to Docker Hub with credentials stored under an alias', async () => {
    sandbox.writeConfig({
      auths: {
        'https://index.docker.io/v1/': { auth: basicAuth('hub-user', 'hub-pass') },
      },
    });
    fakeRegistry('registry-1.docker.io', 'library/app', IMAGE_DIGEST, seen);

    const credentials = getRegistryCredentials('docker.io/library/app');
    await attach('docker.io/library/app', credentials);

    expect(
      seen.some((request) =>
        request.authorization.includes(basicAuth('hub-user', 'hub-pass'))
      )
    ).toBe(true);
  });
});
