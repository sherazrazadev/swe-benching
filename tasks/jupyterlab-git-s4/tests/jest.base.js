const path = require('path');
const base = require('@jupyterlab/testutils/lib/jest-config')(__dirname);
delete base.testRegex;
const esModules = [
  '@codemirror',
  '@jupyter/ydoc',
  '@jupyterlab/',
  'lib0',
  'nanoid',
  'nbdime',
  'vscode-ws-jsonrpc',
  'y-protocols',
  'y-websocket',
  'yjs'
].join('|');

module.exports = function (testMatch) {
  base.transform['^.+\\.tsx?$'][1].tsconfig = path.resolve(
    __dirname,
    'tsconfig.hidden.json'
  );
  return {
    ...base,
    rootDir: path.resolve(__dirname, '..'),
    automock: false,
    testEnvironment: 'jsdom',
    testMatch,
    setupFiles: ['<rootDir>/.htests/support/jest-setup-files.js'],
    testPathIgnorePatterns: ['/lib/', '/node_modules/'],
    reporters: ['default'],
    transformIgnorePatterns: [`/node_modules/(?!${esModules}).+`],
    modulePathIgnorePatterns: [
      '<rootDir>/build',
      '<rootDir>/jupyterlab_git',
      '<rootDir>/jupyter-config',
      '<rootDir>/ui-tests'
    ]
  };
};
