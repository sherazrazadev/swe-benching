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

describe("dashboard live settings socket", () => {
	it("refuses a socket opened by another site", async () => {
		const result = await rawRequest(server.port, "/settings/live", {
			origin: "http://evil.attacker.example",
			upgrade: true,
		});
		expect(isClientError(result.status)).toBe(true);
	});

	it("refuses a socket opened without an origin", async () => {
		const result = await rawRequest(server.port, "/settings/live", {
			upgrade: true,
		});
		expect(isClientError(result.status)).toBe(true);
	});
});
