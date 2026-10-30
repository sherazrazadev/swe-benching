import { expect, test } from '@playwright/test';
import {
	APP,
	adminContext,
	authorizeUrl,
	createClient,
	recordExternal,
	reset,
	seeded,
	waitForExternal
} from '../support/harness';

const base = {
	response_type: 'code',
	scope: 'openid profile email',
	nonce: 'nonce-ok'
};

test.describe('requests to a registered address keep working', () => {
	test.beforeEach(async () => {
		await reset();
	});

	test('a refusal is returned to the exact registered address', async ({ browser }) => {
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		const hits = await recordExternal(page);

		await page.goto(
			APP +
				authorizeUrl({
					...base,
					client_id: seeded.nextcloud.id,
					redirect_uri: 'http://nextcloud/auth/callback',
					state: 'state-exact',
					prompt: 'none'
				})
		);

		const url = await waitForExternal(page, hits, (u) => u.origin === 'http://nextcloud');
		expect(url.pathname).toBe('/auth/callback');
		expect(url.searchParams.get('error')).toBe('login_required');
		expect(url.searchParams.get('state')).toBe('state-exact');
		await ctx.close();
	});

	test('a loopback application may use any port', async ({ browser }) => {
		const admin = await adminContext(browser);
		const client = await createClient(admin, 'Native App', ['http://127.0.0.1/callback']);

		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		const hits = await recordExternal(page);

		await page.goto(
			APP +
				authorizeUrl({
					...base,
					client_id: client.id,
					redirect_uri: 'http://127.0.0.1:54321/callback',
					state: 'state-loopback',
					prompt: 'none'
				})
		);

		const url = await waitForExternal(page, hits, (u) => u.origin === 'http://127.0.0.1:54321');
		expect(url.pathname).toBe('/callback');
		expect(url.searchParams.get('error')).toBe('login_required');
		await ctx.close();
		await admin.close();
	});

	test('a registered wildcard pattern still matches', async ({ browser }) => {
		const admin = await adminContext(browser);
		const client = await createClient(admin, 'Pattern App', ['https://*.apps.example/cb']);

		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		const hits = await recordExternal(page);

		await page.goto(
			APP +
				authorizeUrl({
					...base,
					client_id: client.id,
					redirect_uri: 'https://desk.apps.example/cb',
					state: 'state-pattern',
					prompt: 'none'
				})
		);

		const url = await waitForExternal(page, hits, (u) => u.origin === 'https://desk.apps.example');
		expect(url.pathname).toBe('/cb');
		expect(url.searchParams.get('error')).toBe('login_required');
		await ctx.close();
		await admin.close();
	});

	test('declining still reports back to the registered address', async ({ browser }) => {
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		const hits = await recordExternal(page);

		await page.goto(
			APP +
				authorizeUrl({
					...base,
					client_id: seeded.nextcloud.id,
					redirect_uri: 'http://nextcloud/auth/callback',
					state: 'state-decline'
				})
		);

		await page.getByRole('button', { name: 'Cancel' }).click();

		const url = await waitForExternal(page, hits, (u) => u.origin === 'http://nextcloud');
		expect(url.searchParams.get('error')).toBe('access_denied');
		expect(url.searchParams.get('state')).toBe('state-decline');
		await ctx.close();
	});
});
