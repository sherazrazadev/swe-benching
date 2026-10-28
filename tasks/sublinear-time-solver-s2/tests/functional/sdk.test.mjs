// Coupled must-keep-working behaviour: the state persistence API is also used
// directly by programs that embed the SDK, and those callers choose their own
// destination path. That use must keep working exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const WORKSPACE = process.env.WORKSPACE_DIR || '/workspace';

async function loadExplorer() {
  const mod = await import(pathToFileURL(`${WORKSPACE}/src/consciousness-explorer/index.js`).href);
  return mod.ConsciousnessExplorer;
}

test('embedded SDK state persistence writes and reads an embedder-chosen path', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-state-'));
  try {
    const ConsciousnessExplorer = await loadExplorer();
    const explorer = new ConsciousnessExplorer({ enableMonitoring: false, enableWasm: false });
    const target = path.join(root, 'chosen', 'nested', 'state.json');
    fs.mkdirSync(path.dirname(target), { recursive: true });

    await explorer.exportState(target);
    assert.equal(fs.existsSync(target), true, 'the embedder-chosen destination was not written');
    const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
    assert.equal(typeof parsed, 'object', 'the written state is not a JSON object');

    await explorer.importState(target);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('embedded SDK state persistence can write a bare relative destination', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdk-rel-'));
  const cwd = process.cwd();
  try {
    const ConsciousnessExplorer = await loadExplorer();
    const explorer = new ConsciousnessExplorer({ enableMonitoring: false, enableWasm: false });
    process.chdir(root);
    await explorer.exportState('relative-state.json');
    assert.equal(fs.existsSync(path.join(root, 'relative-state.json')), true,
      'a relative destination chosen by the embedder was not written');
    await explorer.importState('relative-state.json');
  } finally {
    process.chdir(cwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
