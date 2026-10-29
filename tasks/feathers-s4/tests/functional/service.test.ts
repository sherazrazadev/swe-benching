import { strict as assert } from 'assert'
import { MemoryService } from '../../packages/memory/src'
import { filterQuery } from '../../packages/adapter-commons/src'

describe('functional: services and query conversion', () => {
  it('stores and returns ordinary records', async () => {
    const service = new MemoryService({ startId: 1 })
    const created: any = await service.create({ name: 'n', age: 3 })
    const one: any = await service.get(created.id)
    const all: any = await service.find({})

    assert.equal(one.name, 'n')
    assert.equal(one.age, 3)
    assert.ok(Array.isArray(all))
    assert.equal(all.length, 1)
    assert.equal(all[0].name, 'n')
  })

  it('projects flat fields for a fetched record', async () => {
    const service = new MemoryService({ startId: 1 })
    await service.create({ name: 'n', age: 3 })
    const one: any = await service.get(1, { query: { $select: ['name'] } } as any)

    assert.equal(one.name, 'n')
    assert.equal(one.id, 1)
    assert.strictEqual(one.age, undefined)
  })

  it('returns nested record data unchanged', async () => {
    const service = new MemoryService({ startId: 1 })
    await service.create({ name: 'n', profile: { city: 'x', tags: ['a', 'b'] } })
    const one: any = await service.get(1)

    assert.equal(one.profile.city, 'x')
    assert.deepEqual(one.profile.tags, ['a', 'b'])
  })

  it('splits filters from ordinary query fields', () => {
    const { filters, query } = filterQuery({ $limit: '2', $sort: { age: 1 }, name: 'n' } as any)

    assert.equal(filters.$limit, 2)
    assert.equal(filters.$sort.age, 1)
    assert.equal(query.name, 'n')
    assert.deepEqual(Object.keys(query), ['name'])
  })

  it('stringifies a selected field list', () => {
    const { filters } = filterQuery({ $select: ['name', 1] } as any)

    assert.deepEqual(filters.$select, ['name', '1'])
  })

  it('rejects an unknown special parameter', () => {
    assert.throws(() => filterQuery({ $unknown: 1 } as any))
  })
})
