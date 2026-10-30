import * as path from 'path';
import { defineConfig } from 'vitest/config';

const group = process.env.VGROUP ?? 'security';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '../src') } },
  test: {
    include: [`__verifier__/${group}/**/*.test.ts`],
    testTimeout: 120000,
    hookTimeout: 120000,
    fileParallelism: false,
    deps: { optimizer: { ssr: { include: ['@aws-sdk/*', '@smithy/*', 'zod', 'commander'] } } },
  },
});
