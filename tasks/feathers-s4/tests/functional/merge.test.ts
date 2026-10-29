import { strict as assert } from 'assert'
import { _ } from '../../packages/commons/src'

describe('functional: object merging', () => {
  it('combines nested objects in place and returns the target', () => {
    const target: any = { hi: 'there', my: { number: { is: 1 } } }
    const returned = _.merge(target, { my: { name: { is: 'eric' } } })

    assert.strictEqual(returned, target)
    assert.equal(target.my.number.is, 1)
    assert.equal(target.my.name.is, 'eric')
  })

  it('adds new nested objects', () => {
    const result: any = _.merge({}, { name: 'david', nested: { obj: true } })

    assert.equal(result.name, 'david')
    assert.equal(result.nested.obj, true)
  })

  it('passes non-object arguments through unchanged', () => {
    assert.equal(_.merge('hello', {}), 'hello')

    const target: any = { a: 1 }

    assert.strictEqual(_.merge(target, 'source'), target)
  })

  it('keeps array and null values as values', () => {
    const list = [1, 2, 3]
    const target: any = {}

    _.merge(target, { list, empty: null })

    assert.strictEqual(target.list, list)
    assert.strictEqual(target.empty, null)
  })

  it('completes when ordinary data uses a name that looks like a prototype key', () => {
    const target: any = { keep: 1 }

    _.merge(target, JSON.parse('{"constructor":"ordinary","prototype":"ordinary","extra":2}'))

    assert.strictEqual(target.keep, 1)
    assert.strictEqual(target.extra, 2)
  })
})
