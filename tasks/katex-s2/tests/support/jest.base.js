/* Shared jest settings for the hidden runs.
 * rootDir is the restored submission; the transform uses the verifier's own
 * babel config so a submission edit to the project's babel config cannot
 * change how the hidden files are compiled.
 */
"use strict";
const rootDir = process.env.HTESTS_ROOT || "/workspace";

module.exports = {
  rootDir,
  testEnvironment: "node",
  setupFilesAfterEnv: [rootDir + "/test/setup.ts"],
  transform: {
    "^.+\\.(js|ts)$": [
      "babel-jest",
      {
        configFile: rootDir + "/.htests/support/babel.config.js",
        cwd: rootDir,
        root: rootDir,
      },
    ],
  },
  transformIgnorePatterns: ["/node_modules/"],
  snapshotSerializers: ["jest-serializer-html"],
  moduleNameMapper: {
    "^katex$": "<rootDir>/katex.ts",
    "^katex/contrib/auto-render$": "<rootDir>/contrib/auto-render/auto-render.ts",
  },
  reporters: [
    [
      rootDir + "/.htests/support/junit-reporter.js",
      {output: process.env.HTESTS_OUT || rootDir + "/.htests/results.xml"},
    ],
  ],
};
