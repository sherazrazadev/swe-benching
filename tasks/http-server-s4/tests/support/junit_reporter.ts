/*
 * JUnit XML reporter for the hidden suites. Japa ships spec/dot/ndjson/github
 * reporters only; the verifier scores from JUnit XML, so collect the test
 * events and write one <testsuite> document to JUNIT_OUT.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { BaseReporter } from '@japa/runner/core'

type Case = {
  classname: string
  name: string
  time: number
  status: 'pass' | 'fail' | 'skip'
  message?: string
  details?: string
}

function escape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
}

export class JunitReporter extends BaseReporter {
  #cases: Case[] = []
  #seen = new Map<string, number>()

  onTestEnd(payload: any) {
    const title = payload.title?.expanded || payload.title?.original || 'test'
    const group = (this as any).currentGroupName || ''
    const file = (this as any).currentFileName || ''
    const error = payload.errors?.[0]?.error
    const classname = group ? `${file} / ${group}` : file

    /*
     * A spec file may define the same test title twice. The scorer keys results
     * by classname and title, so keep every case addressable on its own.
     */
    const key = `${classname}::${title}`
    const seen = this.#seen.get(key) || 0
    this.#seen.set(key, seen + 1)

    this.#cases.push({
      classname,
      name: seen ? `${title} [#${seen + 1}]` : title,
      time: (payload.duration || 0) / 1000,
      status: payload.isSkipped ? 'skip' : error ? 'fail' : 'pass',
      message: error ? String(error.message ?? error).slice(0, 4000) : undefined,
      details: error?.stack ? String(error.stack).slice(0, 12000) : undefined,
    })
  }

  async end() {
    const out = process.env.JUNIT_OUT
    if (!out) {
      return
    }

    const failures = this.#cases.filter((one) => one.status === 'fail').length
    const skipped = this.#cases.filter((one) => one.status === 'skip').length
    const time = this.#cases.reduce((total, one) => total + one.time, 0)
    const body = this.#cases
      .map((one) => {
        const attrs = `classname="${escape(one.classname)}" name="${escape(one.name)}" time="${one.time.toFixed(3)}"`
        if (one.status === 'fail') {
          return `<testcase ${attrs}><failure message="${escape(one.message || 'failed')}">${escape(
            one.details || one.message || 'failed'
          )}</failure></testcase>`
        }
        if (one.status === 'skip') {
          return `<testcase ${attrs}><skipped/></testcase>`
        }
        return `<testcase ${attrs}/>`
      })
      .join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites><testsuite name="hidden" tests="${
      this.#cases.length
    }" failures="${failures}" errors="0" skipped="${skipped}" time="${time.toFixed(
      3
    )}">\n${body}\n</testsuite></testsuites>\n`

    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, xml)

    /*
     * A request handler that throws can leave a keep-alive socket open, and the
     * test server's close() then never resolves. The results are on disk, so do
     * not let a leaked handle keep the grading process alive.
     */
    setTimeout(() => process.exit(0), 20)
  }
}
