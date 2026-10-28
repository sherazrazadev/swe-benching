import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	isClientError,
	rawRequest,
	startDashboard,
	type ServerHandle,
} from "../support/harness";

let server: ServerHandle;

beforeAll(async () => {
	server = await startDashboard();
});

afterAll(async () => {
	if (server) await server.stop();
});

function originFor(): string {
	return `http://127.0.0.1:${server.port}`;
}

describe("dashboard browser socket", () => {
	it("refuses an upgrade whose origin belongs to another site", async () => {
		const result = await rawRequest(server.port, "/browser", {
			origin: "http://evil.attacker.example",
			upgrade: true,
		});
		expect(isClientError(result.status)).toBe(true);
	});

	it("refuses an upgrade that presents no origin", async () => {
		const result = await rawRequest(server.port, "/browser", { upgrade: true });
		expect(isClientError(result.status)).toBe(true);
	});

	it("refuses an upgrade that presents an unparseable origin", async () => {
		const result = await rawRequest(server.port, "/browser", {
			origin: "null",
			upgrade: true,
		});
		expect(isClientError(result.status)).toBe(true);
	});

	it("refuses an upgrade from the right machine on another port", async () => {
		const result = await rawRequest(server.port, "/browser", {
			origin: "http://127.0.0.1:9999",
			upgrade: true,
		});
		expect(isClientError(result.status)).toBe(true);
	});

	it("refuses an upgrade that uses another scheme", async () => {
		const result = await rawRequest(server.port, "/browser", {
			origin: `https://127.0.0.1:${server.port}`,
			upgrade: true,
		});
		expect(isClientError(result.status)).toBe(true);
	});

	it("refuses an upgrade whose host names another site", async () => {
		const result = await rawRequest(server.port, "/browser", {
			host: "evil.attacker.example",
			origin: originFor(),
			upgrade: true,
		});
		expect(isClientError(result.status)).toBe(true);
	});
});
