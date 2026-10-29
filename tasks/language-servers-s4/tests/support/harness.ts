/**
 * Shared fixture for the verifier suites.
 *
 * Everything here is plain Node: temporary directories, real files, a fake
 * editor-host object and a recording consent dialog. Expected values are
 * computed here or in the tests, never by product code, so a hardened product
 * cannot break the bookkeeping.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { pathToFileURL } from 'url'
import { McpManager } from './mcpManager'

export const ALLOW = { title: 'Allow for this server' }
export const DENY = { title: 'Deny' }

/** npm settings that make an attempted spawn fail fast while offline. */
export const OFFLINE_ENV: Record<string, string> = {
    NPM_CONFIG_OFFLINE: 'true',
    NPM_CONFIG_UPDATE_NOTIFIER: 'false',
    NPM_CONFIG_AUDIT: 'false',
    NPM_CONFIG_FUND: 'false',
    NPM_CONFIG_FETCH_RETRIES: '0',
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export async function waitFor(pred: () => boolean, timeoutMs = 3000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        if (pred()) {
            return true
        }
        await sleep(50)
    }
    return pred()
}

export class Fx {
    readonly base: string
    readonly home: string
    readonly ws: string
    /** Every dialog request the product made, in order. */
    readonly prompts: any[] = []
    /** Answer for request number n (0-based). Defaults to denial. */
    answer: (n: number, req: any) => any = () => DENY
    /** Simulate an editor that cannot show the dialog. */
    throwOnPrompt = false
    workspaceFolders: string[]

    private readonly features: any

    constructor(tag: string) {
        this.base = fs.mkdtempSync(path.join(os.tmpdir(), `cwe-${tag}-`))
        this.home = path.join(this.base, 'home')
        this.ws = path.join(this.base, 'ws')
        this.workspaceFolders = [this.ws]
        fs.mkdirSync(path.join(this.home, '.aws', 'amazonq', 'agents'), { recursive: true })
        fs.mkdirSync(path.join(this.ws, '.amazonq', 'agents'), { recursive: true })

        const noop = () => {}
        let requests = 0
        this.features = {
            logging: { log: noop, info: noop, warn: noop, error: noop, debug: noop },
            workspace: {
                fs: {
                    exists: async (f: string) => {
                        try {
                            return fs.existsSync(f)
                        } catch {
                            return false
                        }
                    },
                    readFile: (f: string) => fs.promises.readFile(f),
                    writeFile: (f: string, data: any) => fs.promises.writeFile(f, data),
                    mkdir: (f: string, opts: any) => fs.promises.mkdir(f, opts),
                    getUserHomeDir: () => this.home,
                },
                getUserHomeDir: () => this.home,
                getAllWorkspaceFolders: () =>
                    this.workspaceFolders.map(folder => ({
                        uri: pathToFileURL(folder).toString(),
                        name: path.basename(folder),
                    })),
            },
            lsp: {
                window: {
                    showMessageRequest: async (req: any) => {
                        if (this.throwOnPrompt) {
                            throw new Error('dialog unavailable')
                        }
                        this.prompts.push(req)
                        return this.answer(requests++, req)
                    },
                },
            },
            telemetry: { emitMetric: noop },
            credentialsProvider: { getConnectionMetadata: () => ({}) },
            runtime: { serverInfo: { version: '1.0.0' } },
            agent: {
                getBuiltInToolNames: () => ['fsRead', 'fsWrite', 'executeBash'],
                getBuiltInWriteToolNames: () => ['fsWrite'],
            },
        }
    }

    marker(name: string): string {
        return path.join(this.base, name)
    }

    /** Number of marker records written so far (each run appends one byte). */
    markerCount(name: string): number {
        try {
            return fs.statSync(this.marker(name)).size
        } catch {
            return 0
        }
    }

    /** A stdio server entry whose execution appends one byte to the named marker. */
    shellServer(name: string): any {
        return {
            command: '/bin/sh',
            args: ['-c', `printf x >> '${this.marker(name)}'`],
            initializationTimeout: 300,
        }
    }

    writeWorkspaceMcp(servers: any): string {
        return this.writeMcpAt(this.ws, servers)
    }

    writeMcpAt(folder: string, servers: any): string {
        const file = path.join(folder, '.amazonq', 'mcp.json')
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, JSON.stringify({ mcpServers: servers }))
        return file
    }

    writeGlobalMcp(servers: any): string {
        const file = path.join(this.home, '.aws', 'amazonq', 'mcp.json')
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, JSON.stringify({ mcpServers: servers }))
        return file
    }

    writeWorkspaceAgent(config: any): string {
        const file = path.join(this.ws, '.amazonq', 'agents', 'default.json')
        fs.writeFileSync(file, JSON.stringify(config))
        return file
    }

    writeGlobalAgent(config: any): string {
        const file = path.join(this.home, '.aws', 'amazonq', 'agents', 'default.json')
        fs.writeFileSync(file, JSON.stringify(config))
        return file
    }

    agentConfig(extra: any = {}): any {
        return {
            name: 'test-agent',
            description: '',
            mcpServers: {},
            tools: [],
            allowedTools: [],
            toolsSettings: {},
            resources: [],
            ...extra,
        }
    }

    agentPaths(): string[] {
        return this.agentPathsFor(this.ws)
    }

    agentPathsFor(folder: string): string[] {
        return [
            path.join(folder, '.amazonq', 'agents', 'default.json'),
            path.join(this.home, '.aws', 'amazonq', 'agents', 'default.json'),
        ]
    }

    /** Create a fresh workspace directory inside the fixture. */
    newWorkspace(name: string): string {
        const folder = path.join(this.base, name)
        fs.mkdirSync(path.join(folder, '.amazonq', 'agents'), { recursive: true })
        return folder
    }

    async init(registryServers?: any[]): Promise<McpManager> {
        const mgr = await McpManager.init(this.agentPaths(), this.features)
        if (registryServers) {
            // Registry data is trusted input normally fetched from the registry service;
            // seed it directly so the suite stays offline.
            mgr.setRegistryActive(true)
            ;(mgr as any).currentRegistry = {
                servers: registryServers,
                lastFetched: new Date(),
                url: 'https://registry.invalid/',
            }
        }
        return mgr
    }

    cleanup(): void {
        try {
            fs.rmSync(this.base, { recursive: true, force: true })
        } catch {}
    }
}

export async function closeManager(): Promise<void> {
    try {
        if (McpManager.isInitialized()) {
            await McpManager.instance.close()
        }
    } catch {}
}

export function npmRegistryServer(name: string, identifier: string, version = '1.0.0'): any {
    return {
        name,
        description: '',
        version,
        packages: [{ registryType: 'npm', identifier, transport: { type: 'stdio' } }],
    }
}

export function registryAgentConfig(serverName: string, env: Record<string, string>): any {
    return {
        name: 'test-agent',
        description: '',
        mcpServers: { [serverName]: { type: 'registry', env } },
        tools: [`@${serverName}`],
        allowedTools: [],
        toolsSettings: {},
        resources: [],
    }
}

/** A loadable script that appends one byte to the marker when Node runs it. */
export function writePayload(fx: Fx, markerName: string): string {
    const payload = fx.marker('payload.cjs')
    fs.writeFileSync(
        payload,
        `try { require('fs').appendFileSync(${JSON.stringify(fx.marker(markerName))}, 'x') } catch (e) {}`
    )
    return payload
}
