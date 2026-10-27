#!/usr/bin/env node
'use strict';

/*
 * Hidden-suite runner. Usage:
 *     node runner.js <security|functional> <output.xml>
 *
 * Drives the product through its public entry points (the compile function exported by the
 * published package, and the published command-line tool), runs every case in the group, and
 * writes a JUnit XML file the scorer reads. A case either throws (failure) or returns normally.
 * Expected values and fixtures are built here; no product code computes them.
 */

const fs = require('fs');
const path = require('path');

const GROUP = process.argv[2];
const OUT = process.argv[3];

const WORKSPACE = process.env.PRODUCT_ROOT || '/workspace';
const PRODUCT_ENTRY =
  process.env.PRODUCT_ENTRY || path.join(WORKSPACE, 'packages', 'mjml', 'lib', 'index.js');
const PRODUCT_CLI =
  process.env.PRODUCT_CLI || path.join(WORKSPACE, 'packages', 'mjml', 'bin', 'mjml');

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function writeXml(results) {
  const failures = results.filter(r => !r.ok).length;
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

async function main() {
  const results = [];
  let mjml2html;
  try {
    mjml2html = require(PRODUCT_ENTRY);
    if (typeof mjml2html !== 'function' && typeof mjml2html.default === 'function') {
      mjml2html = mjml2html.default;
    }
    if (typeof mjml2html !== 'function') {
      throw new Error('the published package does not export a compile function');
    }
  } catch (e) {
    results.push({
      classname: 'harness', name: 'product entry point loads',
      ok: false, message: `could not load ${PRODUCT_ENTRY}: ${e && (e.stack || e.message)}`,
    });
    writeXml(results);
    return;
  }

  const ctx = { mjml2html, cli: PRODUCT_CLI, node: process.execPath, workspace: WORKSPACE };
  const mods = GROUP === 'functional'
    ? [path.join(__dirname, '..', 'functional', 'cases.js'),
       path.join(__dirname, '..', 'functional', 'project.js')]
    : [path.join(__dirname, '..', 'security', 'cases.js')];

  for (const mod of mods) {
    let entries;
    try {
      entries = await require(mod)(ctx);
    } catch (e) {
      results.push({
        classname: 'harness', name: `suite loads: ${path.basename(mod)}`,
        ok: false, message: `suite error: ${e && (e.stack || e.message)}`,
      });
      continue;
    }
    for (const entry of entries) {
      try {
        entry.run();
        results.push({ classname: entry.classname, name: entry.name, ok: true });
      } catch (e) {
        results.push({
          classname: entry.classname, name: entry.name, ok: false,
          message: (e && e.message) || String(e),
        });
      }
    }
  }

  writeXml(results);
}

main().catch(e => {
  try {
    writeXml([{ classname: 'harness', name: 'runner', ok: false, message: String(e && (e.stack || e.message)) }]);
  } catch (_) {
    process.exitCode = 1;
  }
});
