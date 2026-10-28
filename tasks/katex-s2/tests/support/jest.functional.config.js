"use strict";
const base = require("./jest.base.js");
module.exports = Object.assign({}, base, {
  testMatch: [
    "<rootDir>/.htests/functional/**/*.spec.ts",
    "<rootDir>/test/katex-spec.ts",
  ],
});
