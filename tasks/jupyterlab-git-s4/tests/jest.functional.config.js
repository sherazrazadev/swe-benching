module.exports = require('./jest.base.js')([
  '<rootDir>/.htests/functional/**/*.spec.ts',
  '<rootDir>/.htests/functional/**/*.spec.tsx',
  '<rootDir>/src/__tests__/test-components/PlainTextDiff.spec.tsx',
  '<rootDir>/src/__tests__/test-components/NotebookDiff.spec.tsx'
]);
