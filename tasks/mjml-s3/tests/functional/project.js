'use strict';

/*
 * The project's own parser fixtures, run against the submitted parser. The fixtures are the
 * project's test data for the parser package (including its include fixture); they are staged
 * from a pristine copy so a submission cannot weaken them. Expectations are the fixture data
 * itself; nothing is computed with the product.
 */

const fs = require('fs');
const path = require('path');
const { isDeepStrictEqual } = require('util');

const FIXTURES = path.join(__dirname, 'fixtures');

function omitDeep(value, props) {
  if (Array.isArray(value)) return value.map(v => omitDeep(v, props));
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) {
      if (props.indexOf(key) !== -1) continue;
      out[key] = omitDeep(value[key], props);
    }
    return out;
  }
  return value;
}

module.exports = function (ctx) {
  const ws = ctx.workspace;
  // The published package registers the component set the parser needs.
  require(path.join(ws, 'packages', 'mjml', 'lib', 'index.js'));
  const MJMLParser = require(path.join(ws, 'packages', 'mjml-parser-xml', 'lib', 'index.js'));
  const components = require(path.join(ws, 'packages', 'mjml-core', 'lib', 'index.js')).components;
  const testValues = require(path.join(FIXTURES, 'test-values.js'));

  const parse = mjml => MJMLParser(mjml, {
    keepComments: true,
    components,
    filePath: '.',
  });

  return testValues.map(unit => ({
    classname: 'functional/project',
    name: `project parser fixture: ${unit.test}`,
    run() {
      const before = process.cwd();
      process.chdir(FIXTURES);
      try {
        const got = omitDeep(parse(unit.mjml), ['absoluteFilePath', 'file']);
        const want = omitDeep(unit.validJson, ['file']);
        if (!isDeepStrictEqual(got, want)) {
          throw new Error(`parser output changed for fixture "${unit.test}"`);
        }
      } finally {
        process.chdir(before);
      }
    },
  }));
};
