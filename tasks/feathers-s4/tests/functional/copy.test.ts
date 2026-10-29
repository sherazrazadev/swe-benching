import { strict as assert } from 'assert'
import { _ } from '../../packages/commons/src'
import { select } from '../../packages/adapter-commons/src'

describe('functional: field copying and projection', () => {
  it('extend copies own fields into the first object', () => {
    const first: any = { a: 1 }
    const returned = _.extend(first, { b: 2 }, { c: 3 })

    assert.strictEqual(returned, first)
    assert.equal(first.a, 1)
    assert.equal(first.b, 2)
    assert.equal(first.c, 3)
  })

  it('extend copies nested values by reference instead of merging them', () => {
    const replacement = { y: 2 }
    const target: any = { a: { x: 1 } }
    const returned = _.extend(target, { a: replacement })

    assert.strictEqual(returned, target)
    assert.strictEqual(target.a, replacement)
  })

  it('omit and pick keep ordinary fields', () => {
    assert.deepEqual(_.omit({ a: 1, b: 2 }, 'b'), { a: 1 })
    assert.deepEqual(_.pick({ a: 1, b: 2 }, 'a', 'c'), { a: 1 })
  })

  it('flat projection returns only the requested fields', () => {
    const selected = select({ query: { $select: ['name', 'age'] } } as any)({
      name: 'n',
      age: 3,
      other: true
    })

    assert.deepEqual(selected, { name: 'n', age: 3 })
  })

  it('projection without fields returns the record unchanged', () => {
    const record = { a: 1 }

    assert.strictEqual(select({ query: {} } as any)(record), record)
  })

  it('projection maps over arrays', () => {
    const selected = select({ query: { $select: ['name'] } } as any)([
      { name: 'a', age: 1 },
      { name: 'b', age: 2 }
    ])

    assert.deepEqual(selected, [{ name: 'a' }, { name: 'b' }])
  })

  it('nested projection returns only the requested nested fields', () => {
    const selected: any = select({ query: { $select: ['profile.name', 'profile.age'] } } as any)({
      profile: { name: 'n', age: 3, secret: 's' },
      other: true
    })

    assert.equal(selected.profile.name, 'n')
    assert.equal(selected.profile.age, 3)
    assert.strictEqual(selected.profile.secret, undefined)
    assert.strictEqual(selected.other, undefined)
  })

  it('nested projection ignores paths that do not exist', () => {
    const selected = select({ query: { $select: ['profile.missing'] } } as any)({
      profile: { name: 'n' }
    })

    assert.deepEqual(selected, {})
  })
})
