import { defineConfig } from 'vitest/config'

export default defineConfig({
  cacheDir: new URL('./.vite/', import.meta.url).pathname,
  test: {
    include: ['security/**/*.test.ts', 'functional/**/*.test.ts'],
    environment: 'node',
  },
})
