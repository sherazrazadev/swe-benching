import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	isClientError,
	rawRequest,
	startDashboard,
	type ServerHandle,
} from "../support/harness";

const secret = "invite-secret-9f2";
let server: ServerHandle;
let publicHost: string;
let publicOrigin: string;

beforeAll(async () => {
	server = await startDashboard({
		HOST: "0.0.0.0",
		ROOM_SECRET: secret,
		PUBLIC_URL: "http://100.82.5.118",
	});
	publicHost = `100.82.5.118:${server.port}`;
	publicOrigin = `http://100.82.5.118:${server.port}`;
});

afterAll(async () => {
	if (server) await server.stop();
});

function socketPath(): string {
	return `/browser?roomSecret=${encodeURIComponent(secret)}`;
}

describe("dashboard behind a shared address", () => {
	it("refuses an invite holder whose page belongs to another site", async () => {
		const result = await rawRequest(server.port, socketPath(), {
			host: publicHost,
			origin: "http://evil.attacker.example",
			upgrade: true,
		});
		expect(isClientError(result.status)).toBe(true);
	});

	it("refuses an invite holder that presents no origin", async () => {
		const result = await rawRequest(server.port, socketPath(), {
			host: publicHost,
			upgrade: true,
		});
		expect(isClientError(result.status)).toBe(true);
	});

	it("refuses an invite holder whose host names another site", async () => {
		const result = await rawRequest(server.port, socketPath(), {
			host: "evil.attacker.example",
			origin: publicOrigin,
			upgrade: true,
		});
		expect(isClientError(result.status)).toBe(true);
	});
});
