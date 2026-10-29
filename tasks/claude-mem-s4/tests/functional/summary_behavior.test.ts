/**
 * Functional: the summary write path keeps its legitimate behaviour — an exact
 * repeat within the window is collapsed and a repeat after the window is stored.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ClaudeMemDatabase } from '../../src/services/sqlite/Database.js';
import { storeObservations } from '../../src/services/sqlite/transactions.js';
import { createSDKSession, updateMemorySessionId } from '../../src/services/sqlite/Sessions.js';
import type { SummaryInput } from '../../src/services/sqlite/summaries/types.js';
import type { Database } from 'bun:sqlite';

function summary(overrides: Partial<SummaryInput> = {}): SummaryInput {
  return {
    request: 'Same request',
    investigated: 'Same investigated',
    learned: 'Same learned',
    completed: 'Same completed',
    next_steps: 'Same next steps',
    notes: 'Same notes',
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

describe('summary write behaviour', () => {
  let db: Database;

  beforeEach(() => {
    db = new ClaudeMemDatabase(':memory:').db;
  });

  afterEach(() => {
    db.close();
  });

  it('collapses an exact repeat within the window', () => {
    const memorySessionId = makeSession(db, 'summary-repeat', 'summary-repeat-memory');
    const now = Date.now();
    const first = storeObservations(db, memorySessionId, 'test-project', [], summary(), 1, 0, now);
    const second = storeObservations(db, memorySessionId, 'test-project', [], summary(), 1, 0, now + 1000);

    expect(second.summaryId).toBe(first.summaryId);
    expect(countSummaries(db)).toBe(1);
  });

  it('stores an exact repeat after the window', () => {
    const memorySessionId = makeSession(db, 'summary-window', 'summary-window-memory');
    const now = Date.now();
    const first = storeObservations(db, memorySessionId, 'test-project', [], summary(), 1, 0, now);
    const second = storeObservations(db, memorySessionId, 'test-project', [], summary(), 1, 0, now + 31_000);

    expect(second.summaryId).not.toBe(first.summaryId);
    expect(countSummaries(db)).toBe(2);
  });

  it('stores clearly different summaries at the same time', () => {
    const memorySessionId = makeSession(db, 'summary-different', 'summary-different-memory');
    const now = Date.now();
    storeObservations(db, memorySessionId, 'test-project', [], summary({ request: 'First request' }), 1, 0, now);
    storeObservations(db, memorySessionId, 'test-project', [], summary({ request: 'Second request' }), 1, 0, now + 1000);

    expect(countSummaries(db)).toBe(2);
  });
});
