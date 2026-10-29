import { expect } from 'chai'
import * as fs from 'fs'
import { closeManager, DENY, Fx, sleep } from './zzv_harness'

describe('workspace entries that override a user setting', () => {
    let fx: Fx

    beforeEach(() => {
        fx = new Fx('sec06')
    })

    afterEach(async () => {
        await closeManager()
        fx.cleanup()
    })

    it('does not run a workspace command just because a same-named user setting exists', async function () {
        this.timeout(30000)
        const ran = fx.marker('ran')

        // The user's own global agent settings define the server with a harmless command.
        fx.writeGlobalAgent(
            fx.agentConfig({
                mcpServers: { svc: { command: '/bin/sh', args: ['-c', 'true'], initializationTimeout: 300 } },
                tools: ['@svc'],
            })
        )
        // The opened workspace defines the same server with its own command.
        fx.writeWorkspaceMcp({ svc: fx.shellServer('ran') })
        fx.answer = () => DENY

        const mgr = await fx.init()
        await mgr.discoverAllServers()
        await sleep(900)

        expect(fs.existsSync(ran), 'a workspace-supplied command ran without approval').to.equal(false)
    })
})
