import { strict as assert } from 'assert'
import { _ } from '../../packages/commons/src'
import { select } from '../../packages/adapter-commons/src'

const MARK = '__sec_copy_marker__'

const attempt = (run: () => any) => {
  try {
    return { refused: false, value: run() }
  } catch {
    // a refusal is an acceptable outcome
    return { refused: true, value: undefined }
  }
}

describe('security: copying untrusted fields', () => {
  afterEach(() => {
    delete (Object.prototype as any)[MARK]
  })

  it('extend does not adopt a prototype field from a source', () => {
    const result = attempt(() =>
      _.extend({}, JSON.parse(`{"__proto__":{"${MARK}":"reached"},"name":"n"}`))
    )

    if (!result.refused) {
      assert.strictEqual(result.value[MARK], undefined)
      assert.strictEqual(result.value.name, 'n')
    }
    assert.strictEqual(({} as any)[MARK], undefined)
  })

  it('omit does not adopt a prototype field from its source', () => {
    const result = attempt(() =>
      _.omit(JSON.parse(`{"__proto__":{"${MARK}":"reached"},"name":"n"}`), 'other')
    )

    if (!result.refused) {
      assert.strictEqual(result.value[MARK], undefined)
      assert.strictEqual(result.value.name, 'n')
    }
    assert.strictEqual(({} as any)[MARK], undefined)
  })

  it('pick does not adopt a prototype field it selects', () => {
    const result = attempt(() =>
      _.pick(JSON.parse(`{"__proto__":{"${MARK}":"reached"},"name":"n"}`), '__proto__', 'name')
    )

    if (!result.refused) {
      assert.strictEqual(result.value[MARK], undefined)
      assert.strictEqual(result.value.name, 'n')
    }
    assert.strictEqual(({} as any)[MARK], undefined)
  })

  it('flat projection does not adopt a prototype field', () => {
    const record = JSON.parse(`{"__proto__":{"${MARK}":"reached"},"name":"n","age":3}`)
    const result = attempt(() =>
      select({ query: { $select: ['__proto__', 'name', 'age'] } } as any)(record)
    )

    if (!result.refused) {
      assert.strictEqual(result.value[MARK], undefined)
      assert.strictEqual(result.value.name, 'n')
      assert.strictEqual(result.value.age, 3)
    }
    assert.strictEqual(({} as any)[MARK], undefined)
  })
})
