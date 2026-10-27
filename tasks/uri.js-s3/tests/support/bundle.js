'use strict';

/*
 * Load a browser build the way a <script> tag does: no CommonJS module object, no AMD loader,
 * so the bundle installs its globals on the window it is given. Returns the URI global.
 */
const fs = require('fs');
const vm = require('vm');

module.exports = function loadBundle(file) {
  const source = fs.readFileSync(file, 'utf8');
  const window = {};
  window.window = window;
  window.self = window;
  vm.createContext(window);
  vm.runInContext(source, window, { filename: file });
  if (typeof window.URI !== 'function') {
    throw new Error('the shipped browser build did not expose URI');
  }
  return window.URI;
};
