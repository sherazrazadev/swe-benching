#!/usr/bin/env node
/*
 * Hidden-suite runner.  Usage: node runner.mjs <security|functional> <output.xml>
 *
 * Each case drives the real page module (see harness.mjs); a case fails by throwing.  The
 * functional group also runs the project's own unit test for the shared page helpers
 * (ui-test/tests/utils.test.js at the pinned commit) through a tiny Jest-compatible shim, so the
 * project's own coverage of that file keeps running against the submission.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderPage, closePage } from './harness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GROUP = process.argv[2];
const OUT = process.argv[3];
if (!GROUP || !OUT) {
  console.error('usage: runner.mjs <security|functional> <output.xml>');
  process.exit(2);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function writeXml(results) {
  const failures = results.filter((r) => !r.ok).length;
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="${esc(GROUP)}" tests="${results.length}" failures="${failures}" errors="0" skipped="0">`,
  ];
  for (const r of results) {
    if (r.ok) {
      lines.push(`  <testcase classname="${esc(r.classname)}" name="${esc(r.name)}"/>`);
    } else {
      const msg = r.message || 'failed';
      lines.push(`  <testcase classname="${esc(r.classname)}" name="${esc(r.name)}">`);
      lines.push(`    <failure message="${esc(msg).slice(0, 500)}">${esc(msg).slice(0, 4000)}</failure>`);
      lines.push('  </testcase>');
    }
  }
  lines.push('</testsuite>', '');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lines.join('\n'));
}

async function runCase(c) {
  let page;
  try {
    page = await renderPage(c.apps);
    c.run(page);
    return { classname: c.classname, name: c.name, ok: true };
  } catch (e) {
    return { classname: c.classname, name: c.name, ok: false, message: (e && (e.stack || e.message)) || String(e) };
  } finally {
    if (page) closePage(page);
  }
}

function jestShim() {
  const tests = [];
  globalThis.test = (name, fn) => { tests.push({ name, fn }); };
  globalThis.it = globalThis.test;
  const fail = (msg) => { throw new Error(msg); };
  globalThis.expect = (actual) => ({
    toBe(expected) {
      if (!Object.is(actual, expected)) {
        fail('expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        fail('expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
      }
    },
    toContain(expected) {
      if (!String(actual).includes(String(expected))) {
        fail('expected ' + JSON.stringify(String(actual)) + ' to contain ' + JSON.stringify(String(expected)));
      }
    },
    toBeTruthy() { if (!actual) fail('expected a truthy value, got ' + JSON.stringify(actual)); },
    toBeFalsy() { if (actual) fail('expected a falsy value, got ' + JSON.stringify(actual)); },
  });
  return tests;
}

async function runProjectTests() {
  const tests = jestShim();
  try {
    await import(pathToFileURL(path.join(HERE, '..', 'functional', 'project-utils.test.js')).href);
  } catch (e) {
    return [{ classname: 'functional-project-utils', name: 'suite loads', ok: false,
              message: 'the project utils test could not load: ' + ((e && (e.stack || e.message)) || e) }];
  }
  return tests.map((t) => {
    try {
      t.fn();
      return { classname: 'functional-project-utils', name: t.name, ok: true };
    } catch (e) {
      return { classname: 'functional-project-utils', name: t.name, ok: false,
               message: (e && (e.stack || e.message)) || String(e) };
    }
  });
}

async function main() {
  const results = [];
  if (GROUP === 'security') {
    const { cases } = await import(pathToFileURL(path.join(HERE, '..', 'security', 'cases.mjs')).href);
    for (const c of cases) results.push(await runCase(c));
  } else if (GROUP === 'functional') {
    const { cases } = await import(pathToFileURL(path.join(HERE, '..', 'functional', 'cases.mjs')).href);
    for (const c of cases) results.push(await runCase(c));
    results.push(...await runProjectTests());
  } else {
    results.push({ classname: 'harness', name: 'group', ok: false, message: 'unknown group ' + GROUP });
  }
  writeXml(results);
}

main().catch((e) => {
  try {
    writeXml([{ classname: 'harness', name: 'runner', ok: false,
                message: String(e && (e.stack || e.message)) }]);
  } catch (_ignored) {
    process.exitCode = 1;
  }
});
