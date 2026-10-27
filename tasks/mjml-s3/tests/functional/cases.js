'use strict';

/*
 * Functional cases. Every expectation below is what the pinned compiler already produces today;
 * these must keep working whatever the fix does. Fixtures are written here and the markers are
 * compared literally.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const INSIDE = 'ZXQ-INSIDE-CONTENT-7f3a';
const INSIDE_CSS = 'ZXQ-INSIDE-CSS-7f3a';
const INSIDE_HTML = 'ZXQ-INSIDE-HTML-7f3a';
const SIBLING = 'ZXQ-SIBLING-CONTENT-7f3a';
const SHARED = 'ZXQ-SHARED-CONTENT-7f3a';

function write(file, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

function makeProject() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mjml-fun-'));
  const proj = path.join(base, 'project');
  write(path.join(proj, 'partials', 'part.mjml'), `<mj-text>${INSIDE}</mj-text>`);
  write(path.join(proj, 'sub', 'sibling.mjml'), `<mj-text>${SIBLING}</mj-text>`);
  write(path.join(proj, 'shared', 'common.mjml'), `<mj-text>${SHARED}</mj-text>`);
  write(path.join(proj, 'static', 'theme.css'), `.${INSIDE_CSS} { color: blue; }\n`);
  write(path.join(proj, 'static', 'banner.html'), `<div>${INSIDE_HTML}</div>\n`);
  return { base, proj };
}

function cleanup(p) {
  try { fs.rmSync(p.base, { recursive: true, force: true }); } catch (e) { /* best effort */ }
}

function doc(body) {
  return `<mjml><mj-body><mj-section><mj-column>${body}</mj-column></mj-section></mj-body></mjml>`;
}

function compileDoc(ctx, p, name, body) {
  const file = path.join(p.proj, name);
  write(file, doc(body));
  const before = process.cwd();
  process.chdir(p.proj);
  try {
    return ctx.mjml2html(fs.readFileSync(file, 'utf8'));
  } finally {
    process.chdir(before);
  }
}

function runCli(ctx, p, args) {
  return spawnSync(ctx.node, [ctx.cli].concat(args), {
    cwd: p.proj,
    encoding: 'utf8',
    timeout: 120000,
    env: Object.assign({}, process.env, { HOME: process.env.HOME || '/home/agent' }),
  });
}

function has(haystack, needle) {
  return String(haystack).indexOf(needle) !== -1;
}

function apiCase(ctx, id, label, body, marker, setup) {
  return {
    classname: 'functional',
    name: `${id}: ${label}`,
    run() {
      const p = makeProject();
      try {
        if (setup) setup(p);
        let result;
        try {
          result = compileDoc(ctx, p, `${id}.mjml`, body);
        } catch (e) {
          throw new Error(`legitimate compile failed: ${e && e.message}`);
        }
        if (!has(result.html, marker)) {
          throw new Error(`expected content ${marker} was not rendered`);
        }
      } finally {
        cleanup(p);
      }
    },
  };
}

module.exports = function (ctx) {
  const cases = [];

  cases.push(apiCase(ctx, 'api-inside', 'an in-project reference is still rendered',
    `<mj-include path="./partials/part.mjml" />`, INSIDE));

  cases.push(apiCase(ctx, 'api-nested-sibling',
    'a nested reference written from the embedded file\'s own directory still resolves',
    `<mj-include path="./sub/a.mjml" />`, SIBLING,
    p => write(path.join(p.proj, 'sub', 'a.mjml'),
      `<mj-section><mj-column><mj-include path="./sibling.mjml" /></mj-column></mj-section>`)));

  cases.push(apiCase(ctx, 'api-nested-up',
    'a nested reference that climbs to a sibling directory inside the project still resolves',
    `<mj-include path="./sub/b.mjml" />`, SHARED,
    p => write(path.join(p.proj, 'sub', 'b.mjml'),
      `<mj-section><mj-column><mj-include path="../shared/common.mjml" /></mj-column></mj-section>`)));

  cases.push({
    classname: 'functional',
    name: 'api-static: in-project static partials are still embedded',
    run() {
      const p = makeProject();
      try {
        let result;
        try {
          result = compileDoc(ctx, p, 'static.mjml',
            `<mj-include path="./static/theme.css" type="css" /><mj-include path="./static/banner.html" type="html" />`);
        } catch (e) {
          throw new Error(`legitimate compile failed: ${e && e.message}`);
        }
        if (!has(result.html, INSIDE_CSS)) throw new Error('the embedded stylesheet was not rendered');
        if (!has(result.html, INSIDE_HTML)) throw new Error('the embedded markup was not rendered');
      } finally {
        cleanup(p);
      }
    },
  });

  cases.push(apiCase(ctx, 'api-raw-src-inside',
    'a raw element reading an in-project file is still rendered',
    `<mj-raw src="./static/banner.html"></mj-raw>`, INSIDE_HTML));

  cases.push(apiCase(ctx, 'api-plain',
    'a document with no references renders as before',
    `<mj-text>${INSIDE}</mj-text>`, INSIDE));

  cases.push({
    classname: 'functional',
    name: 'cli-compile-inside: the command line tool still compiles an in-project reference',
    run() {
      const p = makeProject();
      try {
        const file = path.join(p.proj, 'cli.mjml');
        write(file, doc(`<mj-include path="./partials/part.mjml" />`));
        const r = runCli(ctx, p, [file, '-s']);
        const out = `${r.stdout || ''}\n${r.stderr || ''}`;
        if (!has(out, INSIDE)) throw new Error('the in-project reference was not rendered');
      } finally {
        cleanup(p);
      }
    },
  });

  cases.push({
    classname: 'functional',
    name: 'cli-validate-inside: checking a document still resolves an in-project reference',
    run() {
      const p = makeProject();
      try {
        const file = path.join(p.proj, 'check.mjml');
        write(file, doc(`<mj-include path="./partials/part.mjml" />`));
        const r = runCli(ctx, p, ['-v', file]);
        const out = `${r.stdout || ''}\n${r.stderr || ''}`;
        if (has(out, 'fails to read file')) {
          throw new Error('the in-project reference was not resolved while checking the document');
        }
        if (r.status !== 0) {
          throw new Error(`checking a valid document exited with status ${r.status}: ${out.trim().slice(0, 300)}`);
        }
      } finally {
        cleanup(p);
      }
    },
  });

  return cases;
};
