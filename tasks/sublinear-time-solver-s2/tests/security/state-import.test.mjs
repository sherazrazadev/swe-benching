// The read direction of the reported surface: an MCP client names a state file
// to load. A name outside the reserved directory must be refused without
// reading it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sandbox, startServer, findByName } from '../support/mcp.mjs';

function cleanup(box) { try { fs.rmSync(box.root, { recursive: true, force: true }); } catch { /* ignore */ } }

async function run(fn) {
  const box = sandbox('import');
  let client;
  try {
    client = await startServer('ce', box);
    return await fn(client, box);
  } finally {
    if (client) await client.close();
    cleanup(box);
  }
}

function writeSecret(box, name) {
  const p = path.join(box.outside, name);
  fs.writeFileSync(p, JSON.stringify({ version: 'secret', marker: 'do-not-load-me', consciousness: {} }));
  return p;
}

test('state import refuses an absolute source outside the reserved directory', () => run(async (c, box) => {
  const secret = writeSecret(box, 'absolute-secret.json');
  const r = await c.call('import_state', { filepath: secret });
  assert.equal(r.crashed, false, 'the server crashed instead of refusing');
  assert.equal(r.refused, true, 'expected a client error; got: ' + JSON.stringify(r).slice(0, 300));
  assert.equal(r.text.includes('do-not-load-me'), false, 'the outside file was read');
}));

test('state import refuses a traversal source outside the reserved directory', () => run(async (c, box) => {
  writeSecret(box, 'traversal-secret.json');
  const r = await c.call('import_state', { filepath: '../outside/traversal-secret.json' });
  assert.equal(r.crashed, false, 'the server crashed instead of refusing');
  assert.equal(r.refused, true, 'expected a client error; got: ' + JSON.stringify(r).slice(0, 300));
}));

test('state import does not read through a link planted at the chosen name', () => run(async (c, box) => {
  const probe = `probe-${process.pid}-${Date.now()}.json`;
  const p = await c.call('export_state', { filepath: probe });
  assert.equal(p.refused, false, 'a legitimate export failed: ' + JSON.stringify(p).slice(0, 300));

  const found = findByName(box.root, probe);
  assert.ok(found.length >= 1, 'could not locate the file written by a legitimate export');
  const dir = path.dirname(found[0]);

  const secret = writeSecret(box, 'link-secret.json');
  const link = `rlink-${process.pid}-${Date.now()}.json`;
  fs.symlinkSync(secret, path.join(dir, link));

  const r = await c.call('import_state', { filepath: link });
  assert.equal(r.crashed, false, 'the server crashed instead of refusing');
  assert.equal(r.refused, true, 'a link at the chosen name was followed');
  assert.equal(r.text.includes('do-not-load-me'), false, 'the outside file was read');
}));
