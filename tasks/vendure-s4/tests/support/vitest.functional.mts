import path from 'path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    root: path.resolve(__dirname, '..'),
    test: {
        include: ['functional/**/*.e2e-spec.ts'],
        testTimeout: 120000,
        hookTimeout: 120000,
        fileParallelism: false,
    },
    plugins: [swc.vite({ jsc: { transform: { useDefineForClassFields: false } } })],
});
