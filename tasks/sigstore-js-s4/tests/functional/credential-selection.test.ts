import { getRegistryCredentials } from '../../packages/oci/src/credentials';
import { basicAuth, createSandbox } from '../support/sandbox';
import type { Sandbox } from '../support/sandbox';

describe('credential selection keeps working', () => {
  let sandbox: Sandbox;

  beforeEach(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('returns the credentials stored for a plain registry name', () => {
    sandbox.writeConfig({
      auths: { 'my-registry': { auth: basicAuth('user', 'pass') } },
    });

    expect(getRegistryCredentials('my-registry/my-image')).toEqual({
      headers: undefined,
      username: 'user',
      password: 'pass',
    });
  });

  it('returns the credential-bearing headers stored in the config', () => {
    sandbox.writeConfig({
      auths: { 'my-registry': { auth: basicAuth('user', 'pass') } },
      HttpHeaders: { 'X-Api-Key': 'apikey' },
    });

    expect(getRegistryCredentials('my-registry/my-image').headers).toEqual({
      'X-Api-Key': 'apikey',
    });
  });

  it('uses the identity token as the password when one is stored', () => {
    sandbox.writeConfig({
      auths: {
        'my-registry': {
          auth: basicAuth('user', 'pass'),
          identitytoken: 'identity-token',
        },
      },
    });

    expect(getRegistryCredentials('my-registry/my-image')).toEqual({
      headers: undefined,
      username: 'user',
      password: 'identity-token',
    });
  });

  it('returns the credential stored under a scheme and path form', () => {
    sandbox.writeConfig({
      auths: { 'https://my-registry/v1': { auth: basicAuth('user', 'pass') } },
    });

    expect(getRegistryCredentials('my-registry/my-image').password).toBe('pass');
  });

  it('returns the credential stored for a registry reached on a port', () => {
    sandbox.writeConfig({
      auths: { 'localhost:5000': { auth: basicAuth('user', 'pass') } },
    });

    expect(getRegistryCredentials('localhost:5000/my-image').password).toBe(
      'pass'
    );
  });

  it('returns the credential stored under a Docker Hub alias', () => {
    sandbox.writeConfig({
      auths: {
        'https://index.docker.io/v1/': { auth: basicAuth('user', 'pass') },
      },
    });

    expect(
      getRegistryCredentials('docker.io/library/my-image').password
    ).toBe('pass');
  });

  it('keeps credentials for different registries apart', () => {
    sandbox.writeConfig({
      auths: {
        'registry.example.com': { auth: basicAuth('first', 'one') },
        'other.example.com': { auth: basicAuth('second', 'two') },
      },
    });

    expect(
      getRegistryCredentials('registry.example.com/a/b').username
    ).toBe('first');
    expect(getRegistryCredentials('other.example.com/a/b').username).toBe(
      'second'
    );
  });

  it('fails when no credential is stored for the registry', () => {
    sandbox.writeConfig({ auths: {} });

    expect(() => getRegistryCredentials('missing.example.com/a/b')).toThrow(
      /no credentials found/i
    );
  });
});
