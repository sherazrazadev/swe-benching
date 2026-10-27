'use strict';

/*
 * Security cases. Every case builds a throw-away project whose embedded targets sit outside the
 * project directory, drives the product through a real public entry point, and checks that the
 * outside content never reaches the output. Nothing here computes an expectation with product
 * code: the markers are literals written into the fixture files.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const OUTSIDE = 'ZXQ-OUTSIDE-CONTENT-7f3a';
const OUTSIDE_TAG = 'mj-outsidecanary7f3a';
const KEEP = 'ZXQ-KEEP-RENDERING-7f3a';

function write(file, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

function makeProject() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mjml-sec-'));
  const proj = path.join(base, 'project');
  const outside = path.join(base, 'outside');
  write(path.join(outside, 'secret.mjml'), `<mj-text>${OUTSIDE}</mj-text>\n<${OUTSIDE_TAG}/>\n`);
  write(path.join(outside, 'secret.css'), `.${OUTSIDE}-css { color: red; }\n`);
  write(path.join(outside, 'secret.html'), `<div>${OUTSIDE}-html</div>\n`);
  write(path.join(proj, 'keep.mjml'), `<mj-text>${KEEP}</mj-text>`);
  return { base, proj, outside };
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

function apiCase(ctx, id, label, body) {
  return {
    classname: 'security',
    name: `${id}: ${label}`,
    run() {
      const p = makeProject();
      try {
        let result;
        try {
          result = compileDoc(ctx, p, `${id}.mjml`, body);
        } catch (e) {
          throw new Error(`compiling the document failed instead of refusing a reference: ${e && e.message}`);
        }
        if (has(result.html, OUTSIDE)) {
          throw new Error('a file outside the project was read and its content rendered');
        }
        if (!has(result.html, KEEP)) {
          throw new Error('the rest of the document was not rendered');
        }
      } finally {
        cleanup(p);
      }
    },
  };
}

function cliCompileCase(ctx, id, label, body) {
  return {
    classname: 'security',
    name: `${id}: ${label}`,
    run() {
      const p = makeProject();
      try {
        const file = path.join(p.proj, `${id}.mjml`);
        write(file, doc(body));
        const r = runCli(ctx, p, [file, '-s']);
        const out = `${r.stdout || ''}\n${r.stderr || ''}`;
        if (has(out, OUTSIDE)) {
          throw new Error('the command line tool read a file outside the project and printed its content');
        }
        if (!has(out, KEEP)) {
          throw new Error('the rest of the document was not rendered');
        }
      } finally {
        cleanup(p);
      }
    },
  };
}

module.exports = function (ctx) {
  const cases = [];

  cases.push({
    classname: 'security',
    name: 'api-absolute: an absolute reference outside the project is refused',
    run() {
      const p = makeProject();
      try {
        let result;
        try {
          result = compileDoc(ctx, p, 'absolute.mjml',
            `<mj-include path="${path.join(p.outside, 'secret.mjml')}" /><mj-text>${KEEP}</mj-text>`);
        } catch (e) {
          throw new Error(`compiling the document failed instead of refusing a reference: ${e && e.message}`);
        }
        if (has(result.html, OUTSIDE)) {
          throw new Error('a file outside the project was read and its content rendered');
        }
        if (!has(result.html, KEEP)) {
          throw new Error('the rest of the document was not rendered');
        }
      } finally {
        cleanup(p);
      }
    },
  });

  cases.push(apiCase(ctx, 'api-traversal',
    'a reference that climbs out of the project is refused',
    `<mj-include path="../outside/secret.mjml" /><mj-text>${KEEP}</mj-text>`));

  cases.push({
    classname: 'security',
    name: 'api-symlink: a link inside the project whose target is outside is refused',
    run() {
      const p = makeProject();
      try {
        fs.symlinkSync(path.join(p.outside, 'secret.mjml'), path.join(p.proj, 'link.mjml'));
        let result;
        try {
          result = compileDoc(ctx, p, 'symlink.mjml',
            `<mj-include path="./link.mjml" /><mj-text>${KEEP}</mj-text>`);
        } catch (e) {
          throw new Error(`compiling the document failed instead of refusing a reference: ${e && e.message}`);
        }
        if (has(result.html, OUTSIDE)) {
          throw new Error('the link target outside the project was read and its content rendered');
        }
        if (!has(result.html, KEEP)) {
          throw new Error('the rest of the document was not rendered');
        }
      } finally {
        cleanup(p);
      }
    },
  });

  cases.push({
    classname: 'security',
    name: 'api-nested-traversal: an embedded file that embeds content outside the project is refused',
    run() {
      const p = makeProject();
      try {
        write(path.join(p.proj, 'sub', 'partial.mjml'),
          `<mj-section><mj-column><mj-include path="../../outside/secret.mjml" /></mj-column></mj-section>`);
        let result;
        try {
          result = compileDoc(ctx, p, 'nested.mjml',
            `<mj-include path="./sub/partial.mjml" /><mj-text>${KEEP}</mj-text>`);
        } catch (e) {
          throw new Error(`compiling the document failed instead of refusing a reference: ${e && e.message}`);
        }
        if (has(result.html, OUTSIDE)) {
          throw new Error('a nested reference read a file outside the project');
        }
        if (!has(result.html, KEEP)) {
          throw new Error('the rest of the document was not rendered');
        }
      } finally {
        cleanup(p);
      }
    },
  });

  cases.push(apiCase(ctx, 'api-static-css',
    'a static stylesheet reference outside the project is refused',
    `<mj-include path="../outside/secret.css" type="css" /><mj-text>${KEEP}</mj-text>`));

  cases.push(apiCase(ctx, 'api-static-html',
    'a static markup reference outside the project is refused',
    `<mj-include path="../outside/secret.html" type="html" /><mj-text>${KEEP}</mj-text>`));

  cases.push(apiCase(ctx, 'api-raw-src',
    'a raw element pointing at a file outside the project is refused',
    `<mj-raw src="../outside/secret.html"></mj-raw><mj-text>${KEEP}</mj-text>`));

  cases.push(cliCompileCase(ctx, 'cli-compile',
    'compiling from the command line refuses an outside reference',
    `<mj-include path="../outside/secret.mjml" /><mj-text>${KEEP}</mj-text>`));

  cases.push(cliCompileCase(ctx, 'cli-compile-static',
    'compiling from the command line refuses an outside static reference',
    `<mj-include path="../outside/secret.html" type="html" /><mj-text>${KEEP}</mj-text>`));

  cases.push({
    classname: 'security',
    name: 'cli-validate: checking a document does not read an outside reference',
    run() {
      const p = makeProject();
      try {
        const file = path.join(p.proj, 'check.mjml');
        write(file, doc(`<mj-include path="../outside/secret.mjml" /><mj-text>${KEEP}</mj-text>`));
        const r = runCli(ctx, p, ['-v', file]);
        const out = `${r.stdout || ''}\n${r.stderr || ''}`;
        if (has(out, OUTSIDE_TAG)) {
          throw new Error('checking the document read a file outside the project');
        }
      } finally {
        cleanup(p);
      }
    },
  });

  return cases;
};
