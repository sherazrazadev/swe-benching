import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type Sandbox = {
  home: string;
  writeConfig: (config: unknown) => void;
  writeAuthFile: (config: unknown) => string;
  addHelper: (name: string, username: string, password: string) => void;
  restore: () => void;
};

// Builds an isolated home directory for one test: the tool reads its registry
// configuration from there, and the test never needs the host's real files.
export const createSandbox = (): Sandbox => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'registry-creds-'));
  const homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(home);
  const saved = {
    HOME: process.env.HOME,
    REGISTRY_AUTH_FILE: process.env.REGISTRY_AUTH_FILE,
    PATH: process.env.PATH,
  };

  process.env.HOME = home;
  fs.mkdirSync(path.join(home, '.docker'), { recursive: true });

  const restore = () => {
    homedirSpy.mockRestore();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    fs.rmSync(home, { recursive: true, force: true });
  };

  const writeConfig = (config: unknown) => {
    fs.writeFileSync(
      path.join(home, '.docker', 'config.json'),
      JSON.stringify(config)
    );
  };

  const writeAuthFile = (config: unknown) => {
    const file = path.join(home, 'containers-auth.json');
    fs.writeFileSync(file, JSON.stringify(config));
    process.env.REGISTRY_AUTH_FILE = file;
    return file;
  };

  const addHelper = (name: string, username: string, password: string) => {
    // The helper stand-in answers for the current test only; both the helper on
    // this test's PATH and the fallback helper shipped with the suite read it.
    const credentialFile = path.join(
      __dirname,
      '..',
      'current-helper-credential.json'
    );
    fs.writeFileSync(
      credentialFile,
      JSON.stringify({ Username: username, Secret: password })
    );

    const bin = path.join(home, 'bin');
    fs.mkdirSync(bin, { recursive: true });
    const file = path.join(bin, `docker-credential-${name}`);
    fs.writeFileSync(
      file,
      `#!/bin/sh\ncat >/dev/null\ncat '${credentialFile}'\n`
    );
    fs.chmodSync(file, 0o755);
    process.env.PATH = `${bin}:${process.env.PATH}`;
  };

  return { home, writeConfig, writeAuthFile, addHelper, restore };
};

export const basicAuth = (username: string, password: string): string =>
  Buffer.from(`${username}:${password}`).toString('base64');
