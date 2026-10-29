/**
 * Functional: the housekeeping command still removes exact duplicates.
 */

import { describe, it, expect, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SessionStore } from '../../src/services/sqlite/SessionStore.js';

const REPO_ROOT = new URL('../../', import.meta.url).pathname;
const temporaryDirectories: string[] = [];

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const dir = temporaryDirectories.pop()!;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
});

function seededDatabase(rows: Array<{ narrative: string; created_at_epoch: number }>): string {
  const dir = mkdtempSync(join(tmpdir(), 'claude-mem-cleanup-fn-'));
  temporaryDirectories.push(dir);
  const dbPath = join(dir, 'claude-mem.db');

  const store = new SessionStore(dbPath);
  store.close();

  const db = new Database(dbPath);
  try {
    db.prepare(
      `INSERT INTO sdk_sessions (content_session_id, memory_session_id, project, started_at, started_at_epoch, status)
       VALUES (?, ?, ?, ?, ?, 'active')`
    ).run('fn-content-session', 'fn-memory-session', 'fn-project', '2026-01-01T00:00:00.000Z', 1767225600000);

    const insert = db.prepare(
      `INSERT INTO observations
       (memory_session_id, project, type, title, subtitle, facts, narrative, concepts,
        files_read, files_modified, prompt_number, discovery_tokens, content_hash,
        created_at, created_at_epoch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
    );
    rows.forEach((row, index) => {
      insert.run(
        'fn-memory-session',
        'fn-project',
        'discovery',
        'Duplicate observation',
        'Duplicate subtitle',
        JSON.stringify(['same fact']),
        row.narrative,
        JSON.stringify(['same concept']),
        JSON.stringify(['/src/same.ts']),
        null,
        1,
        `fn-hash-${index}`.slice(0, 16),
        '2026-01-01T00:00:00.000Z',
        row.created_at_epoch
      );
    });
  } finally {
    db.close();
  }

  return dir;
}

function runCleanup(dir: string): void {
  const result = Bun.spawnSync({
    cmd: [process.execPath, join(REPO_ROOT, 'src/bin/cleanup-duplicates.ts')],
    cwd: dir,
    env: {
      PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
      HOME: dir,
      CLAUDE_MEM_DATA_DIR: dir
    },
    stdout: 'pipe',
    stderr: 'pipe'
  });
  expect(result.exitCode).toBe(0);
}

function remainingObservations(dir: string): number {
  const db = new Database(join(dir, 'claude-mem.db'));
  try {
    return (db.prepare('SELECT COUNT(*) AS count FROM observations').get() as { count: number }).count;
  } finally {
    db.close();
  }
}

describe('housekeeping behaviour', () => {
  it('removes entries whose content is identical', () => {
    const dir = seededDatabase([
      { narrative: 'identical narrative', created_at_epoch: 1767225600000 },
      { narrative: 'identical narrative', created_at_epoch: 1767225660000 }
    ]);

    runCleanup(dir);

    expect(remainingObservations(dir)).toBe(1);
  });
});
