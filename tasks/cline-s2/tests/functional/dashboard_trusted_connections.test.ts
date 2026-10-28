import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rawRequest, startDashboard, type ServerHandle } from "../support/harness";

let server: ServerHandle;

beforeAll(async () => {
	server = await startDashboard();
});

afterAll(async () => {
	if (server) await server.stop();
});

function origin(): string {
	return `http://127.0.0.1:${server.port}`;
}

describe("trusted dashboard connections", () => {
	it("accepts the dashboard page's own socket", async () => {
		const result = await rawRequest(server.port, "/browser", {
			origin: origin(),
			upgrade: true,
		});
		expect(result.status).toBe(101);
	});

	it("accepts the settings page's own live socket", async () => {
		const result = await rawRequest(server.port, "/settings/live", {
			origin: origin(),
			upgrade: true,
		});
		expect(result.status).toBe(101);
	});

	it("accepts a command posted by the dashboard page", async () => {
		const result = await rawRequest(server.port, "/api/desktop-command", {
			method: "POST",
			origin: origin(),
			body: JSON.stringify({ command: "get_global_settings" }),
		});
		expect(result.status).toBe(200);
		expect(result.body).toContain('"ok":true');
	});
});
