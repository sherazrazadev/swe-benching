import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

const ROOT = process.env.PRODUCT_ROOT || '/workspace';
const KIT = `${ROOT}/packages/kit`;
const HERE = `${ROOT}/.htests`;
const MOCK = (name) => `${HERE}/support/${name}.js`;

export default defineConfig({
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
	},
	test: {
		globals: true,
		environment: 'jsdom',
		root: ROOT,
		include: ['.htests/security/**/*.test.js'],
		testTimeout: 20000,
		fileParallelism: false,
		// A refused update is reported by the product as an ordinary thrown error from its DOM
		// event handler; jsdom reports that to the environment. The tests assert the observable
		// outcome (nothing stored, nothing outside the form touched), so the environment-level
		// report is not a test failure.
		dangerouslyIgnoreUnhandledErrors: true,
		reporters: [
			'default',
			['junit', { outputFile: process.env.JUNIT_OUT || `${HERE}/security-results.xml` }]
		]
	}
});
