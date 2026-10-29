import {
  changeOutput,
  commissionOutput,
  createArgs,
  echoedOutput,
  expectRefusedAndUnprocessed,
  makeWallet,
  outputHexes,
  outputSatoshis,
  requestedOutput,
  signedTransaction,
  storageResult
} from '../../../../htests/support/harness'

/**
 * Regression tests for GHSA-36f9-7rg5-cpf8.
 *
 * The wallet signs the locking scripts returned by storage. A malicious or
 * compromised remote storage provider could return a different recipient than
 * the caller requested, or add one. These tests drive the public entry point
 * and assert the outcome: a faithful response is signed, a substituted,
 * altered, reclassified or missing caller output is refused before the action
 * is processed.
 */
describe('buildSignableTransaction reconciles the storage response with the request (GHSA-36f9-7rg5-cpf8)', () => {
  const SCRIPT_A = '76a914000000000000000000000000000000000000000088ac'
  const SCRIPT_B = '76a914ffffffffffffffffffffffffffffffffffffffff88ac'

  test('0 accepts faithfully echoed caller outputs (with trailing commission + change)', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      echoedOutput(0, SCRIPT_A, 1000),
      commissionOutput(1, 5, SCRIPT_B, 'service-charge'),
      changeOutput(2, 9000, SCRIPT_B)
    ]))
    const tx = signedTransaction(await wallet.createAction(createArgs([
      requestedOutput(SCRIPT_A, 1000)
    ])))
    if (calls.processAction !== 1) throw new Error('the action was not processed')
    if (!outputHexes(tx).includes(SCRIPT_A)) throw new Error('the requested output was not signed')
  })

  test('1 accepts when there are no caller outputs', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      changeOutput(0, 9000, SCRIPT_B)
    ]))
    const tx = signedTransaction(await wallet.createAction(createArgs([])))
    if (calls.processAction !== 1) throw new Error('the action was not processed')
    if (outputSatoshis(tx)[0] !== 9000) throw new Error('the change amount was not preserved')
  })

  test('2 rejects a substituted recipient locking script', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      echoedOutput(0, SCRIPT_B, 1000),
      changeOutput(1, 9000, SCRIPT_B)
    ]))
    await expectRefusedAndUnprocessed(calls, wallet.createAction(createArgs([
      requestedOutput(SCRIPT_A, 1000)
    ])))
  })

  test('3 rejects an altered satoshi amount', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      echoedOutput(0, SCRIPT_A, 999),
      changeOutput(1, 9000, SCRIPT_B)
    ]))
    await expectRefusedAndUnprocessed(calls, wallet.createAction(createArgs([
      requestedOutput(SCRIPT_A, 1000)
    ])))
  })

  test('4 rejects reclassifying a caller output as storage change', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      changeOutput(0, 1000, SCRIPT_B),
      echoedOutput(1, SCRIPT_A, 1000)
    ]))
    await expectRefusedAndUnprocessed(calls, wallet.createAction(createArgs([
      requestedOutput(SCRIPT_A, 1000)
    ])))
  })

  test('5 rejects when a caller output is missing from the storage response', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      echoedOutput(0, SCRIPT_A, 1000)
    ]))
    await expectRefusedAndUnprocessed(calls, wallet.createAction(createArgs([
      requestedOutput(SCRIPT_A, 1000),
      requestedOutput(SCRIPT_B, 2000)
    ])))
  })

  test('6 verifies multiple caller outputs positionally', async () => {
    const good = makeWallet(() => storageResult([
      echoedOutput(0, SCRIPT_A, 1000),
      echoedOutput(1, SCRIPT_B, 2000),
      changeOutput(2, 9000, SCRIPT_B)
    ]))
    const tx = signedTransaction(await good.wallet.createAction(createArgs([
      requestedOutput(SCRIPT_A, 1000),
      requestedOutput(SCRIPT_B, 2000)
    ])))
    const scripts = outputHexes(tx)
    if (!scripts.includes(SCRIPT_A) || !scripts.includes(SCRIPT_B)) {
      throw new Error('a requested output was not signed')
    }

    // Swap the scripts between the two caller slots: the second slot no longer matches.
    const swapped = makeWallet(() => storageResult([
      echoedOutput(0, SCRIPT_A, 1000),
      echoedOutput(1, SCRIPT_A, 2000),
      changeOutput(2, 9000, SCRIPT_B)
    ]))
    await expectRefusedAndUnprocessed(swapped.calls, swapped.wallet.createAction(createArgs([
      requestedOutput(SCRIPT_A, 1000),
      requestedOutput(SCRIPT_B, 2000)
    ])))
  })
})
