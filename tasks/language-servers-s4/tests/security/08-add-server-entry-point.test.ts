import { expect } from 'chai'
import * as fs from 'fs'
import * as path from 'path'
import { closeManager, DENY, Fx, sleep } from './zzv_harness'

describe('servers added through the assistant', () => {
    let fx: Fx

    beforeEach(() => {
        fx = new Fx('sec08')
    })

    afterEach(async () => {
        await closeManager()
        fx.cleanup()
    })

    it('does not run a server saved into the workspace when the user declines', async function () {
        this.timeout(30000)
        const ran = fx.marker('ran')

        fx.answer = () => DENY
        const mgr = await fx.init()
        ;(mgr as any).agentConfig = fx.agentConfig()

        await mgr.addServer('svc', fx.shellServer('ran'), path.join(fx.ws, '.amazonq', 'agents', 'default.json'))
        await sleep(900)

        expect(fs.existsSync(ran), 'the saved server ran without approval').to.equal(false)
    })
})
