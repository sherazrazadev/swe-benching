import { defineConfig } from "vitest/config";

const workspace = process.env.WORKSPACE_DIR || "/workspace";

export default defineConfig({
	root: `${workspace}/apps/cline-hub`,
	resolve: {
		alias: [
			{
				find: /^@cline\/core$/,
				replacement: `${workspace}/sdk/packages/core/src/index.ts`,
			},
			{
				find: /^@cline\/core\/(.+)$/,
				replacement: `${workspace}/sdk/packages/core/src/$1`,
			},
			{
				find: /^@cline\/shared$/,
				replacement: `${workspace}/sdk/packages/shared/src/index.ts`,
			},
			{
				find: /^@cline\/shared\/(.+)$/,
				replacement: `${workspace}/sdk/packages/shared/src/$1`,
			},
		],
	},
	test: {
		include: [
			"src/server/http.test.ts",
			"src/server/connectors.test.ts",
			"src/server/marketplace.test.ts",
			"src/server/user-instructions.test.ts",
			"src/webview/src/lib/desktop-client.test.ts",
		],
		environment: "node",
		pool: "forks",
		maxWorkers: 1,
		fileParallelism: false,
		testTimeout: 120000,
		hookTimeout: 120000,
	},
});
