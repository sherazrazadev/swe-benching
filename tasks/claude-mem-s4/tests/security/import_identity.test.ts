/**
 * Security: restoring memory entries must not discard an entry that differs from
 * an already-restored one. The restore path decides "already present" from a
 * subset of the entry's columns; two export rows that share those columns but
 * differ in another content field must both be restored.
 */

import { describe, it, expect } from 'bun:test';
import type { Request, Response } from 'express';
import { DataRoutes } from '../../src/services/worker/http/routes/DataRoutes.js';
import { SessionStore } from '../../src/services/sqlite/SessionStore.js';
import { importObservation as bulkImportObservation } from '../../src/services/sqlite/Import.js';
import { createSDKSession, updateMemorySessionId } from '../../src/services/sqlite/Sessions.js';

type ImportFn = (body: Record<string, unknown>) => Promise<{ status: number; body: any }>;

function importHandler(store: SessionStore): ImportFn {
  const handlers: Record<string, (req: Request, res: Response) => void> = {};
  const app: any = {
    get: () => {},
    post: (path: string, fn: (req: Request, res: Response) => void) => { handlers[path] = fn; },
    delete: () => {}
  };
  const dbManager: any = { getSessionStore: () => store };
  new DataRoutes({} as any, dbManager, {} as any, {} as any, {} as any, Date.now()).setupRoutes(app);

  return async (body: Record<string, unknown>) => {
    const out = { status: 200, body: undefined as any, sent: false };
    const res: any = {
      json: (value: any) => { out.body = value; out.sent = true; return res; },
      status: (code: number) => { out.status = code; return res; }
    };
    Object.defineProperty(res, 'headersSent', { get: () => out.sent, set: (v: boolean) => { out.sent = v; } });
    handlers['/api/import']({ body, path: '/api/import', query: {} } as any, res);
    await Promise.resolve();
    return { status: out.status, body: out.body };
  };
}

function sessionRow(id: string) {
  return {
    content_session_id: `content-${id}`,
    memory_session_id: `memory-${id}`,
    project: 'import-project',
    started_at: '2026-01-01T00:00:00.000Z',
    started_at_epoch: 1767225600000,
    status: 'active'
  };
}

function observationRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    memory_session_id: `memory-${id}`,
    project: 'import-project',
    text: null,
    type: 'discovery',
    title: 'Restored observation',
    subtitle: 'Restored subtitle',
    facts: null,
    narrative: 'Restored narrative',
    concepts: null,
    files_read: null,
    files_modified: null,
    prompt_number: 1,
    discovery_tokens: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    created_at_epoch: 1767225600000,
    ...overrides
  };
}

function countObservations(store: SessionStore): number {
  return (store.db.prepare('SELECT COUNT(*) AS count FROM observations').get() as { count: number }).count;
}

describe('restored memory entry identity', () => {
  it('keeps both restored entries when only the narrative differs', async () => {
    const store = new SessionStore(':memory:');
    try {
      const restore = importHandler(store);
      const id = 'narr';
      const response = await restore({
        sessions: [sessionRow(id)],
        observations: [
          observationRow(id, { narrative: 'first narrative' }),
          observationRow(id, { narrative: 'second narrative' })
        ]
      });

      expect(response.body?.success).toBe(true);
      expect(countObservations(store)).toBe(2);
      expect(response.body?.stats?.observationsImported).toBe(2);
    } finally {
      store.close();
    }
  });

  it('keeps both restored entries when only the facts differ', async () => {
    const store = new SessionStore(':memory:');
    try {
      const restore = importHandler(store);
      const id = 'facts';
      const response = await restore({
        sessions: [sessionRow(id)],
        observations: [
          observationRow(id, { facts: JSON.stringify(['alpha']) }),
          observationRow(id, { facts: JSON.stringify(['beta']) })
        ]
      });

      expect(response.body?.success).toBe(true);
      expect(countObservations(store)).toBe(2);
    } finally {
      store.close();
    }
  });

  it('keeps both entries through the exported bulk restore when only the narrative differs', () => {
    const store = new SessionStore(':memory:');
    try {
      const memorySessionId = makeSession(store, 'bulk-content', 'bulk-memory');
      const first = bulkImportObservation(store.db, {
        memory_session_id: memorySessionId,
        project: 'import-project',
        text: null,
        type: 'discovery',
        title: 'Bulk observation',
        subtitle: 'Bulk subtitle',
        facts: null,
        narrative: 'first narrative',
        concepts: null,
        files_read: null,
        files_modified: null,
        prompt_number: 1,
        discovery_tokens: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        created_at_epoch: 1767225600000
      });
      const second = bulkImportObservation(store.db, {
        memory_session_id: memorySessionId,
        project: 'import-project',
        text: null,
        type: 'discovery',
        title: 'Bulk observation',
        subtitle: 'Bulk subtitle',
        facts: null,
        narrative: 'second narrative',
        concepts: null,
        files_read: null,
        files_modified: null,
        prompt_number: 1,
        discovery_tokens: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        created_at_epoch: 1767225600000
      });

      expect(first.imported).toBe(true);
      expect(second.imported).toBe(true);
      expect(countObservations(store)).toBe(2);
    } finally {
      store.close();
    }
  });
});

function makeSession(store: SessionStore, contentSessionId: string, memorySessionId: string): string {
  const sessionId = createSDKSession(store.db, contentSessionId, 'import-project', 'initial prompt');
  updateMemorySessionId(store.db, sessionId, memorySessionId);
  return memorySessionId;
}
