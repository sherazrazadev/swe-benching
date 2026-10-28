import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rawRequest, startDashboard, type ServerHandle } from "../support/harness";

let server: ServerHandle;

beforeAll(async () => {
	server = await startDashboard();
});

afterAll(async () => {
	if (server) await server.stop();
});

describe("public dashboard content", () => {
	it("serves the version document to a browser that sends no origin", async () => {
		const result = await rawRequest(server.port, "/version");
		expect(result.status).toBe(200);
		expect(result.body).toContain("coreVersion");
	});

	it("serves the browser configuration to a browser that sends no origin", async () => {
		const result = await rawRequest(server.port, "/config.json");
		expect(result.status).toBe(200);
		expect(result.body).toContain("inviteRequired");
	});

	it("serves the health document to a browser that sends no origin", async () => {
		const result = await rawRequest(server.port, "/health");
		expect(result.status).toBe(200);
	});

	it("serves the dashboard page route without an origin", async () => {
		const result = await rawRequest(server.port, "/");
		expect([200, 503]).toContain(result.status);
	});

	it("serves a dashboard sub-page route without an origin", async () => {
		const result = await rawRequest(server.port, "/settings");
		expect([200, 503]).toContain(result.status);
	});
});
