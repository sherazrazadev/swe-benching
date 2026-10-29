import { getRegistryCredentials } from '../../packages/oci/src/credentials';
import { basicAuth, createSandbox } from '../support/sandbox';
import type { Sandbox } from '../support/sandbox';

const VICTIM_USER = 'victim-user';
const VICTIM_PASS = 'victim-pass';

const lookup = (imageName: string) => {
  try {
    return getRegistryCredentials(imageName);
  } catch {
    return undefined;
  }
};

const expectNoVictim = (imageName: string) => {
  const credentials = lookup(imageName);
  expect(credentials?.username).not.toBe(VICTIM_USER);
  expect(credentials?.password).not.toBe(VICTIM_PASS);
};

describe('every credential source stays bound to its registry', () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('does not use a container auth file entry stored for another registry', () => {
    sandbox.writeConfig({});
    sandbox.writeAuthFile({
      auths: { 'ghcr.io': { auth: basicAuth(VICTIM_USER, VICTIM_PASS) } },
    });

    expectNoVictim('cr.io/acme/app');
  });

  it('does not use a credential helper named for another registry', () => {
    sandbox.writeConfig({ credHelpers: { 'ghcr.io': 'probe' } });
    sandbox.addHelper('probe', VICTIM_USER, VICTIM_PASS);

    expectNoVictim('cr.io/acme/app');
  });
});
