#!/usr/bin/env node
// Runs one compiled hidden-test bundle under jsdom and writes JUnit XML.
const fs = require('fs');
const path = require('path');
const {pathToFileURL} = require('url');

const jsdomPath = process.env.CWE_JSDOM || '/opt/harness/node_modules/jsdom';
const {JSDOM} = require(jsdomPath);

function setupDom() {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  global.window = w;
  global.document = w.document;
  global.self = w;
  for (const key of [
    'Node', 'Element', 'HTMLElement', 'SVGElement', 'MathMLElement', 'DocumentFragment',
    'Event', 'CustomEvent', 'MutationObserver', 'EventTarget', 'getComputedStyle',
    'requestAnimationFrame', 'cancelAnimationFrame', 'location', 'history',
    'HTMLIFrameElement', 'HTMLScriptElement', 'HTMLObjectElement', 'SVGAnimateElement',
  ]) {
    if (w[key] !== undefined) {
      try { global[key] = w[key]; } catch {}
    }
  }
  for (const key of Object.getOwnPropertyNames(w)) {
    if (!(key in global)) {
      try { global[key] = w[key]; } catch {}
    }
  }
  try { Object.defineProperty(global, 'navigator', {value: w.navigator, configurable: true}); } catch {}
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function writeXml(outPath, group, results) {
  const failures = results.filter((r) => !r.ok).length;
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<testsuite name="${esc(group)}" tests="${results.length}" failures="${failures}" errors="0" skipped="0">\n`;
  for (const r of results) {
    xml += `  <testcase classname="${esc(group)}" name="${esc(r.name)}">`;
    if (!r.ok) {
      xml += `\n    <failure message="${esc((r.error || 'failed').split('\n')[0])}">${esc(r.error || '')}</failure>\n  `;
    }
    xml += '</testcase>\n';
  }
  xml += '</testsuite>\n';
  fs.mkdirSync(path.dirname(outPath), {recursive: true});
  fs.writeFileSync(outPath, xml);
}

async function main() {
  setupDom();
  const bundle = process.argv[2];
  const outPath = process.argv[3];
  const mod = await import(pathToFileURL(bundle).href);
  const {group, results} = await mod.runSuite();
  writeXml(outPath, group, results);
  const failed = results.filter((r) => !r.ok);
  for (const f of failed) {
    console.error(`FAIL ${group}: ${f.name}\n  ${(f.error || '').split('\n')[0]}`);
  }
  console.error(`${group}: ${results.length - failed.length}/${results.length} passed`);
}

main().catch((e) => {
  console.error(e && e.stack || e);
  process.exit(2);
});
