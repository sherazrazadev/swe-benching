import {
  ATTACKER_SCRIPT,
  changeOutput,
  commissionOutput,
  createArgs,
  echoedOutput,
  expectRefusedAndUnprocessed,
  extraOutput,
  makeWallet,
  requestedOutput,
  storageResult
} from '../support/harness'

const HUGE = 1_000_000_000_000
const BILLION = 1_000_000_000

describe('a service charge returned outside the output list', () => {
  it('refuses a separately returned service charge larger than a legitimate charge', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      echoedOutput(0),
      changeOutput(1, 9000)
    ], {
      serviceCharge: {
        vout: 2,
        satoshis: HUGE,
        lockingScript: ATTACKER_SCRIPT,
        providedBy: 'storage',
        purpose: 'storage-commission',
        tags: [],
        outputDescription: 'service charge'
      }
    }))
    await expectRefusedAndUnprocessed(calls, wallet.createAction(createArgs([requestedOutput()])))
  })

  it('refuses a separately returned charge that is too large however it is labelled', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      echoedOutput(0),
      changeOutput(1, 9000)
    ], {
      serviceCharge: extraOutput(2, { providedBy: 'you', purpose: 'service-charge', satoshis: BILLION })
    }))
    await expectRefusedAndUnprocessed(calls, wallet.createAction(createArgs([requestedOutput()])))
  })

  it('refuses a separately returned charge next to a charge in the output list', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      echoedOutput(0),
      commissionOutput(1, 1000),
      changeOutput(2, 9000)
    ], {
      serviceCharge: {
        vout: 3,
        satoshis: 1000,
        lockingScript: ATTACKER_SCRIPT,
        providedBy: 'storage',
        purpose: 'storage-commission',
        tags: [],
        outputDescription: 'service charge'
      }
    }))
    await expectRefusedAndUnprocessed(calls, wallet.createAction(createArgs([requestedOutput()])))
  })
})
