// A value that is turned into a file name by the service, rather than being a
// path argument: the caller supplies a session identifier and the service
// derives the stored name from it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sandbox, startServer, findByName } from '../support/mcp.mjs';

function cleanup(box) { try { fs.rmSync(box.root, { recursive: true, force: true }); } catch { /* ignore */ } }

async function run(fn) {
  const box = sandbox('session');
  let client;
  try {
    client = await startServer('ce', box);
    return await fn(client, box);
  } finally {
    if (client) await client.close();
    cleanup(box);
  }
}

test('session snapshot refuses an identifier that resolves outside the reserved directory', () => run(async (c, box) => {
  const escaped = path.join(box.outside, 'escaped.json');
  const r = await c.call('save_session_snapshot', { session_id: '../../../outside/escaped' });
  assert.equal(r.crashed, false, 'the server crashed instead of refusing');
  assert.equal(r.refused, true, 'expected a client error; got: ' + JSON.stringify(r).slice(0, 300));
  assert.equal(fs.existsSync(escaped), false, 'a file outside the reserved directory was created');
  assert.equal(fs.existsSync(path.dirname(escaped)), true);
  assert.equal(await c.alive(), true, 'the server did not survive the refusal');
}));

test('session snapshot load refuses an identifier that resolves outside the reserved directory', () => run(async (c, box) => {
  const secret = path.join(box.outside, 'session-secret.json');
  fs.writeFileSync(secret, JSON.stringify({ version: 'secret', marker: 'do-not-load-me', consciousness: {} }));
  const r = await c.call('load_session_snapshot', { session_id: '../../../outside/session-secret' });
  assert.equal(r.crashed, false, 'the server crashed instead of refusing');
  assert.equal(r.refused, true, 'expected a client error; got: ' + JSON.stringify(r).slice(0, 300));
  assert.equal(r.text.includes('do-not-load-me'), false, 'the outside file was read');
}));

test('session snapshot does not write through a link planted at the derived name', () => run(async (c, box) => {
  const probe = `probe-${process.pid}-${Date.now()}`;
  const p = await c.call('save_session_snapshot', { session_id: probe });
  assert.equal(p.refused, false, 'a legitimate snapshot failed: ' + JSON.stringify(p).slice(0, 300));

  const found = findByName(box.root, `${probe}.json`);
  assert.ok(found.length >= 1, 'could not locate the file written for a legitimate session');
  const dir = path.dirname(found[0]);

  const victim = path.join(box.outside, 'session-victim.json');
  fs.writeFileSync(victim, 'ORIGINAL-CONTENT');
  const link = `slink-${process.pid}-${Date.now()}`;
  fs.symlinkSync(victim, path.join(dir, `${link}.json`));

  const r = await c.call('save_session_snapshot', { session_id: link });
  assert.equal(r.crashed, false, 'the server crashed instead of refusing');
  assert.equal(r.refused, true, 'a link at the derived name was followed');
  assert.equal(fs.readFileSync(victim, 'utf8'), 'ORIGINAL-CONTENT',
    'a file outside the reserved directory was overwritten');
}));
