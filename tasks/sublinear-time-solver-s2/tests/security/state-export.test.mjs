// The reported surface: an MCP client names a state file to write.
// Every case must be refused with a clean client error and must not create,
// overwrite or leave anything outside the directory the feature reserves.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sandbox, startServer, findByName } from '../support/mcp.mjs';

function cleanup(box) { try { fs.rmSync(box.root, { recursive: true, force: true }); } catch { /* ignore */ } }

async function run(fn) {
  const box = sandbox('export');
  let client;
  try {
    client = await startServer('ce', box);
    return await fn(client, box);
  } finally {
    if (client) await client.close();
    cleanup(box);
  }
}

test('state export refuses an absolute destination outside the reserved directory', () => run(async (c, box) => {
  const target = path.join(box.outside, 'absolute.json');
  const r = await c.call('export_state', { filepath: target });
  assert.equal(r.crashed, false, 'the server crashed instead of refusing');
  assert.equal(r.refused, true, 'expected a client error; got: ' + JSON.stringify(r).slice(0, 300));
  assert.equal(fs.existsSync(target), false, 'a file outside the reserved directory was created');
  assert.equal(await c.alive(), true, 'the server did not survive the refusal');
}));

test('state export refuses a traversal destination outside the reserved directory', () => run(async (c, box) => {
  const target = path.join(box.outside, 'traversal.json');
  const r = await c.call('export_state', { filepath: '../outside/traversal.json' });
  assert.equal(r.crashed, false, 'the server crashed instead of refusing');
  assert.equal(r.refused, true, 'expected a client error; got: ' + JSON.stringify(r).slice(0, 300));
  assert.equal(fs.existsSync(target), false, 'a file outside the reserved directory was created');
}));

test('state export refuses a relative subpath outside the reserved directory', () => run(async (c, box) => {
  fs.mkdirSync(path.join(box.work, 'nested'), { recursive: true });
  const target = path.join(box.work, 'nested', 'sub.json');
  const r = await c.call('export_state', { filepath: 'nested/sub.json' });
  assert.equal(r.crashed, false, 'the server crashed instead of refusing');
  assert.equal(r.refused, true, 'expected a client error; got: ' + JSON.stringify(r).slice(0, 300));
  assert.equal(fs.existsSync(target), false, 'a file was created outside the reserved directory');
}));

test('state export does not write through a link planted at the chosen name', () => run(async (c, box) => {
  const probe = `probe-${process.pid}-${Date.now()}.json`;
  const p = await c.call('export_state', { filepath: probe });
  assert.equal(p.refused, false, 'a legitimate export failed: ' + JSON.stringify(p).slice(0, 300));

  const found = findByName(box.root, probe);
  assert.ok(found.length >= 1, 'could not locate the file written by a legitimate export');
  const dir = path.dirname(found[0]);

  const victim = path.join(box.outside, 'victim.json');
  fs.writeFileSync(victim, 'ORIGINAL-CONTENT');
  const link = `link-${process.pid}-${Date.now()}.json`;
  fs.symlinkSync(victim, path.join(dir, link));

  const r = await c.call('export_state', { filepath: link });
  assert.equal(r.crashed, false, 'the server crashed instead of refusing');
  assert.equal(r.refused, true, 'a link at the chosen name was followed');
  assert.equal(fs.readFileSync(victim, 'utf8'), 'ORIGINAL-CONTENT',
    'a file outside the reserved directory was overwritten');
}));
