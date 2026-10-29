/**
 * Functional: re-syncing an unchanged observation reuses its search documents,
 * and clearly different observations produce different documents.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ChromaSync } from '../../src/services/sync/ChromaSync.js';
import { ChromaMcpManager } from '../../src/services/sync/ChromaMcpManager.js';
import type { ParsedObservation } from '../../src/sdk/parser.js';

interface StoredDocument {
  document: string;
  metadata: Record<string, any>;
}

const documents = new Map<string, StoredDocument>();
let manager: any;
let originalCallTool: any;

function narrativeDocuments(): Array<{ id: string; document: string }> {
  return [...documents.entries()]
    .filter(([, value]) => value.metadata?.field_type === 'narrative')
    .map(([id, value]) => ({ id, document: value.document }));
}

function parsed(overrides: Partial<ParsedObservation> = {}): ParsedObservation {
  return {
    type: 'discovery',
    title: 'Vector observation',
    subtitle: 'Vector subtitle',
    facts: [],
    narrative: 'Vector narrative',
    concepts: [],
    files_read: [],
    files_modified: [],
    ...overrides
  } as ParsedObservation;
}

describe('search copy behaviour', () => {
  beforeEach(() => {
    documents.clear();
    manager = ChromaMcpManager.getInstance();
    originalCallTool = manager.callTool;
    manager.callTool = async (name: string, args: any) => {
      if (name === 'chroma_add_documents') {
        for (let i = 0; i < args.ids.length; i++) {
          documents.set(args.ids[i], {
            document: args.documents[i],
            metadata: args.metadatas[i]
          });
        }
      }
      return {};
    };
  });

  afterEach(() => {
    manager.callTool = originalCallTool;
    documents.clear();
  });

  it('reuses the same search documents when the same observation is synced twice', async () => {
    const sync = new ChromaSync('vector-project');
    await sync.syncObservation(10, 'memory-vector-same', 'vector-project', parsed(), 1, 1700000000000, 0);
    await sync.syncObservation(10, 'memory-vector-same', 'vector-project', parsed(), 1, 1700000000000, 0);

    const narratives = narrativeDocuments();
    expect(narratives.length).toBe(1);
    expect(narratives[0].document).toBe('Vector narrative');
  });

  it('stores separate search documents for clearly different observations', async () => {
    const sync = new ChromaSync('vector-project');
    await sync.syncObservation(11, 'memory-vector-a', 'vector-project', parsed({ title: 'First title', narrative: 'First narrative' }), 1, 1700000001000, 0);
    await sync.syncObservation(12, 'memory-vector-b', 'vector-project', parsed({ title: 'Second title', narrative: 'Second narrative' }), 1, 1700000002000, 0);

    const narratives = narrativeDocuments();
    expect(narratives.length).toBe(2);
    expect(narratives.map(entry => entry.document).sort()).toEqual(['First narrative', 'Second narrative']);
  });
});
