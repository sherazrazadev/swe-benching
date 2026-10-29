import {
  changeOutput,
  commissionOutput,
  createArgs,
  expectRefusedAndUnprocessed,
  extraOutput,
  makeWallet,
  storageResult
} from '../support/harness'

describe('actions with no caller-requested outputs', () => {
  it('refuses an extra recipient in a remix-change action', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      changeOutput(0, 9000),
      extraOutput(1)
    ]))
    await expectRefusedAndUnprocessed(calls, wallet.createAction(createArgs([])))
  })

  it('refuses an extra recipient listed before the change in a remix-change action', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      extraOutput(0),
      changeOutput(1, 9000)
    ]))
    await expectRefusedAndUnprocessed(calls, wallet.createAction(createArgs([])))
  })

  it('refuses an extra recipient in a remix-change action with randomised positions', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      changeOutput(0, 9000),
      extraOutput(1),
      commissionOutput(2, 1000)
    ]))
    await expectRefusedAndUnprocessed(calls, wallet.createAction(createArgs([])))
  })
})
