import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rawRequest, startDashboard, type ServerHandle } from "../support/harness";

const secret = "invite-secret-9f2";
let shared: ServerHandle;
let tunnel: ServerHandle;

beforeAll(async () => {
	shared = await startDashboard({
		HOST: "0.0.0.0",
		ROOM_SECRET: secret,
		PUBLIC_URL: "http://100.82.5.118",
	});
	tunnel = await startDashboard({
		HOST: "127.0.0.1",
		PUBLIC_URL: "https://tunnel.example",
	});
});

afterAll(async () => {
	if (shared) await shared.stop();
	if (tunnel) await tunnel.stop();
});

describe("configured public addresses", () => {
	it("keeps a shared machine address usable when it has no port of its own", async () => {
		const host = `100.82.5.118:${shared.port}`;
		const result = await rawRequest(
			shared.port,
			`/browser?roomSecret=${encodeURIComponent(secret)}`,
			{ host, origin: `http://${host}`, upgrade: true },
		);
		expect(result.status).toBe(101);
	});

	it("keeps replayed dashboard commands usable through that address", async () => {
		const host = `100.82.5.118:${shared.port}`;
		const result = await rawRequest(
			shared.port,
			`/api/desktop-command?roomSecret=${encodeURIComponent(secret)}`,
			{
				method: "POST",
				host,
				origin: `http://${host}`,
				body: JSON.stringify({ command: "get_global_settings" }),
			},
		);
		expect(result.status).toBe(200);
		expect(result.body).toContain('"ok":true');
	});

	it("keeps a tunnel hostname usable when it intentionally has no port", async () => {
		const result = await rawRequest(tunnel.port, "/browser", {
			host: "tunnel.example",
			origin: "https://tunnel.example",
			upgrade: true,
		});
		expect(result.status).toBe(101);
	});
});
