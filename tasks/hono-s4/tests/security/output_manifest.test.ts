import { describe, it, expect } from 'vitest'
import { Hono } from '../../src/hono'
import { toSSG } from '../../src/helper/ssg/ssg'
import { attempt, callsOutside, recordingFs, reportedInside } from '../support/harness'

describe('an output manifest cannot be written outside the output directory', () => {
  it('refuses a manifest name with a parent segment', async () => {
    const app = new Hono()
    app.get('/', (c) => c.text('home'))
    const { fs, calls } = recordingFs()

    const outcome = await attempt(toSSG(app, fs, { dir: './static', manifest: '../pwned.json' }))

    expect(reportedInside(outcome, './static')).toBe(true)
    expect(callsOutside(calls, './static')).toEqual([])
  })

  it('refuses a manifest name with a run of parent segments', async () => {
    const app = new Hono()
    app.get('/', (c) => c.text('home'))
    const { fs, calls } = recordingFs()

    const outcome = await attempt(
      toSSG(app, fs, { dir: './static', manifest: 'a/b/../../../pwned.json' })
    )

    expect(reportedInside(outcome, './static')).toBe(true)
    expect(callsOutside(calls, './static')).toEqual([])
  })

  it('refuses an absolute-looking manifest name that climbs out', async () => {
    const app = new Hono()
    app.get('/', (c) => c.text('home'))
    const { fs, calls } = recordingFs()

    const outcome = await attempt(toSSG(app, fs, { dir: './static', manifest: '/../../pwned.json' }))

    expect(reportedInside(outcome, './static')).toBe(true)
    expect(callsOutside(calls, './static')).toEqual([])
  })
})
