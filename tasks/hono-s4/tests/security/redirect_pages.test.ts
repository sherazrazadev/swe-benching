import { describe, it, expect } from 'vitest'
import { Hono } from '../../src/hono'
import { toSSG } from '../../src/helper/ssg/ssg'
import { attempt, callsOutside, recordingFs, reportedInside } from '../support/harness'

describe('a redirect page cannot be written outside the output directory', () => {
  it('refuses a redirect target with parent segments', async () => {
    const app = new Hono()
    app.get('/old', (c) => c.redirect('/../../pwned'))
    const { fs, calls } = recordingFs()

    const outcome = await attempt(toSSG(app, fs, { dir: './static', redirectFiles: true }))

    expect(reportedInside(outcome, './static')).toBe(true)
    expect(callsOutside(calls, './static')).toEqual([])
  })

  it('refuses a relative redirect target with parent segments', async () => {
    const app = new Hono()
    app.get('/old', (c) => c.redirect('../../pwned'))
    const { fs, calls } = recordingFs()

    const outcome = await attempt(toSSG(app, fs, { dir: './static', redirectFiles: true }))

    expect(reportedInside(outcome, './static')).toBe(true)
    expect(callsOutside(calls, './static')).toEqual([])
  })

  it('refuses a redirect target with a run of parent segments', async () => {
    const app = new Hono()
    app.get('/old', (c) => c.redirect('/a/b/../../../pwned'))
    const { fs, calls } = recordingFs()

    const outcome = await attempt(toSSG(app, fs, { dir: './static', redirectFiles: true }))

    expect(reportedInside(outcome, './static')).toBe(true)
    expect(callsOutside(calls, './static')).toEqual([])
  })
})
