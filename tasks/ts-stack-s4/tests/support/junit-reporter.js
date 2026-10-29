'use strict'
const fs = require('fs')

function esc (value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
}

class JunitReporter {
  constructor () { this.cases = [] }

  onTestResult (test, result) {
    const file = (test && test.path) || 'jest'
    for (const t of (result && result.testResults) || []) {
      const ancestors = (t.ancestorTitles || []).join(' > ')
      this.cases.push({
        classname: ancestors || file,
        name: t.title,
        status: t.status,
        failure: (t.failureMessages || []).join('\n')
      })
    }
  }

  onRunComplete () {
    const out = process.env.JUNIT_OUT
    if (!out) return
    const failed = this.cases.filter(c => c.status === 'failed')
    const skipped = this.cases.filter(c => c.status === 'pending' || c.status === 'todo' || c.status === 'skipped')
    const body = this.cases.map(c => {
      const inner = c.status === 'failed'
        ? `<failure message="failed">${esc(c.failure)}</failure>`
        : c.status === 'pending' || c.status === 'todo' || c.status === 'skipped'
          ? '<skipped/>'
          : ''
      return `  <testcase classname="${esc(c.classname)}" name="${esc(c.name)}">${inner}</testcase>`
    }).join('\n')
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      `<testsuite name="jest" tests="${this.cases.length}" failures="${failed.length}" errors="0" skipped="${skipped.length}">\n` +
      body + '\n</testsuite>\n'
    fs.mkdirSync(require('path').dirname(out), { recursive: true })
    fs.writeFileSync(out, xml)
  }
}

module.exports = JunitReporter
