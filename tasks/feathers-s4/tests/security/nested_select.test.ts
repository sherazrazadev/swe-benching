import { strict as assert } from 'assert'
import { select } from '../../packages/adapter-commons/src'
import { MemoryService } from '../../packages/memory/src'

const MARK = '__sec_nested_marker__'

const attempt = (run: () => any) => {
  try {
    return { refused: false, value: run() }
  } catch {
    // a refusal is an acceptable outcome
    return { refused: true, value: undefined }
  }
}

describe('security: nested projections', () => {
  afterEach(() => {
    delete (Object.prototype as any)[MARK]
  })

  it('does not set the prototype of a nested selected object', () => {
    const record = JSON.parse(`{"profile":{"__proto__":{"${MARK}":"reached"},"name":"n"},"name":"top"}`)
    const result = attempt(() =>
      select({ query: { $select: ['profile.name', 'profile.__proto__'] } } as any)(record)
    )

    if (!result.refused) {
      assert.strictEqual(result.value.profile[MARK], undefined)
      assert.strictEqual(result.value.profile.name, 'n')
    }
    assert.strictEqual(({} as any)[MARK], undefined)
  })

  it('does not write a shared prototype through a nested path', async () => {
    const service = new MemoryService({ startId: 1 })
    await service.create(
      JSON.parse(`{"profile":{"__proto__":{"${MARK}":"reached"},"name":"n"},"name":"top"}`)
    )

    let result: any
    let refused = false
    try {
      result = await service.get(1, {
        query: { $select: ['profile.name', `profile.__proto__.${MARK}`] }
      } as any)
    } catch {
      refused = true
    }

    if (!refused) {
      assert.strictEqual(result.profile.name, 'n')
    }
    assert.strictEqual(({} as any)[MARK], undefined)
  })
})
