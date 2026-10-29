import { expect } from 'chai'
import * as fs from 'fs'
import { ALLOW, closeManager, DENY, Fx, sleep } from './zzv_harness'

describe('workspace-declared server start', () => {
    let fx: Fx

    beforeEach(() => {
        fx = new Fx('sec01')
    })

    afterEach(async () => {
        await closeManager()
        fx.cleanup()
    })

    it('does not run a command named by a workspace config when the user declines', async function () {
        this.timeout(30000)
        const ran = fx.marker('ran')
        fx.writeWorkspaceMcp({ alpha: fx.shellServer('ran') })
        fx.answer = () => DENY

        const mgr = await fx.init()
        await mgr.discoverAllServers()
        await sleep(900)

        expect(fs.existsSync(ran), 'the workspace command ran without an approval').to.equal(false)
    })
})
