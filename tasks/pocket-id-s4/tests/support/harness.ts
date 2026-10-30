import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

export const APP = process.env.APP_ORIGIN ?? 'http://localhost:1411';

export const seeded = {
	nextcloud: { id: '3654a746-35d4-4321-ac61-0bdcff2b4055', name: 'Nextcloud' },
	nextcloudSecret: 'w2mUeZISmEvIDMEDvpY0PnxQIpj1m3zY',
	immich: { id: '606c7782-f2b1-49e5-8ea9-26eb1b06d018', name: 'Immich' },
	parClient: { id: 'a1b2c3d4-e5f6-7890-abcd-ef0000000001', name: 'PAR Test Client' },
	parClientSecret: 'w2mUeZISmEvIDMEDvpY0PnxQIpj1m3zY'
};

const timPasskey = {
	credentialId: 'test-credential-tim',
	userHandle: 'f4b89dc2-62fb-46bf-9f5f-c34f4eafe93e',
	privateKey:
		'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg3rNKkGApsEA1TpGiphKh6axTq3Vh6wBghLLea/YkIp+hRANCAATBw6jkpXXr0pHrtAQetxiR5cTcILG/YGDCdKrhVhNDHIu12YrF6B7Frwl3AUqEpdrYEwj3Fo3XkGgvrBIJEUmG'
};

/** Reset the application to its seeded initial state. */
export async function reset(): Promise<void> {
	const res = await fetch(new URL('/api/test/reset?skip-ldap=true', APP), { method: 'POST' });
	if (!res.ok) {
		throw new Error(`application reset failed: ${res.status} ${res.statusText}`);
	}
}

/** Sign the seeded administrator in with a virtual platform authenticator. */
export async function signIn(ctx: BrowserContext): Promise<void> {
	const page = await ctx.newPage();
	const cdp = await ctx.newCDPSession(page);
	await cdp.send('WebAuthn.enable');
	const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
		options: {
			protocol: 'ctap2',
			transport: 'internal',
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true
		}
	});
	await cdp.send('WebAuthn.addCredential', {
		authenticatorId,
		credential: {
			credentialId: Buffer.from(timPasskey.credentialId).toString('base64'),
			isResidentCredential: true,
			rpId: 'localhost',
			privateKey: timPasskey.privateKey,
			userHandle: Buffer.from(timPasskey.userHandle).toString('base64'),
			signCount: 1234
		}
	});
	await page.goto(`${APP}/login`);
	await page.getByRole('button', { name: 'Authenticate' }).click();
	await page.waitForURL('**/settings/account');
	await page.close();
}

/** A signed-in administrator context (session cookie shared by its request client). */
export async function adminContext(browser: Browser): Promise<BrowserContext> {
	const ctx = await browser.newContext();
	await signIn(ctx);
	return ctx;
}

export type CreatedClient = { id: string; name: string; callbackURLs: string[] };

/** Create an OIDC client through the product's admin API. */
export async function createClient(
	ctx: BrowserContext,
	name: string,
	callbackURLs: string[]
): Promise<CreatedClient> {
	const res = await ctx.request.post(`${APP}/api/oidc/clients`, {
		data: {
			name,
			callbackURLs,
			logoutCallbackURLs: [],
			isPublic: true,
			pkceEnabled: true,
			requiresReauthentication: false,
			requiresPushedAuthorizationRequests: false,
			isGroupRestricted: false,
			credentials: { federatedIdentities: [] },
			hasLogo: false,
			hasDarkLogo: false
		}
	});
	if (!res.ok()) {
		throw new Error(`client creation failed: ${res.status()} ${await res.text()}`);
	}
	return (await res.json()) as CreatedClient;
}

/** Replace an existing client's registered addresses through the admin API. */
export async function setClientCallbacks(
	ctx: BrowserContext,
	id: string,
	callbackURLs: string[]
): Promise<void> {
	const got = await ctx.request.get(`${APP}/api/oidc/clients/${id}`);
	if (!got.ok()) throw new Error(`client read failed: ${got.status()}`);
	const c = await got.json();
	const res = await ctx.request.put(`${APP}/api/oidc/clients/${id}`, {
		data: {
			name: c.name,
			callbackURLs,
			logoutCallbackURLs: c.logoutCallbackURLs,
			isPublic: c.isPublic,
			pkceEnabled: c.pkceEnabled,
			requiresReauthentication: c.requiresReauthentication,
			requiresPushedAuthorizationRequests: c.requiresPushedAuthorizationRequests,
			credentials: c.credentials,
			isGroupRestricted: c.isGroupRestricted,
			hasLogo: c.hasLogo,
			hasDarkLogo: c.hasDarkLogo
		}
	});
	if (!res.ok()) throw new Error(`client update failed: ${res.status()} ${await res.text()}`);
}

/** Push an authorization request (RFC 9126) and return its request_uri. */
export async function pushAuthorizationRequest(
	ctx: BrowserContext,
	clientId: string,
	clientSecret: string,
	params: Record<string, string>
): Promise<string> {
	const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
	const res = await ctx.request.post(`${APP}/api/oidc/par`, {
		form: params,
		headers: { Authorization: `Basic ${auth}` }
	});
	if (!res.ok()) throw new Error(`pushed request failed: ${res.status()} ${await res.text()}`);
	const body = (await res.json()) as { request_uri: string };
	return body.request_uri;
}

/** An authorization request URL on the local application. */
export function authorizeUrl(params: Record<string, string>): string {
	return `/authorize?${new URLSearchParams(params).toString()}`;
}

/**
 * Route every request. Requests to the application keep going; anything else is recorded and
 * answered locally so nothing leaves the machine.
 */
export async function recordExternal(page: Page, allowedOrigin = APP): Promise<string[]> {
	const hits: string[] = [];
	await page.route('**/*', async (route) => {
		const url = route.request().url();
		let sameOrigin = false;
		try {
			sameOrigin = new URL(url).origin === allowedOrigin;
		} catch {
			sameOrigin = true;
		}
		if (sameOrigin) {
			await route.continue();
			return;
		}
		hits.push(url);
		await route.fulfill({ status: 200, contentType: 'text/plain', body: 'redirect-blocked' });
	});
	return hits;
}

/** Wait until a recorded external request matches, then return it. */
export async function waitForExternal(
	page: Page,
	hits: string[],
	predicate: (url: URL) => boolean,
	timeoutMs = 15_000
): Promise<URL> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const found = hits.find((raw) => {
			try {
				return predicate(new URL(raw));
			} catch {
				return false;
			}
		});
		if (found) return new URL(found);
		await page.waitForTimeout(100);
	}
	throw new Error(`no matching external request; recorded: ${JSON.stringify(hits)}`);
}

/** Wait until the page itself is at a URL matching the predicate (fragments included). */
export async function waitForPageUrl(
	page: Page,
	predicate: (url: URL) => boolean,
	timeoutMs = 15_000
): Promise<URL> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const current = new URL(page.url());
			if (predicate(current)) return current;
		} catch {
			/* about:blank and friends */
		}
		await page.waitForTimeout(100);
	}
	throw new Error(`page did not reach the expected URL; current: ${page.url()}`);
}

/**
 * The refusal contract: no request reaches the refused address, the browser stays on the
 * application, and the authorization screen is still rendered with its error.
 */
export async function expectRefused(
	page: Page,
	hits: string[],
	refusedOrigin: string,
	clientName: string
): Promise<void> {
	// Give the page time to finish its refusal either way (a vulnerable build navigates
	// within a second; a loaded verifier can be slower, so the window is generous).
	await page.waitForTimeout(6000);
	const leaked = hits.filter((raw) => raw.startsWith(refusedOrigin));
	expect(leaked, `the browser was sent to a refused address: ${JSON.stringify(leaked)}`).toEqual([]);
	expect(new URL(page.url()).origin).toBe(APP);
	await expect(page.getByRole('heading', { name: new RegExp(clientName, 'i') })).toBeVisible();
}
