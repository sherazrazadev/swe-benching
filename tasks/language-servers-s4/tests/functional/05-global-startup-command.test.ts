import { expect } from 'chai'
import * as fs from 'fs'
import { closeManager, DENY, Fx, sleep } from './zzv_harness'

describe('startup commands in the user global configuration', () => {
    let fx: Fx

    beforeEach(() => {
        fx = new Fx('fun05')
    })

    afterEach(async () => {
        await closeManager()
        fx.cleanup()
    })

    it('keep running without asking', async function () {
        this.timeout(30000)
        const ran = fx.marker('ran')
        fx.writeGlobalAgent(
            fx.agentConfig({
                hooks: { agentSpawn: [{ command: `printf x >> '${ran}'` }], userPromptSubmit: [] },
            })
        )
        fx.answer = () => DENY

        const mgr = await fx.init()
        await mgr.discoverAllServers()
        await sleep(1200)

        expect(fs.existsSync(ran), 'the global startup command no longer runs').to.equal(true)
        expect(fx.prompts.length, 'a global startup command was challenged').to.equal(0)
    })
})
