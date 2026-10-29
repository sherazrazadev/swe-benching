import { expect } from 'chai'
import * as fs from 'fs'
import { closeManager, DENY, Fx, sleep } from './zzv_harness'

describe('one refusal does not disable the rest', () => {
    let fx: Fx

    beforeEach(() => {
        fx = new Fx('sec12')
    })

    afterEach(async () => {
        await closeManager()
        fx.cleanup()
    })

    it('still starts an unrelated configuration the user already trusts', async function () {
        this.timeout(30000)
        const trusted = fx.marker('trusted')
        const untrusted = fx.marker('untrusted')

        fx.writeGlobalMcp({ mine: fx.shellServer('trusted') })
        fx.writeWorkspaceMcp({ theirs: fx.shellServer('untrusted') })
        fx.answer = () => DENY

        const mgr = await fx.init()
        await mgr.discoverAllServers()
        await sleep(1200)

        expect(fs.existsSync(untrusted), 'the declined workspace server ran').to.equal(false)
        expect(fs.existsSync(trusted), 'a declined workspace server stopped an unrelated trusted server').to.equal(true)
    })
})
