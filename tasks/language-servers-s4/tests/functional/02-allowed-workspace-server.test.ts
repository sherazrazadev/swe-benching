import { expect } from 'chai'
import * as fs from 'fs'
import { ALLOW, closeManager, Fx, sleep } from './zzv_harness'

describe('workspace servers the user allows', () => {
    let fx: Fx

    beforeEach(() => {
        fx = new Fx('fun02')
    })

    afterEach(async () => {
        await closeManager()
        fx.cleanup()
    })

    it('starts after the user allows it', async function () {
        this.timeout(30000)
        const ran = fx.marker('ran')
        fx.writeWorkspaceMcp({ svc: fx.shellServer('ran') })
        fx.answer = () => ALLOW

        const mgr = await fx.init()
        await mgr.discoverAllServers()
        await sleep(900)

        expect(fs.existsSync(ran), 'the allowed server did not run').to.equal(true)
        expect(fx.prompts.length, 'the server was challenged more than once').to.be.lessThan(2)
    })
})
