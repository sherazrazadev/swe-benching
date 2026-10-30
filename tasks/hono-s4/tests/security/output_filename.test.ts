import { describe, it, expect } from 'vitest'
import { Hono } from '../../src/hono'
import { saveContentToFile, toSSG } from '../../src/helper/ssg/ssg'
import { attempt, callsOutside, recordingFs, reportedInside } from '../support/harness'

const OUTPUT_HEADER = 'x-hono-ssg-filename'

describe('a response-chosen file name cannot escape the output directory', () => {
  it('refuses a chosen name with a parent segment', async () => {
    const app = new Hono()
    app.get('/page', (c) => {
      c.header(OUTPUT_HEADER, '../pwned.html')
      return c.text('page')
    })
    const { fs, calls } = recordingFs()

    const outcome = await attempt(toSSG(app, fs, { dir: './static' }))

    expect(reportedInside(outcome, './static')).toBe(true)
    expect(callsOutside(calls, './static')).toEqual([])
  })

  it('refuses a chosen name with a run of parent segments', async () => {
    const app = new Hono()
    app.get('/page', (c) => {
      c.header(OUTPUT_HEADER, 'a/b/../../../pwned.html')
      return c.text('page')
    })
    const { fs, calls } = recordingFs()

    const outcome = await attempt(toSSG(app, fs, { dir: './static' }))

    expect(reportedInside(outcome, './static')).toBe(true)
    expect(callsOutside(calls, './static')).toEqual([])
  })

  it('refuses a chosen name supplied one page at a time', async () => {
    const { fs, calls } = recordingFs()

    const outcome = await attempt(
      saveContentToFile(
        Promise.resolve({
          routePath: '/page',
          content: 'page',
          mimeType: 'text/plain',
          outputName: '../pwned.html',
        }),
        fs,
        './static'
      )
    )

    expect(reportedInside(outcome, './static')).toBe(true)
    expect(callsOutside(calls, './static')).toEqual([])
  })
})
