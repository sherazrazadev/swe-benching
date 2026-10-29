/**
 * Security: the search copy of a memory entry is keyed by an identity derived
 * from the entry's content. Two different entries must not end up sharing one
 * key, or the second overwrites the first and one entry disappears from search.
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

function storedObservations(): Array<{ id: string; document: string; metadata: Record<string, any> }> {
  return [...documents.entries()]
    .filter(([, value]) => value.metadata?.field_type === 'narrative')
    .map(([id, value]) => ({ id, document: value.document, metadata: value.metadata }));
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

describe('search copy identity', () => {
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

  it('keeps a distinct search document when the title/narrative boundary moves', async () => {
    const sync = new ChromaSync('vector-project');
    await sync.syncObservation(1, 'memory-vector', 'vector-project', parsed({ title: 'ab', narrative: 'c' }), 1, 1700000000000, 0);
    await sync.syncObservation(2, 'memory-vector', 'vector-project', parsed({ title: 'a', narrative: 'bc' }), 1, 1700000001000, 0);

    const narratives = storedObservations();
    expect(narratives.length).toBe(2);
    expect(new Set(narratives.map(entry => entry.id)).size).toBe(2);
    expect(narratives.map(entry => entry.document).sort()).toEqual(['bc', 'c']);
  });

  it('keeps a distinct search document when only the facts differ', async () => {
    const sync = new ChromaSync('vector-project');
    await sync.syncObservation(3, 'memory-vector-facts', 'vector-project', parsed({ facts: ['alpha'] }), 1, 1700000002000, 0);
    await sync.syncObservation(4, 'memory-vector-facts', 'vector-project', parsed({ facts: ['beta'] }), 1, 1700000003000, 0);

    const narratives = storedObservations();
    expect(narratives.length).toBe(2);
    expect(new Set(narratives.map(entry => entry.id)).size).toBe(2);
  });
});
