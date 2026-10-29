import { getRegistryCredentials } from '../../packages/oci/src/credentials';
import { basicAuth, createSandbox } from '../support/sandbox';
import type { Sandbox } from '../support/sandbox';

describe('the additional credential sources keep working', () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('returns an exact container auth file entry', () => {
    sandbox.writeConfig({});
    sandbox.writeAuthFile({
      auths: { 'localhost:5000': { auth: basicAuth('file-user', 'file-pass') } },
    });

    expect(getRegistryCredentials('localhost:5000/my-image').password).toBe(
      'file-pass'
    );
  });

  it('prefers the Docker config entry over the container auth file', () => {
    sandbox.writeConfig({
      auths: { 'localhost:5000': { auth: basicAuth('config-user', 'config-pass') } },
    });
    sandbox.writeAuthFile({
      auths: { 'localhost:5000': { auth: basicAuth('file-user', 'file-pass') } },
    });

    expect(getRegistryCredentials('localhost:5000/my-image').username).toBe(
      'config-user'
    );
  });

  it('returns credentials from a helper named for the registry', () => {
    sandbox.writeConfig({ credHelpers: { 'localhost:5000': 'probe' } });
    sandbox.addHelper('probe', 'helper-user', 'helper-pass');

    expect(getRegistryCredentials('localhost:5000/my-image')).toEqual({
      headers: undefined,
      username: 'helper-user',
      password: 'helper-pass',
    });
  });

  it('returns credentials from the store-wide helper', () => {
    sandbox.writeConfig({ credsStore: 'probe' });
    sandbox.addHelper('probe', 'store-user', 'store-pass');

    expect(getRegistryCredentials('anywhere.example.com/my-image').password).toBe(
      'store-pass'
    );
  });
});
