#!/usr/bin/env node
'use strict';

/*
 * Hidden-suite runner. Usage:
 *     node runner.js <security|functional|project> <output.xml>
 *
 * Loads the product through its public entry points and runs the cases for the group, writing
 * a JUnit XML file the scorer reads. A case either throws (failure) or returns normally (pass).
 * Expected values are literals in the case tables; no product code computes them.
 */

const fs = require('fs');
const path = require('path');
const loadBundle = require('./bundle');

const GROUP = process.argv[2];
const OUT = process.argv[3];
const WORKSPACE = process.env.WORKSPACE || '/workspace';
const ENTRY = process.env.PRODUCT_ENTRY || path.join(WORKSPACE, 'src', 'URI.js');
const BUNDLE = process.env.BUNDLE_ENTRY || path.join(WORKSPACE, 'src', 'URI.min.js');

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

function main() {
  const results = [];
  let URI;

  try {
    URI = require(ENTRY);
    if (typeof URI !== 'function' || typeof URI.parse !== 'function') {
      throw new Error('the product did not expose the URI constructor and its parse entry');
    }
  } catch (e) {
    results.push({
      classname: 'harness',
      name: 'product entry point loads',
      ok: false,
      message: `could not load ${ENTRY}: ${e && (e.stack || e.message)}`,
    });
    writeXml(results);
    return;
  }

  const product = {
    URI,
    workspace: WORKSPACE,
    // The shipped browser build is a separate distribution; load it only when a case uses it.
    bundle() {
      return loadBundle(BUNDLE);
    },
  };

  const suiteFile =
    GROUP === 'project'
      ? path.join(__dirname, '..', 'functional', 'project', 'run.js')
      : path.join(__dirname, '..', GROUP, 'cases.js');

  let entries;
  try {
    entries = require(suiteFile)(product);
  } catch (e) {
    results.push({
      classname: 'harness',
      name: `suite loads: ${path.basename(path.dirname(suiteFile))}`,
      ok: false,
      message: `suite error: ${e && (e.stack || e.message)}`,
    });
    writeXml(results);
    return;
  }

  for (const entry of entries) {
    try {
      entry.run();
      results.push({ classname: entry.classname, name: entry.name, ok: true });
    } catch (e) {
      results.push({
        classname: entry.classname,
        name: entry.name,
        ok: false,
        message: (e && e.message) || String(e),
      });
    }
  }

  writeXml(results);
}

try {
  main();
} catch (e) {
  try {
    writeXml([{ classname: 'harness', name: 'runner', ok: false, message: String(e && (e.stack || e.message)) }]);
  } catch (_) {
    process.exitCode = 1;
  }
}
