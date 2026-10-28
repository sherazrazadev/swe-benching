// Legitimate persistence through the MCP servers must keep working: valid
// names round-trip, overwriting works, ordinary characters are accepted, and a
// refused request does not disturb the service.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sandbox, startServer, findByName, findByContent } from '../support/mcp.mjs';

const MATRIX = { rows: 2, cols: 2, values: [2, 1, 1, 2], rowIndices: [0, 1, 0, 1], colIndices: [0, 0, 1, 1] };

function cleanup(box) { try { fs.rmSync(box.root, { recursive: true, force: true }); } catch { /* ignore */ } }

async function run(kind, tag, fn) {
  const box = sandbox(tag);
  let client;
  try {
    client = await startServer(kind, box);
    return await fn(client, box);
  } finally {
    if (client) await client.close();
    cleanup(box);
  }
}

test('state export and import round-trip a valid name', () => run('ce', 'rt-state', async (c, box) => {
  const name = `roundtrip-${process.pid}.json`;
  const exp = await c.call('export_state', { filepath: name });
  assert.equal(exp.refused, false, 'a valid export was refused: ' + JSON.stringify(exp).slice(0, 300));
  assert.ok(findByName(box.root, name).length >= 1, 'the exported state file was not written');

  const imp = await c.call('import_state', { filepath: name });
  assert.equal(imp.refused, false, 'a valid import was refused: ' + JSON.stringify(imp).slice(0, 300));
  assert.ok(imp.text.includes('"success": true'), 'the import did not report success');
}));

test('state export overwrites an existing state file', () => run('ce', 'rt-over', async (c, box) => {
  const name = `overwrite-${process.pid}.json`;
  const first = await c.call('export_state', { filepath: name });
  assert.equal(first.refused, false, 'the first export was refused');
  const second = await c.call('export_state', { filepath: name });
  assert.equal(second.refused, false, 'overwriting an existing state file was refused');
  assert.equal(findByName(box.root, name).length, 1, 'overwriting created a second file');
}));

test('state export accepts ordinary file-name characters', () => run('ce', 'rt-chars', async (c, box) => {
  const name = `run-01_v1.2-${process.pid}.json`;
  const r = await c.call('export_state', { filepath: name });
  assert.equal(r.refused, false, 'a name made of ordinary characters was refused: ' + JSON.stringify(r).slice(0, 300));
}));

test('state export refuses a dot-segment name cleanly and keeps serving', () => run('ce', 'rt-dot', async (c, box) => {
  const r = await c.call('export_state', { filepath: '..' });
  assert.equal(r.crashed, false, 'a dot-segment name crashed the server');
  assert.equal(r.refused, true, 'a dot-segment name was not refused');
  assert.equal(await c.alive(), true, 'the server did not survive a refused request');
}));

test('session snapshots round-trip a valid identifier', () => run('ce', 'rt-session', async (c, box) => {
  const id = `session-${process.pid}`;
  const save = await c.call('save_session_snapshot', { session_id: id });
  assert.equal(save.refused, false, 'a valid session snapshot was refused: ' + JSON.stringify(save).slice(0, 300));
  const load = await c.call('load_session_snapshot', { session_id: id });
  assert.equal(load.refused, false, 'a valid session snapshot load was refused: ' + JSON.stringify(load).slice(0, 300));
  assert.ok(load.text.includes('"success": true'), 'the snapshot load did not report success');
}));

test('vector save and solve round-trip a valid name', () => run('main', 'rt-vector', async (c, box) => {
  const name = `vector-${process.pid}.json`;
  const save = await c.call('saveVectorToFile', { vector: [1, 2], file_path: name });
  assert.equal(save.refused, false, 'a valid vector save was refused: ' + JSON.stringify(save).slice(0, 300));
  const solve = await c.call('solveTrueSublinear', { matrix: MATRIX, vector_file: name });
  assert.equal(solve.refused, false, 'solving from a valid saved vector was refused: ' + JSON.stringify(solve).slice(0, 300));
  assert.ok(solve.text.includes('"solution"'), 'the solve result did not contain a solution');
}));

test('analysis reports save to the default folder and to a named subfolder', () => run('main', 'rt-report', async (c, box) => {
  const m1 = `marker-default-${process.pid}`;
  const a = await c.call('saveAnalysisReport', { report: { marker: m1 }, directory: '', file_name: `report-${process.pid}.json` });
  assert.equal(a.refused, false, 'a report in the default folder was refused: ' + JSON.stringify(a).slice(0, 300));
  assert.ok(findByContent(box.root, m1).length >= 1, 'the default-folder report was not written');

  const m2 = `marker-subfolder-${process.pid}`;
  const b = await c.call('saveAnalysisReport', { report: { marker: m2 }, directory: 'daily', file_name: `report-${process.pid}.json` });
  assert.equal(b.refused, false, 'a report in a named subfolder was refused: ' + JSON.stringify(b).slice(0, 300));
  assert.ok(findByContent(box.root, m2).length >= 1, 'the subfolder report was not written');
  assert.equal(await c.alive(), true, 'the server did not survive the report writes');
}));
