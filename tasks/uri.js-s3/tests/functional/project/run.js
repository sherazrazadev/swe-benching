'use strict';

/*
 * The project's own parsing table (test/urls.js as shipped at the pinned revision), run without
 * a browser: for each URL it checks the serialized form, the parsed parts, every accessor and
 * every is() answer, exactly as test/test.js does. The data file is a pristine copy staged from
 * the verifier image, so a submission cannot edit it.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATA = path.join(__dirname, 'urls.js');

// QUnit's equal() is loose equality; keep the table's own comparisons identical.
function looseEqual(actual, expected) {
  return actual == expected; // eslint-disable-line eqeqeq
}

module.exports = function ({ URI }) {
  const source = fs.readFileSync(DATA, 'utf8');
  const sandbox = {};
  vm.runInNewContext(source + '\n;urls', sandbox, { filename: 'urls.js' });
  const urls = sandbox.urls;
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error('the project parsing table did not load');
  }

  return urls.map((t, i) => ({
    classname: 'project/parse',
    // the data table has two cases with the same title; keep every row distinct
    name: `parse #${i + 1} ${t.name}`,
    run() {
      const u = new URI(t.url);
      const failures = [];
      const check = (actual, expected, what) => {
        if (!looseEqual(actual, expected)) {
          failures.push(`${what}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
        }
      };

      check(u + '', t._url || t.url, 'toString');
      for (const key in (t.parts || {})) {
        check(u._parts[key], t.parts[key], 'part ' + key);
      }
      for (const key in (t.accessors || {})) {
        check(u[key](), t.accessors[key], 'accessor ' + key);
      }
      for (const key in (t.is || {})) {
        check(u.is(key), t.is[key], 'is ' + key);
      }
      if (failures.length) {
        throw new Error(failures.slice(0, 4).join('; '));
      }
    },
  }));
};
