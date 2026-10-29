/**
 * Security: two memory entries with different content must never be collapsed.
 *
 * The product gives an incoming observation an identity derived from its content
 * and skips the write when an observation with the same identity was recorded in
 * the recent window. These tests submit observations that differ only in where a
 * field boundary falls, or in a content field the naive identity ignores, and
 * require both entries to be stored.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import type { Request, Response } from 'express';
import { MemoryRoutes } from '../../src/services/worker/http/routes/MemoryRoutes.js';
import { SessionStore } from '../../src/services/sqlite/SessionStore.js';
import { ClaudeMemDatabase } from '../../src/services/sqlite/Database.js';
import { storeObservation } from '../../src/services/sqlite/observations/store.js';
import { createSDKSession, updateMemorySessionId } from '../../src/services/sqlite/Sessions.js';
import type { ObservationInput } from '../../src/services/sqlite/observations/types.js';
import type { Database } from 'bun:sqlite';

function observation(overrides: Partial<ObservationInput> = {}): ObservationInput {
  return {
    type: 'discovery',
    title: 'Observation title',
    subtitle: 'Observation subtitle',
    facts: [],
    narrative: 'Observation narrative',
    concepts: [],
    files_read: [],
    files_modified: [],
    ...overrides
  };
}

function makeSession(db: Database, contentSessionId: string, memorySessionId: string): string {
  const sessionId = createSDKSession(db, contentSessionId, 'test-project', 'initial prompt');
  updateMemorySessionId(db, sessionId, memorySessionId);
  return memorySessionId;
}

function countObservations(db: Database): number {
  return (db.prepare('SELECT COUNT(*) AS count FROM observations').get() as { count: number }).count;
}

function rows(db: Database): Array<{ id: number; title: string | null; narrative: string | null }> {
  return db.prepare('SELECT id, title, narrative FROM observations ORDER BY id').all() as Array<{
    id: number;
    title: string | null;
    narrative: string | null;
  }>;
}

/** Drive the product's manual-save handler with a real store and a stubbed search sync. */
function saveHandler(store: SessionStore): (body: Record<string, unknown>) => Promise<{ status: number; body: any }> {
  const handlers: Record<string, (req: Request, res: Response) => void> = {};
  const app: any = {
    get: () => {},
    post: (path: string, fn: (req: Request, res: Response) => void) => { handlers[path] = fn; },
    delete: () => {}
  };
  const dbManager: any = {
    getSessionStore: () => store,
    getChromaSync: () => ({ syncObservation: async () => {} })
  };
  new MemoryRoutes(dbManager, 'default-project').setupRoutes(app);

  return async (body: Record<string, unknown>) => {
    const out = { status: 200, body: undefined as any, sent: false };
    const res: any = {
      json: (value: any) => { out.body = value; out.sent = true; return res; },
      status: (code: number) => { out.status = code; return res; }
    };
    Object.defineProperty(res, 'headersSent', { get: () => out.sent, set: (v: boolean) => { out.sent = v; } });
    handlers['/api/memory/save']({ body, path: '/api/memory/save', query: {} } as any, res);
    await Promise.resolve();
    return { status: out.status, body: out.body };
  };
}

describe('memory entry identity', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  it('keeps both entries when the title/body boundary moves', async () => {
    const save = saveHandler(store);
    const first = await save({ title: 'ab', text: 'c', project: 'boundary-a' });
    const second = await save({ title: 'a', text: 'bc', project: 'boundary-a' });

    expect(first.body?.success).toBe(true);
    expect(second.body?.success).toBe(true);
    expect(countObservations(store.db)).toBe(2);
    expect(second.body?.id).not.toBe(first.body?.id);
    expect(rows(store.db).map(r => r.narrative).sort()).toEqual(['bc', 'c']);
  });

  it('keeps both entries when the session/title boundary moves', async () => {
    const save = saveHandler(store);
    const first = await save({ title: 'qr', text: 'X', project: 'p' });
    const second = await save({ title: 'r', text: 'X', project: 'pq' });

    expect(first.body?.success).toBe(true);
    expect(second.body?.success).toBe(true);
    expect(countObservations(store.db)).toBe(2);
    expect(second.body?.id).not.toBe(first.body?.id);
  });

  it('keeps both entries when a field value contains separator characters', async () => {
    const save = saveHandler(store);
    const separators = ['\u0000', '\u0001', '\u001f', '\t', '\n', '\r', '|', ':', ';', ',', '-', '_', ' ', '::', '||', '<|>'];

    for (let i = 0; i < separators.length; i++) {
      const sep = separators[i];
      const project = `separator-${i}`;
      const before = countObservations(store.db);
      const first = await save({ title: 'a', text: `${sep}b`, project });
      const second = await save({ title: `a${sep}`, text: 'b', project });

      expect(first.body?.success).toBe(true);
      expect(second.body?.success).toBe(true);
      expect(second.body?.id).not.toBe(first.body?.id);
      expect(countObservations(store.db)).toBe(before + 2);
    }
  });

  it('keeps both entries when only the facts differ', () => {
    const db = new ClaudeMemDatabase(':memory:').db;
    try {
      const memorySessionId = makeSession(db, 'content-facts', 'memory-facts');
      const now = Date.now();
      storeObservation(db, memorySessionId, 'test-project', observation({ facts: ['alpha'] }), 1, 0, now);
      storeObservation(db, memorySessionId, 'test-project', observation({ facts: ['beta'] }), 1, 0, now + 1000);

      expect(countObservations(db)).toBe(2);
    } finally {
      db.close();
    }
  });

  it('keeps both entries when only the file lists differ', () => {
    const db = new ClaudeMemDatabase(':memory:').db;
    try {
      const memorySessionId = makeSession(db, 'content-files', 'memory-files');
      const now = Date.now();
      storeObservation(db, memorySessionId, 'test-project', observation({ files_read: ['/one.ts'] }), 1, 0, now);
      storeObservation(db, memorySessionId, 'test-project', observation({ files_read: ['/two.ts'] }), 1, 0, now + 1000);

      expect(countObservations(db)).toBe(2);
    } finally {
      db.close();
    }
  });

  it('keeps both entries through the store used by the save route when only facts differ', () => {
    makeSession(store.db, 'content-class', 'memory-class');
    const now = Date.now();
    store.storeObservation('memory-class', 'test-project', observation({ facts: ['alpha'] }), 1, 0, now);
    store.storeObservation('memory-class', 'test-project', observation({ facts: ['beta'] }), 1, 0, now + 1000);

    expect(countObservations(store.db)).toBe(2);
  });
});
