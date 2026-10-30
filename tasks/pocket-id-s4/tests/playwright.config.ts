import { defineConfig } from '@playwright/test';

const origin = process.env.APP_ORIGIN ?? 'http://localhost:1411';

export default defineConfig({
	testDir: process.env.GROUP ?? '.',
	timeout: 60_000,
	expect: { timeout: 10_000 },
	fullyParallel: false,
	workers: 1,
	retries: 0,
	forbidOnly: false,
	reporter: [
		['junit', { outputFile: process.env.JUNIT_OUT ?? 'results.xml' }],
		['line']
	],
	use: {
		baseURL: origin,
		headless: true,
		launchOptions: {
			executablePath: process.env.PW_CHROME || undefined,
			args: [
				'--no-sandbox',
				'--disable-dev-shm-usage',
				'--disable-background-networking',
				'--disable-component-update',
				'--no-first-run'
			]
		}
	}
});
