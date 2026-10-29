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
  REQUESTED_SCRIPT_2,
  storageResult
} from '../support/harness'

const HUGE = 1_000_000_000_000
const BILLION = 1_000_000_000

describe('the storage response is reconciled with the caller request', () => {
  it('refuses an extra recipient returned alongside the requested outputs', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      echoedOutput(0),
      extraOutput(1),
      changeOutput(2, 9000)
    ]))
    await expectRefusedAndUnprocessed(calls, wallet.createAction(createArgs([requestedOutput()])))
  })

  it('refuses an extra recipient labelled as change without the storage provider label', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      echoedOutput(0),
      extraOutput(1, { providedBy: 'you', purpose: 'change' }),
      changeOutput(2, 9000)
    ]))
    await expectRefusedAndUnprocessed(calls, wallet.createAction(createArgs([requestedOutput()])))
  })

  it('refuses a second service charge returned with a different provider label', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      echoedOutput(0),
      commissionOutput(1, 1000),
      extraOutput(2, { providedBy: 'you', purpose: 'service-charge', satoshis: 1000 }),
      changeOutput(3, 9000)
    ]))
    await expectRefusedAndUnprocessed(calls, wallet.createAction(createArgs([requestedOutput()])))
  })

  it('refuses an extra recipient carrying an unrelated storage label', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      echoedOutput(0),
      extraOutput(1, { providedBy: 'storage', purpose: 'basket-payout' }),
      changeOutput(2, 9000)
    ]))
    await expectRefusedAndUnprocessed(calls, wallet.createAction(createArgs([requestedOutput()])))
  })

  it('refuses an extra recipient with no provider label at all', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      echoedOutput(0),
      extraOutput(1, { providedBy: undefined }),
      changeOutput(2, 9000)
    ]))
    await expectRefusedAndUnprocessed(calls, wallet.createAction(createArgs([requestedOutput()])))
  })

  it('refuses a second service charge', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      echoedOutput(0),
      commissionOutput(1, 1000),
      commissionOutput(2, 1000),
      changeOutput(3, 9000)
    ]))
    await expectRefusedAndUnprocessed(calls, wallet.createAction(createArgs([requestedOutput()])))
  })

  it('refuses a service charge larger than a legitimate charge', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      echoedOutput(0),
      extraOutput(1, { providedBy: 'storage', purpose: 'storage-commission', satoshis: HUGE, lockingScript: ATTACKER_SCRIPT }),
      changeOutput(2, 9000)
    ]))
    await expectRefusedAndUnprocessed(calls, wallet.createAction(createArgs([requestedOutput()])))
  })

  it('refuses a service charge of a billion satoshis', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      echoedOutput(0),
      extraOutput(1, { providedBy: 'storage', purpose: 'service-charge', satoshis: BILLION, lockingScript: ATTACKER_SCRIPT }),
      changeOutput(2, 9000)
    ]))
    await expectRefusedAndUnprocessed(calls, wallet.createAction(createArgs([requestedOutput()])))
  })

  it('refuses an extra recipient when several outputs were requested', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      echoedOutput(0, '76a914000000000000000000000000000000000000000088ac', 1000),
      echoedOutput(1, REQUESTED_SCRIPT_2, 2000),
      extraOutput(2),
      changeOutput(3, 9000)
    ]))
    await expectRefusedAndUnprocessed(calls, wallet.createAction(createArgs([
      requestedOutput('76a914000000000000000000000000000000000000000088ac', 1000),
      requestedOutput(REQUESTED_SCRIPT_2, 2000)
    ])))
  })

  it('refuses an extra recipient when output positions are randomised', async () => {
    // The response array keeps the caller's output first, but the transaction
    // positions are shuffled; the extra recipient must still be caught.
    const { wallet, calls } = makeWallet(() => storageResult([
      echoedOutput(2),
      extraOutput(0),
      changeOutput(1, 9000)
    ]))
    await expectRefusedAndUnprocessed(calls, wallet.createAction(createArgs([requestedOutput()])))
  })
})
