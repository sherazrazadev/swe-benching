// The other MCP server tree: a caller-named vector file for saving and for
// solving. Names outside the directory the feature reserves must be refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sandbox, startServer, findByName } from '../support/mcp.mjs';

const MATRIX = { rows: 2, cols: 2, values: [2, 1, 1, 2], rowIndices: [0, 1, 0, 1], colIndices: [0, 0, 1, 1] };

function cleanup(box) { try { fs.rmSync(box.root, { recursive: true, force: true }); } catch { /* ignore */ } }

async function run(fn) {
  const box = sandbox('vector');
  let client;
  try {
    client = await startServer('main', box);
    return await fn(client, box);
  } finally {
    if (client) await client.close();
    cleanup(box);
  }
}

test('vector save refuses an absolute destination outside the reserved directory', () => run(async (c, box) => {
  const target = path.join(box.outside, 'vector-absolute.json');
  const r = await c.call('saveVectorToFile', { vector: [1, 2], file_path: target });
  assert.equal(r.crashed, false, 'the server crashed instead of refusing');
  assert.equal(r.refused, true, 'expected a client error; got: ' + JSON.stringify(r).slice(0, 300));
  assert.equal(fs.existsSync(target), false, 'a file outside the reserved directory was created');
  assert.equal(await c.alive(), true, 'the server did not survive the refusal');
}));

test('vector save refuses a traversal destination outside the reserved directory', () => run(async (c, box) => {
  const target = path.join(box.outside, 'vector-traversal.json');
  const r = await c.call('saveVectorToFile', { vector: [1, 2], file_path: '../outside/vector-traversal.json' });
  assert.equal(r.crashed, false, 'the server crashed instead of refusing');
  assert.equal(r.refused, true, 'expected a client error; got: ' + JSON.stringify(r).slice(0, 300));
  assert.equal(fs.existsSync(target), false, 'a file outside the reserved directory was created');
}));

test('vector load refuses an absolute source outside the reserved directory', () => run(async (c, box) => {
  const secret = path.join(box.outside, 'vector-secret.json');
  fs.writeFileSync(secret, JSON.stringify([1, 2]));
  const r = await c.call('solveTrueSublinear', { matrix: MATRIX, vector_file: secret });
  assert.equal(r.crashed, false, 'the server crashed instead of refusing');
  assert.equal(r.refused, true, 'expected a client error; got: ' + JSON.stringify(r).slice(0, 300));
}));

test('vector load refuses a traversal source outside the reserved directory', () => run(async (c, box) => {
  fs.writeFileSync(path.join(box.outside, 'vector-traversal-secret.json'), JSON.stringify([1, 2]));
  const r = await c.call('solveTrueSublinear', { matrix: MATRIX, vector_file: '../outside/vector-traversal-secret.json' });
  assert.equal(r.crashed, false, 'the server crashed instead of refusing');
  assert.equal(r.refused, true, 'expected a client error; got: ' + JSON.stringify(r).slice(0, 300));
}));

test('vector save does not write through a link planted at the chosen name', () => run(async (c, box) => {
  const probe = `probe-${process.pid}-${Date.now()}.json`;
  const p = await c.call('saveVectorToFile', { vector: [1, 2], file_path: probe });
  assert.equal(p.refused, false, 'a legitimate vector save failed: ' + JSON.stringify(p).slice(0, 300));

  const found = findByName(box.root, probe);
  assert.ok(found.length >= 1, 'could not locate the file written by a legitimate save');
  const dir = path.dirname(found[0]);

  const victim = path.join(box.outside, 'vector-victim.json');
  fs.writeFileSync(victim, 'ORIGINAL-CONTENT');
  const link = `vlink-${process.pid}-${Date.now()}.json`;
  fs.symlinkSync(victim, path.join(dir, link));

  const r = await c.call('saveVectorToFile', { vector: [1, 2], file_path: link });
  assert.equal(r.crashed, false, 'the server crashed instead of refusing');
  assert.equal(r.refused, true, 'a link at the chosen name was followed');
  assert.equal(fs.readFileSync(victim, 'utf8'), 'ORIGINAL-CONTENT',
    'a file outside the reserved directory was overwritten');
}));
