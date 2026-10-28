import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	isClientError,
	rawRequest,
	startSidecar,
	type ServerHandle,
} from "../support/harness";

let server: ServerHandle;

beforeAll(async () => {
	server = await startSidecar();
});

afterAll(async () => {
	if (server) await server.stop();
});

describe("desktop bridge socket", () => {
	it("refuses a socket opened by another site", async () => {
		const result = await rawRequest(server.port, "/transport", {
			origin: "http://evil.attacker.example",
			upgrade: true,
		});
		expect(isClientError(result.status)).toBe(true);
	});

	it("refuses a socket opened without an origin", async () => {
		const result = await rawRequest(server.port, "/transport", {
			upgrade: true,
		});
		expect(isClientError(result.status)).toBe(true);
	});

	it("refuses a socket opened with an unparseable origin", async () => {
		const result = await rawRequest(server.port, "/transport", {
			origin: "not a url",
			upgrade: true,
		});
		expect(isClientError(result.status)).toBe(true);
	});
});
