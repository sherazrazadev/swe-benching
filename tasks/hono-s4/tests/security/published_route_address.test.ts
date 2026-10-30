import { describe, it, expect } from 'vitest'
import { Hono } from '../../src/hono'
import { saveContentToFile, toSSG } from '../../src/helper/ssg/ssg'
import { ssgParams } from '../../src/helper/ssg/middleware'
import { attempt, callsOutside, recordingFs, reportedInside } from '../support/harness'

describe('page addresses cannot escape the output directory', () => {
  it('refuses a generated route value with parent segments', async () => {
    const app = new Hono()
    app.get('/:id', ssgParams([{ id: 'a/b/../../../pwned' }]), (c) => c.text('owned'))
    const { fs, calls } = recordingFs()

    const outcome = await attempt(toSSG(app, fs, { dir: './static' }))

    expect(reportedInside(outcome, './static')).toBe(true)
    expect(callsOutside(calls, './static')).toEqual([])
  })

  it('refuses a generated route value that ends with the file extension', async () => {
    const app = new Hono()
    app.get('/:id', ssgParams([{ id: 'a/b/../../../pwned.txt' }]), (c) => c.text('owned'))
    const { fs, calls } = recordingFs()

    const outcome = await attempt(toSSG(app, fs, { dir: './static' }))

    expect(reportedInside(outcome, './static')).toBe(true)
    expect(callsOutside(calls, './static')).toEqual([])
  })

  it('refuses a generated route value that ends with a separator', async () => {
    const app = new Hono()
    app.get('/', (c) => c.text('root'))
    app.get('/:id', ssgParams([{ id: 'a/b/../../../' }]), (c) => c.text('owned'))
    const { fs, calls } = recordingFs()

    const outcome = await attempt(toSSG(app, fs, { dir: './static' }))

    expect(reportedInside(outcome, './static')).toBe(true)
    expect(callsOutside(calls, './static')).toEqual([])
  })

  it('refuses a longer run of parent segments', async () => {
    const app = new Hono()
    app.get('/:id', ssgParams([{ id: 'a/b/c/../../../../pwned' }]), (c) => c.text('owned'))
    const { fs, calls } = recordingFs()

    const outcome = await attempt(toSSG(app, fs, { dir: './static' }))

    expect(reportedInside(outcome, './static')).toBe(true)
    expect(callsOutside(calls, './static')).toEqual([])
  })

  it('refuses an escaping route value under an absolute output directory', async () => {
    const app = new Hono()
    app.get('/:id', ssgParams([{ id: 'a/b/../../../pwned' }]), (c) => c.text('owned'))
    const { fs, calls } = recordingFs()

    const outcome = await attempt(toSSG(app, fs, { dir: '/srv/out' }))

    expect(reportedInside(outcome, '/srv/out')).toBe(true)
    expect(callsOutside(calls, '/srv/out')).toEqual([])
  })

  it('refuses an escaping page address written one page at a time', async () => {
    const { fs, calls } = recordingFs()

    const outcome = await attempt(
      saveContentToFile(
        Promise.resolve({
          routePath: '/a/b/../../../pwned.txt',
          content: 'owned',
          mimeType: 'text/plain',
        }),
        fs,
        './static'
      )
    )

    expect(reportedInside(outcome, './static')).toBe(true)
    expect(callsOutside(calls, './static')).toEqual([])
  })
})
