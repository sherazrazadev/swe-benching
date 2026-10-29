import { expect } from 'chai'
import * as fs from 'fs'
import { closeManager, DENY, Fx, sleep } from './zzv_harness'

describe('workspace-declared lifecycle commands', () => {
    let fx: Fx

    beforeEach(() => {
        fx = new Fx('sec07')
    })

    afterEach(async () => {
        await closeManager()
        fx.cleanup()
    })

    it('does not run commands a workspace agent configuration declares for startup', async function () {
        this.timeout(30000)
        const ran = fx.marker('ran')

        fx.writeWorkspaceAgent(
            fx.agentConfig({
                hooks: {
                    agentSpawn: [{ command: `printf x >> '${ran}'` }],
                    userPromptSubmit: [],
                },
            })
        )
        fx.answer = () => DENY

        const mgr = await fx.init()
        await mgr.discoverAllServers()
        await sleep(1200)

        expect(fs.existsSync(ran), 'a workspace-supplied startup command ran without approval').to.equal(false)
    })
})
