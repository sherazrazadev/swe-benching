import { defineConfig } from 'vitest/config';

// Hidden-suite runner configuration. HIDDEN_ROOT is the package directory the suites run
// against (the pristine dependency tree overlaid with the submission), HIDDEN_GLOB selects
// one group, and JUNIT_OUT is the file the grader reads.
export default defineConfig({
   cacheDir: process.env.HIDDEN_CACHE_DIR || '/tmp/vitest-cache',
   test: {
      root: process.env.HIDDEN_ROOT,
      include: [process.env.HIDDEN_GLOB as string],
      environment: 'node',
      reporters: ['junit'],
      outputFile: process.env.JUNIT_OUT,
      testTimeout: 30000,
      hookTimeout: 30000,
      pool: 'forks',
      poolOptions: { forks: { singleFork: true } },
   },
});
