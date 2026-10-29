// Hidden security suite. Lives at /workspace/.htests in the verifier.
const path = require('path');
const root = path.resolve(__dirname, '..');
const junit = process.env.JUNIT_PATH;

module.exports = {
  rootDir: root,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/.htests/functional/**/*.test.ts',
    '<rootDir>/packages/oci/src/__tests__/credentials.test.ts',
    '<rootDir>/packages/oci/src/__tests__/image.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  transform: {
    '^.+\\.(t|j)s$': ['@swc/jest', { jsc: { target: 'es2021' } }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(agent-base|http-proxy-agent|https-proxy-agent|socks-proxy-agent|socks)/)',
  ],
  reporters: junit ? ['default', [junit, {}]] : ['default'],
  testEnvironmentOptions: { customExportConditions: ['node', 'node-addons'] },
  testTimeout: 30000,
};
