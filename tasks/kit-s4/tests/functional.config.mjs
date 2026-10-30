import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

const ROOT = process.env.PRODUCT_ROOT || '/workspace';
const KIT = `${ROOT}/packages/kit`;
const HERE = `${ROOT}/.htests`;
const MOCK = (name) => `${HERE}/support/${name}.js`;

const shared = {
	cacheDir: `${HERE}/.vite-cache`,
	plugins: [svelte({ compilerOptions: { hmr: false, experimental: { async: true } } })],
	define: {
		__SVELTEKIT_SERVER_TRACING_ENABLED__: false,
		__SVELTEKIT_DEV__: true
	},
	server: { fs: { allow: [ROOT, '/opt/test-tools'] } },
	resolve: {
		alias: [
			// longer prefixes first: vite prefix-matches alias entries
			{ find: '@product/form-utils', replacement: `${KIT}/src/runtime/form-utils.js` },
			{ find: '@product/form', replacement: `${KIT}/src/runtime/client/remote-functions/form.svelte.js` },
			{ find: '$app/env/internal', replacement: MOCK('app-env-internal') },
			{ find: '$app/env', replacement: MOCK('app-env') },
			{ find: '$app/paths/internal/client', replacement: MOCK('app-paths-internal-client') },
			{ find: '$app/paths/internal/server', replacement: MOCK('app-paths-internal-server') },
			{ find: '$app/paths', replacement: MOCK('app-paths') },
			{ find: '__sveltekit/paths', replacement: MOCK('sveltekit-paths') },
			{ find: '@sveltejs/kit/internal', replacement: `${KIT}/src/exports/internal/index.js` },
			{ find: '@sveltejs/kit', replacement: `${KIT}/src/exports/index.js` }
		]
	}
};

export default defineConfig({
	...shared,
	test: {
		reporters: [
			'default',
			['junit', { outputFile: process.env.JUNIT_OUT || `${HERE}/functional-results.xml` }]
		],
		projects: [
			{
				extends: true,
				test: {
					name: 'product-tests',
					environment: 'node',
					root: ROOT,
					include: ['packages/kit/src/runtime/form-utils.spec.js'],
					fileParallelism: false
				}
			},
			{
				extends: true,
				test: {
					name: 'task-tests',
					environment: 'jsdom',
					root: ROOT,
					include: ['.htests/functional/**/*.test.js'],
					testTimeout: 20000,
					fileParallelism: false
				}
			}
		]
	}
});
