/**
 * Security: the housekeeping command that removes duplicate memory entries must
 * not remove an entry that differs from another one in any content field. It
 * groups rows by a subset of columns and deletes everything but the oldest in
 * each group.
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

interface SeedObservation {
  title?: string;
  subtitle?: string;
  type?: string;
  facts?: string | null;
  narrative?: string | null;
  concepts?: string | null;
  files_read?: string | null;
  files_modified?: string | null;
  prompt_number?: number | null;
  created_at_epoch?: number;
}

/** Create a database with the product's own schema, then insert rows directly. */
function seededDatabase(entries: SeedObservation[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'claude-mem-cleanup-'));
  temporaryDirectories.push(dir);
  const dbPath = join(dir, 'claude-mem.db');

  // Let the product create its schema at this path, then close it.
  const store = new SessionStore(dbPath);
  store.close();

  const db = new Database(dbPath);
  try {
    db.prepare(
      `INSERT INTO sdk_sessions (content_session_id, memory_session_id, project, started_at, started_at_epoch, status)
       VALUES (?, ?, ?, ?, ?, 'active')`
    ).run('seed-content-session', 'seed-memory-session', 'seed-project', '2026-01-01T00:00:00.000Z', 1767225600000);

    const insert = db.prepare(
      `INSERT INTO observations
       (memory_session_id, project, type, title, subtitle, facts, narrative, concepts,
        files_read, files_modified, prompt_number, discovery_tokens, content_hash,
        created_at, created_at_epoch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
    );
    entries.forEach((entry, index) => {
      insert.run(
        'seed-memory-session',
        'seed-project',
        entry.type ?? 'discovery',
        entry.title ?? 'Seed observation',
        entry.subtitle ?? 'Seed subtitle',
        entry.facts ?? null,
        entry.narrative ?? 'Seed narrative',
        entry.concepts ?? null,
        entry.files_read ?? null,
        entry.files_modified ?? null,
        entry.prompt_number ?? 1,
        `seeded-hash-${index}`.slice(0, 16),
        '2026-01-01T00:00:00.000Z',
        entry.created_at_epoch ?? 1767225600000 + index * 60_000
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

function remainingObservations(dir: string): Array<{ title: string | null; narrative: string | null; facts: string | null }> {
  const db = new Database(join(dir, 'claude-mem.db'));
  try {
    return db
      .prepare('SELECT title, narrative, facts FROM observations ORDER BY id')
      .all() as Array<{ title: string | null; narrative: string | null; facts: string | null }>;
  } finally {
    db.close();
  }
}

describe('housekeeping identity', () => {
  it('keeps entries that differ only in the narrative', () => {
    const dir = seededDatabase([
      { narrative: 'first narrative' },
      { narrative: 'second narrative' }
    ]);

    runCleanup(dir);

    const remaining = remainingObservations(dir);
    expect(remaining.length).toBe(2);
    expect(remaining.map(row => row.narrative).sort()).toEqual(['first narrative', 'second narrative']);
  });

  it('keeps entries that differ only in the facts', () => {
    const dir = seededDatabase([
      { facts: JSON.stringify(['alpha']) },
      { facts: JSON.stringify(['beta']) }
    ]);

    runCleanup(dir);

    const remaining = remainingObservations(dir);
    expect(remaining.length).toBe(2);
    expect(remaining.map(row => row.facts).sort()).toEqual([JSON.stringify(['alpha']), JSON.stringify(['beta'])].sort());
  });

  it('keeps entries that differ only in the concept list', () => {
    const dir = seededDatabase([
      { concepts: JSON.stringify(['one']) },
      { concepts: JSON.stringify(['two']) }
    ]);

    runCleanup(dir);

    expect(remainingObservations(dir).length).toBe(2);
  });
});
