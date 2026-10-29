import { expect } from 'chai'
import * as fs from 'fs'
import { closeManager, DENY, Fx, sleep } from './zzv_harness'

describe('user-authored global configuration', () => {
    let fx: Fx

    beforeEach(() => {
        fx = new Fx('fun01')
    })

    afterEach(async () => {
        await closeManager()
        fx.cleanup()
    })

    it('starts a server from the user global settings without asking', async function () {
        this.timeout(30000)
        const ran = fx.marker('ran')
        fx.writeGlobalMcp({ mine: fx.shellServer('ran') })
        fx.answer = () => DENY

        const mgr = await fx.init()
        await mgr.discoverAllServers()
        await sleep(900)

        expect(fs.existsSync(ran), 'the global server did not run').to.equal(true)
        expect(fx.prompts.length, 'a global server was challenged').to.equal(0)
    })
})
