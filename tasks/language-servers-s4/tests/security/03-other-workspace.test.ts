import { expect } from 'chai'
import * as fs from 'fs'
import * as path from 'path'
import { ALLOW, closeManager, DENY, Fx, sleep, waitFor } from './zzv_harness'

describe('approval identity is scoped to one workspace', () => {
    let fx: Fx

    beforeEach(() => {
        fx = new Fx('sec03')
    })

    afterEach(async () => {
        await closeManager()
        fx.cleanup()
    })

    it('does not reuse an approval granted in another workspace for the same settings', async function () {
        this.timeout(40000)
        const markerA = fx.marker('a')
        const markerB = fx.marker('b')
        const config = { command: 'node', args: ['start.js'], initializationTimeout: 300 }

        // The same textual configuration, but the program it loads lives in the
        // workspace and behaves differently in each one.
        fs.writeFileSync(path.join(fx.ws, 'start.js'), `require('fs').appendFileSync(${JSON.stringify(markerA)}, 'x')`)
        fx.writeWorkspaceMcp({ svc: config })
        fx.answer = () => ALLOW
        const m1 = await fx.init()
        await m1.discoverAllServers()
        expect(await waitFor(() => fs.existsSync(markerA)), 'the approved server never ran').to.equal(true)
        await closeManager()

        const wsB = fx.newWorkspace('ws-b')
        fs.writeFileSync(path.join(wsB, 'start.js'), `require('fs').appendFileSync(${JSON.stringify(markerB)}, 'x')`)
        fx.writeMcpAt(wsB, { svc: config })
        fx.workspaceFolders = [wsB]
        fx.answer = () => DENY
        const m2 = await fx.init()
        await m2.discoverAllServers()
        await sleep(900)

        expect(fs.existsSync(markerB), 'the same settings ran in a second workspace without approval').to.equal(false)
    })
})
