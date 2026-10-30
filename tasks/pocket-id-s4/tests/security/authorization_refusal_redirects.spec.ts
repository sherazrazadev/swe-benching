import { test } from '@playwright/test';
import {
	APP,
	adminContext,
	authorizeUrl,
	expectRefused,
	recordExternal,
	reset,
	seeded
} from '../support/harness';

const refused = 'https://refused.invalid/collect';

test.describe('refused authorization requests', () => {
	test.beforeEach(async () => {
		await reset();
	});

	test('a silent request with an unregistered address does not redirect the browser', async ({
		browser
	}) => {
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
					state: 'state-login',
					nonce: 'nonce-login',
					prompt: 'none'
				})
		);

		await expectRefused(page, hits, refused, 'Nextcloud');
		await ctx.close();
	});

	test('conflicting silent requirements do not redirect to an unregistered address', async ({
		browser
	}) => {
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
					state: 'state-interaction',
					nonce: 'nonce-interaction',
					prompt: 'none consent'
				})
		);

		await expectRefused(page, hits, refused, 'Nextcloud');
		await ctx.close();
	});

	test('a silent request that needs consent does not redirect to an unregistered address', async ({
		browser
	}) => {
		const admin = await adminContext(browser);
		const page = await admin.newPage();
		const hits = await recordExternal(page);

		await page.goto(
			APP +
				authorizeUrl({
					client_id: seeded.immich.id,
					redirect_uri: refused,
					response_type: 'code',
					scope: 'openid profile email',
					state: 'state-consent',
					nonce: 'nonce-consent',
					prompt: 'none'
				})
		);

		await expectRefused(page, hits, refused, 'Immich');
		await admin.close();
	});

	test('a failing silent authorization is not reported to an unregistered address', async ({
		browser
	}) => {
		const admin = await adminContext(browser);
		const page = await admin.newPage();
		const hits = await recordExternal(page);

		await page.goto(
			APP +
				authorizeUrl({
					client_id: seeded.nextcloud.id,
					redirect_uri: refused,
					response_type: 'code',
					scope: 'openid profile email',
					state: 'state-failure',
					nonce: 'nonce-failure',
					prompt: 'none'
				})
		);

		await expectRefused(page, hits, refused, 'Nextcloud');
		await admin.close();
	});
});
