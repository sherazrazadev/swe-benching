import { defineConfig } from "vitest/config";

const workspace = process.env.WORKSPACE_DIR || "/workspace";

export default defineConfig({
	root: `${workspace}/.htests`,
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
		include: ["functional/**/*.test.ts"],
		environment: "node",
		pool: "forks",
		maxWorkers: 1,
		fileParallelism: false,
		testTimeout: 90000,
		hookTimeout: 120000,
	},
});
