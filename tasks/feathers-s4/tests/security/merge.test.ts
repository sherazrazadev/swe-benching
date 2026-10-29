import { strict as assert } from 'assert'
import { _ } from '../../packages/commons/src'

const MARK = '__sec_merge_marker__'

const attempt = (run: () => void) => {
  try {
    run()
  } catch {
    // a refusal is an acceptable outcome
  }
}

describe('security: combining untrusted data', () => {
  afterEach(() => {
    delete (Object.prototype as any)[MARK]
  })

  it('does not install a top-level prototype field on every object', () => {
    attempt(() => _.merge({}, JSON.parse(`{"__proto__":{"${MARK}":"reached"}}`)))

    assert.strictEqual(({} as any)[MARK], undefined)
  })

  it('does not install a nested prototype field on every object', () => {
    const target: any = { nested: {} }

    attempt(() => _.merge(target, JSON.parse(`{"nested":{"__proto__":{"${MARK}":"reached"}}}`)))

    assert.strictEqual(({} as any)[MARK], undefined)
    assert.strictEqual(target.nested[MARK], undefined)
  })

  it('does not replace the prototype of the object it merges into', () => {
    const target: any = { keep: 1 }

    attempt(() => _.merge(target, JSON.parse('{"__proto__":null}')))

    assert.strictEqual(Object.getPrototypeOf(target), Object.prototype)
    assert.strictEqual(typeof target.hasOwnProperty, 'function')
  })
})
