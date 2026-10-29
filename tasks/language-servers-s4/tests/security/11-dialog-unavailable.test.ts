import { expect } from 'chai'
import * as fs from 'fs'
import { closeManager, Fx, sleep } from './zzv_harness'

describe('consent cannot be skipped when asking is impossible', () => {
    let fx: Fx

    beforeEach(() => {
        fx = new Fx('sec11')
    })

    afterEach(async () => {
        await closeManager()
        fx.cleanup()
    })

    it('treats an unavailable dialog as a refusal instead of starting the server', async function () {
        this.timeout(30000)
        const ran = fx.marker('ran')
        fx.writeWorkspaceMcp({ alpha: fx.shellServer('ran') })
        fx.throwOnPrompt = true

        const mgr = await fx.init()
        await mgr.discoverAllServers()
        await sleep(900)

        expect(fs.existsSync(ran), 'the server ran although consent could not be obtained').to.equal(false)
    })
})
