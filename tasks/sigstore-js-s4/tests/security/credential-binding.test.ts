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

// The lookup must not hand back the credential stored for another registry.
// It may refuse (throw) or return nothing; both are acceptable refusals.
const expectNoVictim = (imageName: string) => {
  const credentials = lookup(imageName);
  expect(credentials?.username).not.toBe(VICTIM_USER);
  expect(credentials?.password).not.toBe(VICTIM_PASS);
};

describe('registry credentials are bound to the registry they were stored for', () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('does not use a stored credential whose name merely contains the image registry', () => {
    sandbox.writeConfig({
      auths: { 'ghcr.io': { auth: basicAuth(VICTIM_USER, VICTIM_PASS) } },
    });

    expectNoVictim('cr.io/acme/app');
  });

  it('does not use a stored credential for the same host on a different port', () => {
    sandbox.writeConfig({
      auths: {
        'registry.example.com:5000': {
          auth: basicAuth(VICTIM_USER, VICTIM_PASS),
        },
      },
    });

    expectNoVictim('registry.example.com/acme/app');
  });

  it('does not use a stored credential that only matches part of the stored path', () => {
    sandbox.writeConfig({
      auths: {
        'https://registry.example.com/myapp': {
          auth: basicAuth(VICTIM_USER, VICTIM_PASS),
        },
      },
    });

    expectNoVictim('myapp/acme/app');
  });
});
