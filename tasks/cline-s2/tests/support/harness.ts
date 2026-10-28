import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as net from "node:net";

export const WORKSPACE = process.env.WORKSPACE_DIR || "/workspace";
const BASE_PATH = process.env.PATH || "/usr/local/bin:/usr/bin:/bin";
const BASE_HOME = process.env.HOME || "/home/agent";

export interface RawResult {
	status: number;
	body: string;
}

export interface RawOptions {
	host?: string;
	origin?: string;
	method?: string;
	body?: string;
	upgrade?: boolean;
	timeoutMs?: number;
}

export interface ServerHandle {
	port: number;
	proc: ChildProcessWithoutNullStreams;
	logs: () => string;
	stop: () => Promise<void>;
}

function baseEnv(): Record<string, string> {
	return {
		PATH: BASE_PATH,
		HOME: BASE_HOME,
		LANG: "C.UTF-8",
		LC_ALL: "C.UTF-8",
		TZ: "UTC",
		CLINE_NO_INTERACTIVE: "1",
	};
}

export function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.on("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				server.close();
				reject(new Error("could not allocate a local port"));
				return;
			}
			const port = address.port;
			server.close(() => resolve(port));
		});
	});
}

export function rawRequest(
	port: number,
	path: string,
	options: RawOptions = {},
): Promise<RawResult> {
	const method = options.method || "GET";
	const host = options.host || `127.0.0.1:${port}`;
	const upgrade = Boolean(options.upgrade);
	const body = options.body;
	const lines = [
		`${method} ${path} HTTP/1.1`,
		`Host: ${host}`,
		`Connection: ${upgrade ? "Upgrade" : "close"}`,
	];
	if (upgrade) {
		lines.push(
			"Upgrade: websocket",
			"Sec-WebSocket-Version: 13",
			"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
		);
	}
	if (options.origin !== undefined) lines.push(`Origin: ${options.origin}`);
	if (body !== undefined) {
		lines.push(
			"Content-Type: application/json",
			`Content-Length: ${Buffer.byteLength(body)}`,
		);
	}
	const requestText = `${lines.join("\r\n")}\r\n\r\n`;

	return new Promise((resolve) => {
		let buffer = "";
		let settled = false;
		const socket = net.connect(port, "127.0.0.1");
		const finish = (status: number, text: string) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			try {
				socket.destroy();
			} catch {
				// already closed
			}
			resolve({ status, body: text });
		};
		const timer = setTimeout(
			() => finish(0, `timeout:${buffer.slice(0, 200)}`),
			options.timeoutMs || 12000,
		);
		socket.on("connect", () => {
			socket.write(requestText);
			if (body !== undefined) socket.write(body);
		});
		socket.on("data", (chunk) => {
			buffer += chunk.toString("latin1");
			const headerEnd = buffer.indexOf("\r\n\r\n");
			if (headerEnd < 0) return;
			const status = Number(buffer.slice(9, 12));
			if (status === 101) {
				finish(101, "");
				return;
			}
			const headers = buffer.slice(0, headerEnd).toLowerCase();
			const lengthMatch = /content-length:\s*(\d+)/.exec(headers);
			const bodyStart = headerEnd + 4;
			if (lengthMatch) {
				const needed = Number(lengthMatch[1]);
				if (buffer.length - bodyStart >= needed) {
					finish(status, buffer.slice(bodyStart, bodyStart + needed));
				}
				return;
			}
			if (status >= 400 || status === 0) {
				finish(status, buffer.slice(bodyStart, bodyStart + 500));
			}
		});
		socket.on("end", () => {
			const headerEnd = buffer.indexOf("\r\n\r\n");
			if (headerEnd >= 0) {
				finish(Number(buffer.slice(9, 12)), buffer.slice(headerEnd + 4));
			}
		});
		socket.on("error", (error) => finish(0, `error:${error.message}`));
	});
}

async function waitForVersion(port: number, deadline: number): Promise<number> {
	let last = 0;
	while (Date.now() < deadline) {
		const result = await rawRequest(port, "/version", { timeoutMs: 1000 });
		last = result.status;
		if (result.status === 200) return 200;
		// The listener is up but refuses the public readiness document: a fix that gates public
		// page delivery is wrong, and retrying will not change the answer.
		if (result.status >= 400 && result.status < 500) return result.status;
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	return last;
}

export async function startDashboard(
	overrides: Record<string, string> = {},
): Promise<ServerHandle> {
	let lastLogs = "";
	let lastStatus = 0;
	for (let attempt = 0; attempt < 2; attempt++) {
		const port = await freePort();
		const env: Record<string, string> = {
			...baseEnv(),
			HOST: "127.0.0.1",
			CLINE_HUB_DASHBOARD_PORT: String(port),
			WORKSPACE_ROOT: WORKSPACE,
			...overrides,
		};
		const proc = spawn("bun", ["run", "src/server.ts"], {
			cwd: `${WORKSPACE}/apps/cline-hub`,
			env,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let logs = "";
		proc.stdout.on("data", (chunk) => {
			logs += chunk.toString();
		});
		proc.stderr.on("data", (chunk) => {
			logs += chunk.toString();
		});
		const deadline = Date.now() + 20000;
		const status = await waitForVersion(port, deadline);
		lastStatus = status;
		if (status === 200 && proc.exitCode === null) {
			return {
				port,
				proc,
				logs: () => logs,
				stop: async () => {
					proc.kill("SIGKILL");
					await new Promise((resolve) => {
						if (proc.exitCode !== null) return resolve(undefined);
						proc.once("exit", () => resolve(undefined));
						setTimeout(() => resolve(undefined), 5000);
					});
				},
			};
		}
		lastLogs = logs;
		try {
			proc.kill("SIGKILL");
		} catch {
			// already gone
		}
		if (status >= 400 && status < 500) break;
	}
	throw new Error(
		`dashboard did not start (last status ${lastStatus}): ${lastLogs.slice(0, 1500)}`,
	);
}

export async function startSidecar(): Promise<ServerHandle> {
	const script = fileURLToPath(new URL("./run-sidecar.ts", import.meta.url));
	const port = await freePort();
	const env = baseEnv();
	const proc = spawn("bun", [script, String(port)], {
		cwd: WORKSPACE,
		env,
		stdio: ["ignore", "pipe", "pipe"],
	});
	let logs = "";
	let actualPort = port;
	const ready = new Promise<boolean>((resolve) => {
		const timer = setTimeout(() => resolve(false), 60000);
		proc.stdout.on("data", (chunk) => {
			logs += chunk.toString();
			const match = /SIDECAR_READY\s+(\d+)/.exec(logs);
			if (match) {
				clearTimeout(timer);
				actualPort = Number(match[1]);
				resolve(true);
			}
		});
		proc.stderr.on("data", (chunk) => {
			logs += chunk.toString();
		});
		proc.once("exit", () => {
			clearTimeout(timer);
			resolve(false);
		});
	});
	const ok = await ready;
	if (!ok) {
		throw new Error(`sidecar did not start: ${logs.slice(0, 1500)}`);
	}
	return {
		port: actualPort,
		proc,
		logs: () => logs,
		stop: async () => {
			proc.kill("SIGKILL");
			await new Promise((resolve) => {
				if (proc.exitCode !== null) return resolve(undefined);
				proc.once("exit", () => resolve(undefined));
				setTimeout(() => resolve(undefined), 5000);
			});
		},
	};
}

export function isClientError(status: number): boolean {
	return status >= 400 && status < 500;
}
