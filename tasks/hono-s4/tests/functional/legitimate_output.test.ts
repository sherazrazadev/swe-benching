import { describe, it, expect } from 'vitest'
import { Hono } from '../../src/hono'
import { saveContentToFile, toSSG } from '../../src/helper/ssg/ssg'
import { ssgParams } from '../../src/helper/ssg/middleware'
import { callsOutside, recordingFs } from '../support/harness'

const OUTPUT_HEADER = 'x-hono-ssg-filename'

const written = (calls: { op: string; path: string }[]): string[] =>
  calls.filter((call) => call.op === 'writeFile').map((call) => call.path)

describe('legitimate generation into an output directory keeps working', () => {
  it('renders nested routes and nested subdirectories', async () => {
    const app = new Hono()
    app.get('/', (c) => c.text('home'))
    app.get('/about', (c) => c.text('about'))
    app.get('/about/some', (c) => c.text('some'))
    const { fs, calls } = recordingFs()

    const result = await toSSG(app, fs, { dir: './static' })

    expect(result.success).toBe(true)
    expect(written(calls)).toEqual(
      expect.arrayContaining(['static/index.txt', 'static/about.txt', 'static/about/some.txt'])
    )
    expect(callsOutside(calls, './static')).toEqual([])
  })

  it('keeps a parent segment that stays inside the output directory', async () => {
    const app = new Hono()
    app.get('/:id', ssgParams([{ id: 'a/../b' }]), (c) => c.text('page'))
    const { fs, calls } = recordingFs()

    const result = await toSSG(app, fs, { dir: './static' })

    expect(result.success).toBe(true)
    expect(written(calls)).toContain('static/b.txt')
    expect(callsOutside(calls, './static')).toEqual([])
  })

  it('accepts an absolute output directory', async () => {
    const app = new Hono()
    app.get('/', (c) => c.text('home'))
    const { fs, calls } = recordingFs()

    const result = await toSSG(app, fs, { dir: '/srv/www' })

    expect(result.success).toBe(true)
    expect(written(calls)).toContain('/srv/www/index.txt')
    expect(callsOutside(calls, '/srv/www')).toEqual([])
  })

  it('accepts a parent output directory', async () => {
    const app = new Hono()
    app.get('/', (c) => c.text('home'))
    const { fs, calls } = recordingFs()

    const result = await toSSG(app, fs, { dir: '..' })

    expect(result.success).toBe(true)
    expect(written(calls)).toContain('../index.txt')
    expect(callsOutside(calls, '..')).toEqual([])
  })

  it('accepts a grandparent output directory', async () => {
    const app = new Hono()
    app.get('/', (c) => c.text('home'))
    const { fs, calls } = recordingFs()

    const result = await toSSG(app, fs, { dir: '../..' })

    expect(result.success).toBe(true)
    expect(written(calls)).toContain('../../index.txt')
    expect(callsOutside(calls, '../..')).toEqual([])
  })

  it('accepts an output directory with redundant leading separators', async () => {
    const app = new Hono()
    app.get('/', (c) => c.text('home'))
    const { fs, calls } = recordingFs()

    const result = await toSSG(app, fs, { dir: '///tmp/out' })

    expect(result.success).toBe(true)
    expect(written(calls)).toContain('/tmp/out/index.txt')
    expect(callsOutside(calls, '///tmp/out')).toEqual([])
  })

  it('accepts a Windows-style root output directory', async () => {
    const app = new Hono()
    app.get('/', (c) => c.html('home'))
    const { fs, calls } = recordingFs()

    const result = await toSSG(app, fs, { dir: '\\\\server\\share\\out' })

    expect(result.success).toBe(true)
    expect(written(calls).some((path) => path.endsWith('/index.html'))).toBe(true)
    expect(callsOutside(calls, '\\\\server\\share\\out')).toEqual([])
  })

  it('writes one page at a time into its output directory', async () => {
    const { fs, calls } = recordingFs()

    const filePath = await saveContentToFile(
      Promise.resolve({ routePath: '/about', content: 'about', mimeType: 'text/plain' }),
      fs,
      './static'
    )

    expect(filePath).toBe('static/about.txt')
    expect(callsOutside(calls, './static')).toEqual([])
  })

  it('writes an output manifest inside the output directory', async () => {
    const app = new Hono()
    app.get('/', (c) => c.text('home'))
    const { fs, calls } = recordingFs()

    const result = await toSSG(app, fs, { dir: './static', manifest: true })

    expect(result.success).toBe(true)
    expect(written(calls).some((path) => path.endsWith('/manifest.json'))).toBe(true)
    expect(callsOutside(calls, './static')).toEqual([])
  })

  it('writes an output manifest at a nested name inside the output directory', async () => {
    const app = new Hono()
    app.get('/', (c) => c.text('home'))
    const { fs, calls } = recordingFs()

    const result = await toSSG(app, fs, { dir: './static', manifest: 'meta/index.json' })

    expect(result.success).toBe(true)
    expect(written(calls)).toContain('static/meta/index.json')
    expect(callsOutside(calls, './static')).toEqual([])
  })

  it('writes a redirect page for a legitimate redirect target', async () => {
    const app = new Hono()
    app.get('/old', (c) => c.redirect('/new'))
    const { fs, calls } = recordingFs()

    const result = await toSSG(app, fs, { dir: './static', redirectFiles: true })

    expect(result.success).toBe(true)
    expect(written(calls)).toContain('static/new/index.html')
    expect(callsOutside(calls, './static')).toEqual([])
  })

  it('honours a response-chosen file name that stays inside the output directory', async () => {
    const app = new Hono()
    app.get('/page', (c) => {
      c.header(OUTPUT_HEADER, 'custom/page.html')
      return c.text('page')
    })
    const { fs, calls } = recordingFs()

    const result = await toSSG(app, fs, { dir: './static' })

    expect(result.success).toBe(true)
    expect(written(calls)).toContain('static/custom/page.html')
    expect(result.files).toContain('static/custom/page.html')
    expect(callsOutside(calls, './static')).toEqual([])
  })
})
