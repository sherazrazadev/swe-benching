// Shared harness for the hidden suites.
//
// Every invocation is driven through the library's public API. The child process is a
// recording stand-in for `git` supplied through the library's own `binary` option, so an
// invocation that is permitted is observed as exactly one recorded argv line and an
// invocation that is refused is observed as no recorded line at all.
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'vitest';

import { simpleGit } from '../../index';

const FAKE_GIT = process.env.FAKE_GIT;

export interface Invocation {
   error?: unknown;
   spawned: boolean;
   argv: string;
}

export interface InvokeOptions {
   unsafe?: Record<string, boolean>;
   env?: Record<string, string>;
   options?: Record<string, unknown>;
}

export async function invoke(
   call: (git: any) => Promise<unknown>,
   { unsafe = {}, env = {}, options = {} }: InvokeOptions = {}
): Promise<Invocation> {
   if (!FAKE_GIT) {
      throw new Error('FAKE_GIT is not configured');
   }

   const dir = mkdtempSync(join(tmpdir(), 'simple-git-guard-'));
   const record = join(dir, 'spawn.log');

   try {
      const git = simpleGit(dir, {
         binary: FAKE_GIT,
         unsafe,
         ...options,
      } as any).env({ FAKE_GIT_RECORD: record, ...env });

      let error: unknown;
      try {
         await call(git);
      } catch (e) {
         error = e;
      }

      const argv = existsSync(record) ? readFileSync(record, 'utf8') : '';

      return { error, spawned: argv.trim().length > 0, argv };
   } finally {
      rmSync(dir, { recursive: true, force: true });
   }
}

/** The invocation was refused before `git` was started, and the caller saw an error. */
export function expectRefused(result: Invocation) {
   expect(result.spawned).toBe(false);
   expect(result.error).toBeInstanceOf(Error);
}

/** The invocation was permitted and reached `git` without an error. */
export function expectAllowed(result: Invocation) {
   expect(result.error).toBeUndefined();
   expect(result.spawned).toBe(true);
}
