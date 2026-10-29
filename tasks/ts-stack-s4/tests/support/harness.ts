/**
 * Shared helpers for the hidden suites. Everything here drives the library
 * through its public API only, with an external storage provider stubbed at the
 * transport boundary.
 */
import { CachedKeyDeriver, PrivateKey, Transaction } from '@bsv/sdk'
import { Wallet } from '../../src/Wallet'

export const REQUESTED_SCRIPT = '76a914000000000000000000000000000000000000000088ac'
export const REQUESTED_SCRIPT_2 = '76a9141111111111111111111111111111111111111188ac'
export const STORAGE_SCRIPT = '76a914ffffffffffffffffffffffffffffffffffffffff88ac'
export const STORAGE_SCRIPT_ALT = '76a914eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee88ac'
export const ATTACKER_SCRIPT = '76a914deadbeefdeadbeefdeadbeefdeadbeefdeadbeef88ac'
export const OTHER_ATTACKER_SCRIPT = '76a914cafebabecafebabecafebabecafebabecafebabe88ac'

export interface StorageCalls {
  createAction: number
  processAction: number
  abortAction: number
}

export interface Harness {
  wallet: Wallet
  calls: StorageCalls
  stored: any[]
}

export function makeWallet (respond: (sent: any) => any): Harness {
  const keyDeriver = new CachedKeyDeriver(PrivateKey.fromHex('1'.repeat(64)))
  const identityKey = keyDeriver.identityKey
  const calls: StorageCalls = { createAction: 0, processAction: 0, abortAction: 0 }
  const stored: any[] = []
  const storage: any = {
    _authId: { identityKey },
    getSettings: () => ({ storageIdentityKey: identityKey, storageName: 'stub-storage' }),
    getAuth: async () => ({ identityKey }),
    setServices: () => {},
    createAction: async (sent: any) => {
      calls.createAction++
      stored.push(sent)
      return respond(sent)
    },
    processAction: async () => {
      calls.processAction++
      return { sendWithResults: [], notDelayedResults: [] }
    },
    abortAction: async () => {
      calls.abortAction++
      return { aborted: true }
    }
  }
  const wallet = new Wallet({ chain: 'test', keyDeriver, storage } as any)
  return { wallet, calls, stored }
}

/** A storage response with no inputs; outputs are supplied by the test. */
export function storageResult (outputs: any[], extra: Record<string, any> = {}): any {
  return {
    inputs: [],
    outputs,
    derivationPrefix: 'cHJlZml4',
    version: 1,
    lockTime: 0,
    reference: 'cmVmZXJlbmNl',
    ...extra
  }
}

export function requestedOutput (script = REQUESTED_SCRIPT, satoshis = 1000, outputDescription = 'payment') {
  return { lockingScript: script, satoshis, outputDescription }
}

export function echoedOutput (vout: number, script = REQUESTED_SCRIPT, satoshis = 1000) {
  return { vout, satoshis, lockingScript: script, providedBy: 'you', tags: [], outputDescription: 'payment' }
}

export function changeOutput (vout: number, satoshis: number, script = STORAGE_SCRIPT, derivationSuffix = 'c3VmZml4') {
  return {
    vout,
    satoshis,
    lockingScript: script,
    providedBy: 'storage',
    purpose: 'change',
    derivationSuffix,
    tags: [],
    outputDescription: 'change'
  }
}

export function commissionOutput (vout: number, satoshis: number, script = STORAGE_SCRIPT) {
  return {
    vout,
    satoshis,
    lockingScript: script,
    providedBy: 'storage',
    purpose: 'storage-commission',
    tags: [],
    outputDescription: 'service charge'
  }
}

export function extraOutput (vout: number, overrides: Record<string, any> = {}) {
  return {
    vout,
    satoshis: 5000,
    lockingScript: ATTACKER_SCRIPT,
    providedBy: 'you',
    tags: [],
    outputDescription: 'extra recipient',
    ...overrides
  }
}

export function createArgs (outputs: any[], overrides: Record<string, any> = {}) {
  return { description: 'pay a recipient', outputs, ...overrides }
}

export function signedTransaction (result: any): Transaction {
  if (result == null || result.tx == null) throw new Error('createAction did not return a transaction')
  return Transaction.fromAtomicBEEF(result.tx)
}

export function outputHexes (tx: Transaction): string[] {
  return tx.outputs.map(o => o.lockingScript.toHex().toLowerCase())
}

export function outputSatoshis (tx: Transaction): number[] {
  return tx.outputs.map(o => o.satoshis ?? 0)
}

/** Assert a call was refused: it rejected and the action was never processed. */
export async function expectRefusedAndUnprocessed (calls: StorageCalls, promise: Promise<unknown>): Promise<void> {
  let rejected = false
  try {
    await promise
  } catch (e) {
    if (!(e instanceof Error)) throw new Error('refusal was not an Error')
    rejected = true
  }
  if (!rejected) throw new Error('the action was not refused')
  if (calls.processAction !== 0) throw new Error('a refused action was still processed')
}
