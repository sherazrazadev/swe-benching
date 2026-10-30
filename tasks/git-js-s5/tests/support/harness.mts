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

import { GitError, simpleGit } from '../../index';

const FAKE_GIT = process.env.FAKE_GIT;

/**
 * The opt-ins the library already documents for values that make `git` run a program.
 * Discovery accepts any of these for a refused capability instead of pinning one route to
 * one category, so a fix that keeps legitimate use working under a different existing
 * opt-in is not failed.
 */
export const PROGRAM_OPT_INS: readonly string[] = [
   'allowUnsafeAlias',
   'allowUnsafeAskPass',
   'allowUnsafeCommandBinaries',
   'allowUnsafeConfigEnvCount',
   'allowUnsafeConfigPaths',
   'allowUnsafeCredentialHelper',
   'allowUnsafeDiffExternal',
   'allowUnsafeDiffTextConv',
   'allowUnsafeEditor',
   'allowUnsafeExec',
   'allowUnsafeFilter',
   'allowUnsafeFsMonitor',
   'allowUnsafeGitProxy',
   'allowUnsafeGpgProgram',
   'allowUnsafeHooksPath',
   'allowUnsafeInclude',
   'allowUnsafeMergeDriver',
   'allowUnsafePack',
   'allowUnsafePager',
   'allowUnsafeProtocolOverride',
   'allowUnsafeSshCommand',
   'allowUnsafeSubmodule',
   'allowUnsafeTemplateDir',
   'allowUnsafeUrlRewrite',
];

export interface Invocation {
   error?: unknown;
   spawned: boolean;
   argv: string;
}

/**
 * The opt-in the guard asked the caller to enable, read from the refusal message. The
 * library's existing guard reports the category it would have accepted; discovery follows
 * that request rather than assuming which existing opt-in governs the capability.
 */
export function requestedCategory(result: Invocation): string {
   const message = String((result.error as Error)?.message ?? '');
   return message.match(/without enabling\s+([A-Za-z][\w]*)/)?.[1] ?? '';
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

/** The invocation was refused before `git` was started, and the caller saw a client error. */
export function expectRefused(result: Invocation) {
   // Nothing was spawned, so the fresh repository and the environment were never handed to
   // the child process; the contract's "unchanged" clause is exactly this absence of a run.
   expect(result.spawned).toBe(false);
   expect(result.error).toBeInstanceOf(GitError);
}

/** The invocation was permitted and reached `git` without an error. */
export function expectAllowed(result: Invocation) {
   expect(result.error).toBeUndefined();
   expect(result.spawned).toBe(true);
}
