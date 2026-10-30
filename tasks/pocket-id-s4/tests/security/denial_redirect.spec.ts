import { test } from '@playwright/test';
import {
	APP,
	authorizeUrl,
	expectRefused,
	recordExternal,
	reset,
	seeded
} from '../support/harness';

test.describe('declining an authorization', () => {
	test.beforeEach(async () => {
		await reset();
	});

	test('declining an authorization does not redirect the browser to an unregistered address', async ({
		browser
	}) => {
		const refused = 'https://refused.invalid/collect';
		const ctx = await browser.newContext();
		const page = await ctx.newPage();
		const hits = await recordExternal(page);

		await page.goto(
			APP +
				authorizeUrl({
					client_id: seeded.nextcloud.id,
					redirect_uri: refused,
					response_type: 'code',
					scope: 'openid profile email',
					state: 'state-deny',
					nonce: 'nonce-deny'
				})
		);

		await page.getByRole('button', { name: 'Cancel' }).click();

		await expectRefused(page, hits, refused, 'Nextcloud');
		await ctx.close();
	});
});
