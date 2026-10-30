'use strict';
// The package keeps exporting the location of its bundled sample files so driver CI can copy
// them; that location must still resolve to the files that actually ship.
const fs = require('node:fs');
const path = require('node:path');
const h = require('../support/harness');

describe('the package export for bundled sample files still resolves', function () {
  this.timeout(30000);

  it('points at a directory holding the bundled files', function () {
    const {STATIC_DIR} = h.product('index.js');
    if (typeof STATIC_DIR !== 'string' || !fs.existsSync(STATIC_DIR)) {
      throw new Error(`the exported sample-file directory does not exist: ${STATIC_DIR}`);
    }
    const page = path.join(STATIC_DIR, 'test', 'guinea-pig.html');
    const image = path.join(STATIC_DIR, 'appium.png');
    if (!fs.existsSync(page)) {
      throw new Error(`the bundled page fixture is missing under ${STATIC_DIR}`);
    }
    if (!fs.existsSync(image)) {
      throw new Error(`the bundled image is missing under ${STATIC_DIR}`);
    }
  });
});
