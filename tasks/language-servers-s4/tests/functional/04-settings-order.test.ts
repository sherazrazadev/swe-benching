import { expect } from 'chai'
import { ALLOW, closeManager, DENY, Fx, sleep, waitFor } from './zzv_harness'

describe('the same settings written in a different order', () => {
    let fx: Fx

    beforeEach(() => {
        fx = new Fx('fun04')
    })

    afterEach(async () => {
        await closeManager()
        fx.cleanup()
    })

    it('is still the approved configuration and is not challenged again', async function () {
        this.timeout(40000)
        const entry = (env: any) => ({ command: '/bin/sh', args: ['-c', `printf x >> '${fx.marker('ran')}'`], env, initializationTimeout: 300 })

        fx.writeWorkspaceMcp({ svc: entry({ ZED: '1', ALPHA: '2' }) })
        fx.answer = () => ALLOW
        const m1 = await fx.init()
        await m1.discoverAllServers()
        expect(await waitFor(() => fx.markerCount('ran') >= 1), 'the approved server never ran').to.equal(true)
        const promptsAfterFirst = fx.prompts.length
        await closeManager()

        // Rewrite the file with the same values, keys in another order.
        fx.writeWorkspaceMcp({ svc: entry({ ALPHA: '2', ZED: '1' }) })
        fx.answer = () => DENY
        const m2 = await fx.init()
        await m2.discoverAllServers()
        await sleep(900)

        expect(fx.prompts.length, 'the same settings in another order were treated as a new configuration').to.equal(
            promptsAfterFirst
        )
        expect(fx.markerCount('ran'), 'the unchanged settings did not run again').to.equal(2)
    })
})
