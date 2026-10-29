import { expect } from 'chai'
import * as fs from 'fs'
import { closeManager, DENY, Fx, sleep } from './zzv_harness'

describe('servers in the user global agent settings', () => {
    let fx: Fx

    beforeEach(() => {
        fx = new Fx('fun06')
    })

    afterEach(async () => {
        await closeManager()
        fx.cleanup()
    })

    it('keep starting without asking', async function () {
        this.timeout(30000)
        const ran = fx.marker('ran')
        fx.writeGlobalAgent(
            fx.agentConfig({
                mcpServers: { mine: fx.shellServer('ran') },
                tools: ['@mine'],
            })
        )
        fx.answer = () => DENY

        const mgr = await fx.init()
        await mgr.discoverAllServers()
        await sleep(900)

        expect(fs.existsSync(ran), 'the global server did not run').to.equal(true)
        expect(fx.prompts.length, 'a global server was challenged').to.equal(0)
    })
})
