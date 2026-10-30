import { expect, test } from '@playwright/test';
import {
	APP,
	adminContext,
	authorizeUrl,
	createClient,
	expectRefused,
	recordExternal,
	reset
} from '../support/harness';

const refused = 'https://refused.invalid/collect';

test.describe('clients without a usable registered address', () => {
	test.beforeEach(async () => {
		await reset();
	});

	test('a client with no registered address cannot be used to redirect the browser', async ({
		browser
	}) => {
		const admin = await adminContext(browser);
		const client = await createClient(admin, 'Unconfigured App', []);

		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		const hits = await recordExternal(page);

		await page.goto(
			APP +
				authorizeUrl({
					client_id: client.id,
					redirect_uri: refused,
					response_type: 'code',
					scope: 'openid profile',
					state: 'state-nocb',
					nonce: 'nonce-nocb',
					prompt: 'none'
				})
		);

		await expectRefused(page, hits, refused, 'Unconfigured App');

		// Nothing may have been registered as a side effect of the attempt.
		const after = await admin.request.get(`${APP}/api/oidc/clients/${client.id}`);
		expect(after.ok()).toBeTruthy();
		const body = (await after.json()) as { callbackURLs: string[] };
		expect(body.callbackURLs).toEqual([]);

		await ctx.close();
		await admin.close();
	});

	test('an address outside a registered wildcard pattern is not used', async ({ browser }) => {
		const admin = await adminContext(browser);
		const client = await createClient(admin, 'Pattern App', ['https://*.apps.example/cb']);

		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		const hits = await recordExternal(page);

		await page.goto(
			APP +
				authorizeUrl({
					client_id: client.id,
					redirect_uri: refused,
					response_type: 'code',
					scope: 'openid profile',
					state: 'state-pattern',
					nonce: 'nonce-pattern',
					prompt: 'none'
				})
		);

		await expectRefused(page, hits, refused, 'Pattern App');
		await ctx.close();
		await admin.close();
	});
});
