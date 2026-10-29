/**
 * Security: session summaries are memory entries too. When the product skips a
 * summary because it believes one with the same content is already stored, a
 * summary that differs in any field must still be stored.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ClaudeMemDatabase } from '../../src/services/sqlite/Database.js';
import { storeObservations } from '../../src/services/sqlite/transactions.js';
import { createSDKSession, updateMemorySessionId } from '../../src/services/sqlite/Sessions.js';
import { SessionStore } from '../../src/services/sqlite/SessionStore.js';
import type { SummaryInput } from '../../src/services/sqlite/summaries/types.js';
import type { Database } from 'bun:sqlite';

function summary(overrides: Partial<SummaryInput> = {}): SummaryInput {
  return {
    request: 'Summary request',
    investigated: 'Summary investigated',
    learned: 'Summary learned',
    completed: 'Summary completed',
    next_steps: 'Summary next steps',
    notes: null,
    ...overrides
  };
}

function makeSession(db: Database, contentSessionId: string, memorySessionId: string): string {
  const sessionId = createSDKSession(db, contentSessionId, 'test-project', 'initial prompt');
  updateMemorySessionId(db, sessionId, memorySessionId);
  return memorySessionId;
}

function countSummaries(db: Database): number {
  return (db.prepare('SELECT COUNT(*) AS count FROM session_summaries').get() as { count: number }).count;
}

describe('summary identity', () => {
  let db: Database;

  beforeEach(() => {
    db = new ClaudeMemDatabase(':memory:').db;
  });

  afterEach(() => {
    db.close();
  });

  it('keeps both summaries when the field boundary moves', () => {
    const memorySessionId = makeSession(db, 'summary-boundary', 'summary-boundary-memory');
    const now = Date.now();
    storeObservations(db, memorySessionId, 'test-project', [], summary({ request: 'ab', investigated: 'c' }), 1, 0, now);
    storeObservations(db, memorySessionId, 'test-project', [], summary({ request: 'a', investigated: 'bc' }), 1, 0, now + 1000);

    expect(countSummaries(db)).toBe(2);
  });

  it('keeps both summaries when a value contains separator characters', () => {
    const separators = ['\u0000', '\u0001', '\u001f', '\t', '\n', '\r', '|', ':', ';', ',', '-', '_', ' ', '::', '||', '<|>'];

    for (let i = 0; i < separators.length; i++) {
      const sep = separators[i];
      const memorySessionId = makeSession(db, `summary-sep-${i}`, `summary-sep-memory-${i}`);
      const now = Date.now();
      const before = countSummaries(db);
      storeObservations(db, memorySessionId, 'test-project', [], summary({ request: 'a', investigated: `${sep}b` }), 1, 0, now);
      storeObservations(db, memorySessionId, 'test-project', [], summary({ request: `a${sep}`, investigated: 'b' }), 1, 0, now + 1000);

      expect(countSummaries(db)).toBe(before + 2);
    }
  });

  it('keeps both summaries through the store used by the worker when the field boundary moves', () => {
    const store = new SessionStore(':memory:');
    try {
      makeSession(store.db, 'summary-class', 'summary-class-memory');
      const now = Date.now();
      store.storeObservations('summary-class-memory', 'test-project', [], summary({ request: 'ab', investigated: 'c' }), 1, 0, now);
      store.storeObservations('summary-class-memory', 'test-project', [], summary({ request: 'a', investigated: 'bc' }), 1, 0, now + 1000);

      expect(countSummaries(store.db)).toBe(2);
    } finally {
      store.close();
    }
  });
});
