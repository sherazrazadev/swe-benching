import { strict as assert } from 'assert'
import { MemoryService } from '../../packages/memory/src'

const MARK = '__sec_clone_marker__'

const record = () => JSON.parse(`{"__proto__":{"${MARK}":"reached"},"name":"n","age":3}`)

describe('security: records returned by a service', () => {
  afterEach(() => {
    delete (Object.prototype as any)[MARK]
  })

  it('a fetched record does not inherit a prototype field', async () => {
    const service = new MemoryService({ startId: 1 })
    await service.create(record())

    let one: any
    let refused = false
    try {
      one = await service.get(1)
    } catch {
      refused = true
    }

    if (!refused) {
      assert.strictEqual(one[MARK], undefined)
      assert.strictEqual(one.name, 'n')
    }
    assert.strictEqual(({} as any)[MARK], undefined)
  })

  it('records listed by a service do not inherit a prototype field', async () => {
    const service = new MemoryService({ startId: 1 })
    await service.create(record())

    let all: any
    let refused = false
    try {
      all = await service.find({})
    } catch {
      refused = true
    }

    if (!refused) {
      assert.ok(Array.isArray(all))
      assert.strictEqual(all[0][MARK], undefined)
      assert.strictEqual(all[0].name, 'n')
    }
    assert.strictEqual(({} as any)[MARK], undefined)
  })

  it('a projected record does not inherit a prototype field', async () => {
    const service = new MemoryService({ startId: 1 })
    await service.create(record())

    let one: any
    let refused = false
    try {
      one = await service.get(1, { query: { $select: ['__proto__', 'name', 'id'] } } as any)
    } catch {
      refused = true
    }

    if (!refused) {
      assert.strictEqual(one[MARK], undefined)
      assert.strictEqual(one.name, 'n')
    }
    assert.strictEqual(({} as any)[MARK], undefined)
  })
})
