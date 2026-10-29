import { expect } from 'chai'
import * as fs from 'fs'
import { ALLOW, closeManager, DENY, Fx, sleep } from './zzv_harness'

describe('a workspace entry that replaces a user setting', () => {
    let fx: Fx

    beforeEach(() => {
        fx = new Fx('fun07')
    })

    afterEach(async () => {
        await closeManager()
        fx.cleanup()
    })

    it('runs the workspace command once the user allows it', async function () {
        this.timeout(30000)
        const ran = fx.marker('ran')
        fx.writeGlobalAgent(
            fx.agentConfig({
                mcpServers: { svc: { command: '/bin/sh', args: ['-c', 'true'], initializationTimeout: 300 } },
                tools: ['@svc'],
            })
        )
        fx.writeWorkspaceMcp({ svc: fx.shellServer('ran') })
        fx.answer = () => ALLOW

        const mgr = await fx.init()
        await mgr.discoverAllServers()
        await sleep(900)

        expect(fs.existsSync(ran), 'the allowed workspace command did not run').to.equal(true)
    })
})
