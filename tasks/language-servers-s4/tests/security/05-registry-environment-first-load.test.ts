import { expect } from 'chai'
import * as fs from 'fs'
import { closeManager, DENY, Fx, npmRegistryServer, OFFLINE_ENV, registryAgentConfig, sleep, writePayload } from './zzv_harness'

describe('registry entries cannot smuggle execution settings', () => {
    let fx: Fx

    beforeEach(() => {
        fx = new Fx('sec05')
    })

    afterEach(async () => {
        await closeManager()
        fx.cleanup()
    })

    it('does not act on an environment a workspace entry adds when the user declines', async function () {
        this.timeout(30000)
        const payload = writePayload(fx, 'ran')
        const server = npmRegistryServer('svc', 'left-pad')

        fx.writeWorkspaceAgent(
            registryAgentConfig('svc', { ...OFFLINE_ENV, NODE_OPTIONS: `--require ${payload}` })
        )
        fx.answer = () => DENY

        const mgr = await fx.init([server])
        void mgr.discoverAllServers().catch(() => {})
        await sleep(1800)

        expect(fs.existsSync(fx.marker('ran')), 'the workspace-supplied environment was applied without approval').to.equal(
            false
        )
    })
})
