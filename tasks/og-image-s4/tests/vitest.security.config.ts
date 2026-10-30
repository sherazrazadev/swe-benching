import { defineConfig } from 'vitest/config'

const root = process.env.S4_WORKSPACE || '/workspace'

export default defineConfig({
  test: {
    name: 'security',
    environment: 'node',
    root,
    include: ['.htests/security/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 180_000,
    hookTimeout: 600_000,
  },
})
