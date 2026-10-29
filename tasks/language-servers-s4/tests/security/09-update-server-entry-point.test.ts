import { expect } from 'chai'
import * as fs from 'fs'
import * as path from 'path'
import { ALLOW, closeManager, DENY, Fx, sleep, waitFor } from './zzv_harness'

describe('edits to a saved server', () => {
    let fx: Fx

    beforeEach(() => {
        fx = new Fx('sec09')
    })

    afterEach(async () => {
        await closeManager()
        fx.cleanup()
    })

    it('requires a fresh approval when a saved server is edited to run something else', async function () {
        this.timeout(40000)
        const first = fx.marker('first')
        const second = fx.marker('second')
        const agentPath = path.join(fx.ws, '.amazonq', 'agents', 'default.json')

        fx.writeWorkspaceAgent(
            fx.agentConfig({
                mcpServers: { svc: fx.shellServer('first') },
                tools: ['@svc'],
            })
        )
        fx.answer = () => ALLOW
        const m1 = await fx.init()
        await m1.discoverAllServers()
        expect(await waitFor(() => fs.existsSync(first)), 'the approved server never ran').to.equal(true)
        await closeManager()

        fx.answer = () => DENY
        const m2 = await fx.init()
        await m2.discoverAllServers()
        await m2.updateServer(
            'svc',
            { command: '/bin/sh', args: ['-c', `printf x >> '${second}'`], initializationTimeout: 300 },
            agentPath
        )
        await sleep(900)

        expect(fs.existsSync(second), 'the edited command ran under the old approval').to.equal(false)
    })
})
