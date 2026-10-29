import { expect } from 'chai'
import { ALLOW, closeManager, DENY, Fx, sleep, waitFor } from './zzv_harness'

describe('an approved server across reloads', () => {
    let fx: Fx

    beforeEach(() => {
        fx = new Fx('fun03')
    })

    afterEach(async () => {
        await closeManager()
        fx.cleanup()
    })

    it('runs again without asking when the same settings are loaded again', async function () {
        this.timeout(40000)
        fx.writeWorkspaceMcp({ svc: fx.shellServer('ran') })
        fx.answer = () => ALLOW

        const m1 = await fx.init()
        await m1.discoverAllServers()
        expect(await waitFor(() => fx.markerCount('ran') >= 1), 'the approved server never ran').to.equal(true)
        const promptsAfterFirst = fx.prompts.length
        await closeManager()

        fx.answer = () => DENY
        const m2 = await fx.init()
        await m2.discoverAllServers()
        await sleep(900)

        expect(fx.markerCount('ran'), 'the unchanged server did not run again').to.equal(2)
        expect(fx.prompts.length, 'an unchanged, approved server was challenged again').to.equal(promptsAfterFirst)
    })
})
