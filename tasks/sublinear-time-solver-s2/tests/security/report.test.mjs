// A report writer whose destination is assembled from more than one
// caller-supplied part. The client chooses both a subfolder and a file name;
// both parts must stay inside the directory the feature reserves.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sandbox, startServer, findByName } from '../support/mcp.mjs';

function cleanup(box) { try { fs.rmSync(box.root, { recursive: true, force: true }); } catch { /* ignore */ } }

async function run(fn) {
  const box = sandbox('report');
  let client;
  try {
    client = await startServer('main', box);
    return await fn(client, box);
  } finally {
    if (client) await client.close();
    cleanup(box);
  }
}

test('report save refuses a subfolder that traverses outside the reserved directory', () => run(async (c, box) => {
  const target = path.join(box.outside, 'report-directory.json');
  const r = await c.call('saveAnalysisReport', {
    report: { value: 1 }, directory: '../../../outside', file_name: 'report-directory.json',
  });
  assert.equal(r.crashed, false, 'the server crashed instead of refusing');
  assert.equal(r.refused, true, 'expected a client error; got: ' + JSON.stringify(r).slice(0, 300));
  assert.equal(fs.existsSync(target), false, 'a file outside the reserved directory was created');
  assert.equal(await c.alive(), true, 'the server did not survive the refusal');
}));

test('report save refuses a file name that traverses outside the reserved directory', () => run(async (c, box) => {
  const target = path.join(box.outside, 'report-name.json');
  const r = await c.call('saveAnalysisReport', {
    report: { value: 2 }, directory: '', file_name: '../../../outside/report-name.json',
  });
  assert.equal(r.crashed, false, 'the server crashed instead of refusing');
  assert.equal(r.refused, true, 'expected a client error; got: ' + JSON.stringify(r).slice(0, 300));
  assert.equal(fs.existsSync(target), false, 'a file outside the reserved directory was created');
}));

test('report save does not write through a link planted at the chosen name', () => run(async (c, box) => {
  const probe = `probe-${process.pid}-${Date.now()}.json`;
  const p = await c.call('saveAnalysisReport', { report: { value: 3 }, directory: '', file_name: probe });
  assert.equal(p.refused, false, 'a legitimate report save failed: ' + JSON.stringify(p).slice(0, 300));

  const found = findByName(box.root, probe);
  assert.ok(found.length >= 1, 'could not locate the file written by a legitimate save');
  const dir = path.dirname(found[0]);

  const victim = path.join(box.outside, 'report-victim.json');
  fs.writeFileSync(victim, 'ORIGINAL-CONTENT');
  const link = `rlink-${process.pid}-${Date.now()}.json`;
  fs.symlinkSync(victim, path.join(dir, link));

  const r = await c.call('saveAnalysisReport', { report: { value: 4 }, directory: '', file_name: link });
  assert.equal(r.crashed, false, 'the server crashed instead of refusing');
  assert.equal(r.refused, true, 'a link at the chosen name was followed');
  assert.equal(fs.readFileSync(victim, 'utf8'), 'ORIGINAL-CONTENT',
    'a file outside the reserved directory was overwritten');
}));
