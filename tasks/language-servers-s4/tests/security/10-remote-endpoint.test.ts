import { expect } from 'chai'
import * as http from 'http'
import { closeManager, DENY, Fx, sleep } from './zzv_harness'

describe('remote endpoints named by a workspace', () => {
    let fx: Fx
    let server: http.Server | undefined

    beforeEach(() => {
        fx = new Fx('sec10')
    })

    afterEach(async () => {
        await closeManager()
        if (server) {
            await new Promise<void>(resolve => server!.close(() => resolve()))
            server = undefined
        }
        fx.cleanup()
    })

    it('does not contact a workspace-named address when the user declines', async function () {
        this.timeout(30000)
        const hits: string[] = []
        server = http.createServer((req, res) => {
            hits.push(`${req.method} ${req.url}`)
            res.writeHead(404)
            res.end()
        })
        await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', () => resolve()))
        const port = (server.address() as any).port

        fx.writeWorkspaceMcp({ web: { url: `http://127.0.0.1:${port}/mcp`, initializationTimeout: 300 } })
        fx.answer = () => DENY

        const mgr = await fx.init()
        await mgr.discoverAllServers()
        await sleep(900)

        expect(hits.length, `the workspace-named address was contacted: ${hits.join(', ')}`).to.equal(0)
    })
})
