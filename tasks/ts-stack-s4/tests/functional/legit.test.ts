import {
  ATTACKER_SCRIPT,
  changeOutput,
  commissionOutput,
  createArgs,
  echoedOutput,
  makeWallet,
  outputHexes,
  outputSatoshis,
  requestedOutput,
  REQUESTED_SCRIPT,
  REQUESTED_SCRIPT_2,
  signedTransaction,
  storageResult,
  STORAGE_SCRIPT,
  STORAGE_SCRIPT_ALT
} from '../support/harness'

describe('legitimate actions keep working', () => {
  it('signs a requested output together with the caller change', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      echoedOutput(0),
      changeOutput(1, 9000)
    ]))
    const result = await wallet.createAction(createArgs([requestedOutput()]))
    const tx = signedTransaction(result)
    const scripts = outputHexes(tx)
    if (scripts[0] !== REQUESTED_SCRIPT) throw new Error('the requested output was not signed')
    if (scripts.includes(STORAGE_SCRIPT)) throw new Error('the storage-supplied change script was signed verbatim')
    if (outputSatoshis(tx)[1] !== 9000) throw new Error('the change amount was not preserved')
    if (calls.processAction !== 1) throw new Error('the action was not processed')
  })

  it('derives the change script locally, ignoring the storage-supplied script', async () => {
    const first = makeWallet(() => storageResult([echoedOutput(0), changeOutput(1, 9000, STORAGE_SCRIPT)]))
    const second = makeWallet(() => storageResult([echoedOutput(0), changeOutput(1, 9000, STORAGE_SCRIPT_ALT)]))
    const a = signedTransaction(await first.wallet.createAction(createArgs([requestedOutput()])))
    const b = signedTransaction(await second.wallet.createAction(createArgs([requestedOutput()])))
    const changeA = outputHexes(a)[1]
    const changeB = outputHexes(b)[1]
    if (changeA !== changeB) throw new Error('the change script was not derived deterministically from the caller keys')
    if (changeA === STORAGE_SCRIPT || changeA === STORAGE_SCRIPT_ALT) {
      throw new Error('the storage-supplied script was used for change')
    }
  })

  it('accepts a change output at any amount', async () => {
    const { wallet } = makeWallet(() => storageResult([
      echoedOutput(0),
      changeOutput(1, 210_000_000)
    ]))
    const tx = signedTransaction(await wallet.createAction(createArgs([requestedOutput()])))
    if (outputSatoshis(tx)[1] !== 210_000_000) throw new Error('the change amount was not preserved')
  })

  it('signs one small service charge', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      echoedOutput(0),
      commissionOutput(1, 1000),
      changeOutput(2, 9000)
    ]))
    const tx = signedTransaction(await wallet.createAction(createArgs([requestedOutput()])))
    if (calls.processAction !== 1) throw new Error('the action was not processed')
    const scripts = outputHexes(tx)
    if (!scripts.includes(STORAGE_SCRIPT)) throw new Error('the service charge output was not signed')
  })

  it('signs a service charge of ten thousand satoshis', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      echoedOutput(0),
      commissionOutput(1, 10_000, STORAGE_SCRIPT, 'service-charge'),
      changeOutput(2, 9000)
    ]))
    const tx = signedTransaction(await wallet.createAction(createArgs([requestedOutput()])))
    if (calls.processAction !== 1) throw new Error('the action was not processed')
    if (!outputHexes(tx).includes(STORAGE_SCRIPT)) throw new Error('the service charge output was not signed')
  })

  it('signs every requested output faithfully', async () => {
    const { wallet } = makeWallet(() => storageResult([
      echoedOutput(0, REQUESTED_SCRIPT, 1000),
      echoedOutput(1, REQUESTED_SCRIPT_2, 2000),
      changeOutput(2, 9000)
    ]))
    const tx = signedTransaction(await wallet.createAction(createArgs([
      requestedOutput(REQUESTED_SCRIPT, 1000),
      requestedOutput(REQUESTED_SCRIPT_2, 2000)
    ])))
    const scripts = outputHexes(tx)
    if (!scripts.includes(REQUESTED_SCRIPT) || !scripts.includes(REQUESTED_SCRIPT_2)) {
      throw new Error('a requested output was not signed')
    }
  })

  it('preserves requested outputs when positions are randomised', async () => {
    const { wallet } = makeWallet(() => storageResult([
      echoedOutput(1),
      changeOutput(0, 9000)
    ]))
    const tx = signedTransaction(await wallet.createAction(createArgs([requestedOutput()])))
    const scripts = outputHexes(tx)
    if (!scripts.includes(REQUESTED_SCRIPT)) throw new Error('the requested output was not signed')
    // vout 0 is the change, so the transaction's first output is the change
    if (outputSatoshis(tx)[0] !== 9000) throw new Error('the randomised output order was not honoured')
  })

  it('signs a remix-change action that only carries change', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      changeOutput(0, 9000)
    ]))
    const result = await wallet.createAction(createArgs([]))
    const tx = signedTransaction(result)
    if (calls.processAction !== 1) throw new Error('the remix action was not processed')
    if (outputSatoshis(tx)[0] !== 9000) throw new Error('the change amount was not preserved')
    if (outputHexes(tx)[0] === STORAGE_SCRIPT) throw new Error('the storage-supplied change script was used')
  })

  it('signs a remix-change action with one small service charge', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      changeOutput(0, 9000),
      commissionOutput(1, 1000)
    ]))
    const tx = signedTransaction(await wallet.createAction(createArgs([])))
    if (calls.processAction !== 1) throw new Error('the remix action was not processed')
    if (!outputHexes(tx).includes(STORAGE_SCRIPT)) throw new Error('the service charge output was not signed')
  })

  it('includes a small service charge returned outside the output list', async () => {
    const { wallet, calls } = makeWallet(() => storageResult([
      echoedOutput(0),
      changeOutput(1, 9000)
    ], {
      serviceCharge: {
        vout: 2,
        satoshis: 1000,
        lockingScript: ATTACKER_SCRIPT,
        providedBy: 'storage',
        purpose: 'storage-commission',
        tags: [],
        outputDescription: 'service charge'
      }
    }))
    const tx = signedTransaction(await wallet.createAction(createArgs([requestedOutput()])))
    if (calls.processAction !== 1) throw new Error('the action was not processed')
    if (!outputHexes(tx).includes(ATTACKER_SCRIPT)) throw new Error('the separately returned charge was not signed')
  })
})
