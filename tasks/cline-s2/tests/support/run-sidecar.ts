import { startServer } from "../../apps/examples/desktop-app/sidecar/server.ts";

const requestedPort = Number(process.argv[2]);
const context = { wsClients: new Set() } as never;
const started = startServer(context, requestedPort);
process.stdout.write(`SIDECAR_READY ${started.port}\n`);
await new Promise(() => {
	// keep the listener alive for the duration of the checks
});
