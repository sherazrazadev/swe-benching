import { defineConfig } from 'vitest/config'

// Runs the hidden suites and pristine copies of the project's own SSG tests from /workspace.
// The JSX settings mirror the project's own vitest configuration for the "main" project.
export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'automatic',
      importSource: './src/jsx',
    },
  },
  test: {
    globals: true,
    include: ['.htests/**/*.test.ts', 'src/helper/ssg/**/*.test.ts', 'src/helper/ssg/**/*.test.tsx'],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
})
