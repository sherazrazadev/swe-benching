// Starts the consciousness-explorer MCP server on stdio, exactly as the product
// does: construct the explorer and hand it to the MCP server class, then let the
// server attach its stdio transport.
import { pathToFileURL } from 'node:url';

const ws = process.env.WORKSPACE_DIR || '/workspace';
const { ConsciousnessExplorer } = await import(
  pathToFileURL(`${ws}/src/consciousness-explorer/index.js`).href
);
const { ConsciousnessMCPServer } = await import(
  pathToFileURL(`${ws}/src/consciousness-explorer/mcp/server.js`).href
);

const explorer = new ConsciousnessExplorer({ enableMonitoring: false, enableWasm: false });
const server = new ConsciousnessMCPServer(explorer);
await server.start();
