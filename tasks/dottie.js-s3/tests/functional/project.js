'use strict';

/*
 * Runs the project's own test suite against the submitted library, offline. The suite files are
 * pristine copies of the pinned tree kept under tests/functional/project/ and staged next to the
 * submitted library at grading time, so their relative require of the library resolves to the
 * submission. Each test case becomes one JUnit entry.
 */

const fs = require('fs');
const path = require('path');

module.exports = function () {
  return new Promise((resolve) => {
    const dir = process.env.PROJECT_TEST_DIR || '/workspace/.htests';
    let files;
    try {
      files = fs.readdirSync(dir)
        .filter((f) => f.endsWith('.test.js'))
        .sort()
        .map((f) => path.join(dir, f));
    } catch (e) {
      resolve([{ classname: 'harness', name: 'project suite staged', ok: false, message: String(e && e.message) }]);
      return;
    }
    if (!files.length) {
      resolve([{ classname: 'harness', name: 'project suite found', ok: false,
                 message: 'no project test files in ' + dir }]);
      return;
    }

    let Mocha;
    try {
      Mocha = require('mocha');
    } catch (e) {
      resolve([{ classname: 'harness', name: 'project test runner available', ok: false,
                 message: String(e && e.message) }]);
      return;
    }

    const entries = [];
    const push = (test, ok, message) => {
      const file = path.basename((test && test.file) || 'suite');
      let title = 'suite';
      try {
        title = (test && test.fullTitle && test.fullTitle()) || (test && test.title) || 'suite';
      } catch (_) { /* a file-level failure carries no title */ }
      entries.push({ classname: 'functional/project/' + file, name: title, ok, message });
    };

    let mocha;
    try {
      mocha = new Mocha({
        timeout: 10000,
        reporter: function (runner) {
          runner.on('pass', (t) => push(t, true));
          runner.on('fail', (t, e) => push(t, false, (e && e.message) || String(e)));
          runner.on('pending', (t) => push(t, false, 'pending'));
        },
      });
    } catch (e) {
      resolve([{ classname: 'harness', name: 'project test runner starts', ok: false,
                 message: String(e && e.message) }]);
      return;
    }

    for (const f of files) mocha.addFile(f);
    try {
      mocha.run(function () {
        if (!entries.length) {
          entries.push({ classname: 'harness', name: 'project suite ran', ok: false,
                         message: 'the project suite produced no test cases' });
        }
        resolve(entries);
      });
    } catch (e) {
      entries.push({ classname: 'harness', name: 'project suite ran', ok: false,
                     message: String(e && e.message) });
      resolve(entries);
    }
  });
};
