import { strict as assert } from 'assert'
import { filterQuery } from '../../packages/adapter-commons/src'

const MARK = '__sec_query_marker__'

const attempt = (run: () => any) => {
  try {
    return { refused: false, value: run() }
  } catch {
    // a refusal is an acceptable outcome
    return { refused: true, value: undefined }
  }
}

describe('security: untrusted query field names', () => {
  afterEach(() => {
    delete (Object.prototype as any)[MARK]
  })

  it('a query does not inherit a prototype field from its own keys', () => {
    const result = attempt(() =>
      filterQuery(JSON.parse(`{"__proto__":{"${MARK}":"reached"},"name":"n"}`))
    )

    if (!result.refused) {
      assert.strictEqual(result.value.query[MARK], undefined)
      assert.strictEqual(result.value.query.name, 'n')
    }
    assert.strictEqual(({} as any)[MARK], undefined)
  })

  it('a sort specification does not gain a prototype field', () => {
    const result = attempt(() =>
      filterQuery(JSON.parse(`{"$sort":{"__proto__":{"${MARK}":"reached"},"name":1}}`))
    )

    if (!result.refused) {
      assert.strictEqual(result.value.filters.$sort[MARK], undefined)
      assert.strictEqual(result.value.filters.$sort.name, 1)
    }
    assert.strictEqual(({} as any)[MARK], undefined)
  })
})
