import { expect, test } from '@playwright/test';
import {
	APP,
	adminContext,
	authorizeUrl,
	pushAuthorizationRequest,
	recordExternal,
	reset,
	seeded,
	setClientCallbacks,
	waitForExternal,
	waitForPageUrl
} from '../support/harness';

test.describe('successful authorizations keep working', () => {
	test.beforeEach(async () => {
		await reset();
	});

	test('the address carried in a pushed request is the one used when the request is refused', async ({
		browser
	}) => {
		const admin = await adminContext(browser);
		const second = 'http://nextcloud/auth/callback2';
		await setClientCallbacks(admin, seeded.nextcloud.id, [
			'http://nextcloud/auth/callback',
			second
		]);

		// A scope the user has not already authorized, so the silent request is refused and
		// the refusal has to be returned to the address stored in the pushed request.
		const requestURI = await pushAuthorizationRequest(
			admin,
			seeded.nextcloud.id,
			seeded.nextcloudSecret,
			{
				response_type: 'code',
				redirect_uri: second,
				scope: 'openid profile',
				state: 'state-par',
				nonce: 'nonce-par',
				prompt: 'none'
			}
		);

		const page = await admin.newPage();
		const hits = await recordExternal(page);
		await page.goto(
			`${APP}/authorize?client_id=${seeded.nextcloud.id}&request_uri=${encodeURIComponent(requestURI)}&prompt=none`
		);

		const url = await waitForExternal(
			page,
			hits,
			(u) => u.origin === 'http://nextcloud' && u.pathname === '/auth/callback2'
		);
		expect(url.searchParams.get('error')).toBe('consent_required');
		expect(url.searchParams.get('state')).toBe('state-par');
		await admin.close();
	});

	test('a silent success with the fragment response mode keeps working', async ({ browser }) => {
		const admin = await adminContext(browser);
		const page = await admin.newPage();
		await recordExternal(page);

		await page.goto(
			APP +
				authorizeUrl({
					client_id: seeded.nextcloud.id,
					redirect_uri: 'http://nextcloud/auth/callback',
					response_type: 'code',
					scope: 'openid profile email',
					state: 'state-fragment',
					nonce: 'nonce-fragment',
					prompt: 'none',
					response_mode: 'fragment'
				})
		);

		const url = await waitForPageUrl(
			page,
			(u) => u.origin === 'http://nextcloud' && u.pathname === '/auth/callback'
		);
		expect(url.search).toBe('');
		const fragment = new URLSearchParams(url.hash.slice(1));
		expect(fragment.get('code')).toBeTruthy();
		expect(fragment.get('state')).toBe('state-fragment');
		await admin.close();
	});

	test('a failure from the authorization service is returned to a registered address', async ({
		browser
	}) => {
		const admin = await adminContext(browser);
		const page = await admin.newPage();
		const hits = await recordExternal(page);

		await page.goto(
			APP +
				authorizeUrl({
					client_id: seeded.nextcloud.id,
					redirect_uri: 'http://nextcloud/auth/callback',
					response_type: 'code',
					scope: 'openid profile email',
					state: 'state-failure',
					nonce: 'nonce-failure',
					prompt: 'none',
					code_challenge: 'not-a-real-challenge',
					code_challenge_method: 'bogus'
				})
		);

		const url = await waitForExternal(page, hits, (u) => u.origin === 'http://nextcloud');
		expect(url.searchParams.get('error')).toBe('server_error');
		expect(url.searchParams.get('state')).toBe('state-failure');
		await admin.close();
	});
});
