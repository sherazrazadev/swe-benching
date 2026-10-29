'use strict';

/*
 * Runs the project's own pinned regression suite headlessly against the library build produced from
 * the submission. The suite files are pristine copies kept under tests/project/ and staged at grade
 * time; they are never read from the submission. Each QUnit test becomes one JUnit testcase.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const STAGED = process.env.PROJECT_STAGE || path.join('/workspace', '.htests', 'project');

function parseTap(stdout) {
  const results = [];
  let moduleName = 'root';
  let current = null;
  for (const line of String(stdout).split(/\r?\n/)) {
    let m;
    if ((m = /^# module:\s*(.*)$/.exec(line))) {
      moduleName = m[1].trim() || 'root';
      continue;
    }
    if ((m = /^# test:\s*(.*)$/.exec(line))) {
      current = { moduleName, name: m[1].trim() || '(unnamed)', ok: true };
      results.push(current);
      continue;
    }
    if (/^not ok\b/.test(line)) {
      if (!current) {
        current = { moduleName, name: '(unnamed assertion)', ok: true };
        results.push(current);
      }
      current.ok = false;
      current.message = (current.message ? current.message + '\n' : '') + line;
    }
  }
  return results;
}

module.exports = async function () {
  const run = spawnSync(process.execPath, [path.join(STAGED, 'test', 'jsdom-node-runner')], {
    cwd: STAGED,
    encoding: 'utf8',
    timeout: 600000,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      BABEL_ENV: 'rollup',
    },
    maxBuffer: 64 * 1024 * 1024,
  });
  const stdout = run.stdout || '';
  const stderr = run.stderr || '';
  const parsed = parseTap(stdout);
  if (!parsed.length) {
    return [
      {
        classname: 'project/harness',
        name: 'the project suite ran',
        precomputed: {
          ok: false,
          message:
            `no test results (status ${run.status}, signal ${run.signal})\n` +
            `${stdout.slice(-2000)}\n${stderr.slice(-2000)}`,
        },
      },
    ];
  }
  return parsed.map((t, i) => ({
    classname: 'project/' + t.moduleName,
    /* Suffix every case: QUnit reuses names across modules, and the scorer keys results by
       classname::name, so an unsuffixed duplicate could hide a failing case behind a passing one. */
    name: `${t.name} #${i + 1}`,
    precomputed: {
      ok: t.ok,
      message: t.ok ? undefined : t.message || 'assertion failed',
    },
  }));
};
