import { expect } from 'chai'
import * as fs from 'fs'
import { ALLOW, closeManager, DENY, Fx, sleep, waitFor } from './zzv_harness'

describe('approval identity covers the execution configuration', () => {
    let fx: Fx

    beforeEach(() => {
        fx = new Fx('sec02')
    })

    afterEach(async () => {
        await closeManager()
        fx.cleanup()
    })

    it('requires a fresh approval after the command or its arguments change', async function () {
        this.timeout(40000)
        const first = fx.marker('first')
        const second = fx.marker('second')

        fx.writeWorkspaceMcp({ svc: fx.shellServer('first') })
        fx.answer = () => ALLOW
        const m1 = await fx.init()
        await m1.discoverAllServers()
        expect(await waitFor(() => fs.existsSync(first)), 'the approved server never ran').to.equal(true)
        await closeManager()

        // The workspace file now names a different command line.
        fx.writeWorkspaceMcp({ svc: fx.shellServer('second') })
        fx.answer = () => DENY
        const m2 = await fx.init()
        await m2.discoverAllServers()
        await sleep(900)

        expect(fs.existsSync(second), 'a changed command line ran under the old approval').to.equal(false)
    })
})
