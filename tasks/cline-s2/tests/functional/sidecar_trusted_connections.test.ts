import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rawRequest, startSidecar, type ServerHandle } from "../support/harness";

let server: ServerHandle;

beforeAll(async () => {
	server = await startSidecar();
});

afterAll(async () => {
	if (server) await server.stop();
});

describe("trusted desktop page connections", () => {
	it("accepts the desktop application's own development page", async () => {
		const result = await rawRequest(server.port, "/transport", {
			origin: "http://localhost:3125",
			upgrade: true,
		});
		expect(result.status).toBe(101);
	});
});
