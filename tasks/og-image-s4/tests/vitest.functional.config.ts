import { defineConfig } from 'vitest/config'

const root = process.env.S4_WORKSPACE || '/workspace'

export default defineConfig({
  test: {
    name: 'functional',
    environment: 'node',
    root,
    include: [
      '.htests/functional/**/*.test.ts',
      // The project's own tests for the affected area. They must keep passing.
      'test/unit/ssrf.test.ts',
      'test/unit/fonts.test.ts',
      'test/unit/urlEncoding.test.ts',
      'test/unit/ipv6-font-fetch.test.ts',
    ],
    fileParallelism: false,
    testTimeout: 180_000,
    hookTimeout: 600_000,
  },
})
