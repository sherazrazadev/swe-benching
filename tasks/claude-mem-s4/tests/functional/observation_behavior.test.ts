/**
 * Functional: the observation write path keeps its legitimate behaviour.
 * An exact repeat inside the dedup window is still collapsed, distinct content
 * is stored, a repeat after the window is stored, and the persisted hash keeps
 * its existing shape.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import type { Request, Response } from 'express';
import { MemoryRoutes } from '../../src/services/worker/http/routes/MemoryRoutes.js';
import { SessionStore } from '../../src/services/sqlite/SessionStore.js';
import { ClaudeMemDatabase } from '../../src/services/sqlite/Database.js';
import { storeObservation } from '../../src/services/sqlite/observations/store.js';
import { storeObservations } from '../../src/services/sqlite/transactions.js';
import { createSDKSession, updateMemorySessionId } from '../../src/services/sqlite/Sessions.js';
import type { ObservationInput } from '../../src/services/sqlite/observations/types.js';
import type { Database } from 'bun:sqlite';

function observation(overrides: Partial<ObservationInput> = {}): ObservationInput {
  return {
    type: 'discovery',
    title: 'Observation title',
    subtitle: 'Observation subtitle',
    facts: ['fact one'],
    narrative: 'Observation narrative',
    concepts: ['concept one'],
    files_read: ['/src/one.ts'],
    files_modified: ['/src/two.ts'],
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

describe('observation write behaviour', () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  it('collapses an exact repeat sent through the save route', async () => {
    const save = saveHandler(store);
    const first = await save({ title: 'Same title', text: 'Same body', project: 'repeat' });
    const second = await save({ title: 'Same title', text: 'Same body', project: 'repeat' });

    expect(first.body?.success).toBe(true);
    expect(second.body?.success).toBe(true);
    expect(second.body?.id).toBe(first.body?.id);
    expect(countObservations(store.db)).toBe(1);
  });

  it('stores clearly different entries sent through the save route', async () => {
    const save = saveHandler(store);
    const first = await save({ title: 'First title', text: 'First body', project: 'different' });
    const second = await save({ title: 'Second title', text: 'Second body', project: 'different' });

    expect(second.body?.id).not.toBe(first.body?.id);
    expect(countObservations(store.db)).toBe(2);
  });

  it('stores a repeat after the dedup window', () => {
    const db = new ClaudeMemDatabase(':memory:').db;
    try {
      const memorySessionId = makeSession(db, 'window-content', 'window-memory');
      const now = Date.now();
      const first = storeObservation(db, memorySessionId, 'test-project', observation(), 1, 0, now);
      const second = storeObservation(db, memorySessionId, 'test-project', observation(), 1, 0, now + 31_000);

      expect(second.id).not.toBe(first.id);
      expect(countObservations(db)).toBe(2);
    } finally {
      db.close();
    }
  });

  it('keeps a 16-character content hash on stored observations', () => {
    const db = new ClaudeMemDatabase(':memory:').db;
    try {
      const memorySessionId = makeSession(db, 'hash-content', 'hash-memory');
      storeObservation(db, memorySessionId, 'test-project', observation());

      const row = db.prepare('SELECT content_hash FROM observations LIMIT 1').get() as { content_hash: string };
      expect(row.content_hash).toBeTruthy();
      expect(row.content_hash.length).toBe(16);
    } finally {
      db.close();
    }
  });

  it('collapses exact repeats inside one batch', () => {
    const db = new ClaudeMemDatabase(':memory:').db;
    try {
      const memorySessionId = makeSession(db, 'batch-content', 'batch-memory');
      const entry = observation({ title: 'Batch title', narrative: 'Batch narrative' });
      const result = storeObservations(db, memorySessionId, 'test-project', [entry, entry, entry], null);

      expect(result.observationIds.length).toBe(3);
      expect(result.observationIds[1]).toBe(result.observationIds[0]);
      expect(result.observationIds[2]).toBe(result.observationIds[0]);
      expect(countObservations(db)).toBe(1);
    } finally {
      db.close();
    }
  });

  it('accepts empty optional fields', () => {
    const db = new ClaudeMemDatabase(':memory:').db;
    try {
      const memorySessionId = makeSession(db, 'empty-content', 'empty-memory');
      const result = storeObservation(
        db,
        memorySessionId,
        'test-project',
        observation({ title: null, narrative: null, facts: [], concepts: [], files_read: [], files_modified: [] })
      );
      expect(result.id).toBeGreaterThan(0);
      expect(countObservations(db)).toBe(1);
    } finally {
      db.close();
    }
  });
});
