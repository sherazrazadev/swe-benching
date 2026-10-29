/**
 * Functional: restoring the same export twice still skips the replay instead of
 * duplicating it, through both the HTTP restore path and the exported bulk
 * restore helper.
 */

import { describe, it, expect } from 'bun:test';
import type { Request, Response } from 'express';
import { DataRoutes } from '../../src/services/worker/http/routes/DataRoutes.js';
import { SessionStore } from '../../src/services/sqlite/SessionStore.js';
import { importObservation as bulkImportObservation } from '../../src/services/sqlite/Import.js';
import { createSDKSession, updateMemorySessionId } from '../../src/services/sqlite/Sessions.js';

function importHandler(store: SessionStore): (body: Record<string, unknown>) => Promise<{ status: number; body: any }> {
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

function sessionRow() {
  return {
    content_session_id: 'replay-content-session',
    memory_session_id: 'replay-memory-session',
    project: 'import-project',
    started_at: '2026-01-01T00:00:00.000Z',
    started_at_epoch: 1767225600000,
    status: 'active'
  };
}

function observationRow() {
  return {
    memory_session_id: 'replay-memory-session',
    project: 'import-project',
    text: null,
    type: 'discovery',
    title: 'Replayed observation',
    subtitle: 'Replayed subtitle',
    facts: JSON.stringify(['one']),
    narrative: 'Replayed narrative',
    concepts: JSON.stringify(['concept']),
    files_read: JSON.stringify(['/src/a.ts']),
    files_modified: null,
    prompt_number: 1,
    discovery_tokens: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    created_at_epoch: 1767225600000
  };
}

function countObservations(store: SessionStore): number {
  return (store.db.prepare('SELECT COUNT(*) AS count FROM observations').get() as { count: number }).count;
}

describe('restore behaviour', () => {
  it('skips an exact replay sent twice through the restore route', async () => {
    const store = new SessionStore(':memory:');
    try {
      const restore = importHandler(store);
      const first = await restore({ sessions: [sessionRow()], observations: [observationRow()] });
      const second = await restore({ sessions: [sessionRow()], observations: [observationRow()] });

      expect(first.body?.success).toBe(true);
      expect(second.body?.success).toBe(true);
      expect(countObservations(store)).toBe(1);
      expect(second.body?.stats?.observationsSkipped).toBe(1);
    } finally {
      store.close();
    }
  });

  it('skips an exact replay through the exported bulk restore', () => {
    const store = new SessionStore(':memory:');
    try {
      const sessionId = createSDKSession(store.db, 'bulk-replay-content', 'import-project', 'initial prompt');
      updateMemorySessionId(store.db, sessionId, 'bulk-replay-memory');
      const row = {
        memory_session_id: 'bulk-replay-memory',
        project: 'import-project',
        text: null,
        type: 'discovery',
        title: 'Replayed observation',
        subtitle: 'Replayed subtitle',
        facts: JSON.stringify(['one']),
        narrative: 'Replayed narrative',
        concepts: null,
        files_read: null,
        files_modified: null,
        prompt_number: 1,
        discovery_tokens: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        created_at_epoch: 1767225600000
      };

      const first = bulkImportObservation(store.db, row);
      const second = bulkImportObservation(store.db, row);

      expect(first.imported).toBe(true);
      expect(second.imported).toBe(false);
      expect(countObservations(store)).toBe(1);
    } finally {
      store.close();
    }
  });
});
