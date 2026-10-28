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

const commandBody = JSON.stringify({ command: "get_global_settings" });

describe("dashboard command endpoint", () => {
	it("refuses a command posted by another site", async () => {
		const result = await rawRequest(server.port, "/api/desktop-command", {
			method: "POST",
			origin: "http://evil.attacker.example",
			body: commandBody,
		});
		expect(isClientError(result.status)).toBe(true);
		expect(result.body).not.toContain('"ok":true');
	});

	it("refuses a command posted without an origin", async () => {
		const result = await rawRequest(server.port, "/api/desktop-command", {
			method: "POST",
			body: commandBody,
		});
		expect(isClientError(result.status)).toBe(true);
		expect(result.body).not.toContain('"ok":true');
	});
});
