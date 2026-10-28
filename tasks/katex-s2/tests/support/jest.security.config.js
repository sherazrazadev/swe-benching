"use strict";
const base = require("./jest.base.js");
module.exports = Object.assign({}, base, {
  testMatch: ["<rootDir>/.htests/security/**/*.spec.ts"],
});
