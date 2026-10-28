import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  setupDom, parseFragment, loadDoc, loadWord, render, APP_DIR,
  paragraph, textInline, imageInline, attachmentInline, imageAsset, attachmentAsset, attachmentsBlock,
  documentWithLinks, toArrayBuffer, emptyContext, SAFE_IMAGE,
} from '../support/helpers.mjs'

setupDom()
const doc = await loadDoc()
const word = await loadWord()

test('ordinary web, mail, phone and relative destinations render when external links are allowed', () => {
  const targets = ['https://example.com/docs', 'http://example.com/a', 'mailto:team@example.com', 'tel:+12025550123', '/relative/page', './relative/page', '../relative/page', 'relative/page']
  const html = render(
    doc.renderMsDoc,
    targets.map((href, index) => paragraph([textInline(`link ${index}`, { href })])),
    { externalLinkPolicy: 'allow' },
  ).html
  for (const href of targets) {
    assert.ok(html.includes(`href="${href}"`), `missing ${href} in ${html}`)
  }
})

test('internal bookmarks stay clickable under the default policy', () => {
  const html = render(doc.renderMsDoc, [paragraph([textInline('jump', { href: '#chapter-2' })])]).html
  assert.ok(html.includes('href="#chapter-2"'), html)
})

test('an embedded attachment stays downloadable', () => {
  const html = render(doc.renderMsDoc, [paragraph([
    attachmentInline(attachmentAsset({ dataUrl: 'data:application/octet-stream;base64,AAECAwQ=' })),
  ])]).html
  assert.ok(html.includes('data:application/octet-stream;base64,AAECAwQ='), html)
  assert.ok(html.includes('download="notes.bin"'), html)
})

test('an attachments block keeps ordinary files downloadable', () => {
  const html = render(doc.renderMsDoc, [attachmentsBlock([
    attachmentAsset({ name: 'sheet.csv', mime: 'text/csv', dataUrl: 'data:text/csv;base64,YSxiCg==' }),
  ])]).html
  assert.ok(html.includes('data:text/csv;base64,YSxiCg=='), html)
})

test('inline images still display', () => {
  const html = render(doc.renderMsDoc, [paragraph([
    imageInline(imageAsset()),
    imageInline(imageAsset({ dataUrl: '', sourceUrl: 'https://example.com/pixel.png' })),
  ])]).html
  assert.ok(html.includes(SAFE_IMAGE), html)
  assert.ok(html.includes('https://example.com/pixel.png'), html)
})

test('ordinary font names and style names are preserved', () => {
  const html = render(doc.renderMsDoc, [paragraph([
    textInline('body', { style: { underline: 0, fontFamily: 'Times New Roman' } }),
  ], { styleName: 'Body Text' })]).html
  const host = parseFragment({ window: globalThis.window }, html)
  const span = host.querySelector('span')
  assert.ok(span.getAttribute('style').includes('Times New Roman'), span.getAttribute('style'))
  const para = host.querySelector('p')
  assert.equal(para.getAttribute('data-style'), 'Body Text')
  assert.ok(para.getAttribute('class').includes('msdoc-style-body-text'))
})

test('a linked picture with a safe web location is offered when external links are allowed', () => {
  const html = render(doc.renderMsDoc, [paragraph([
    imageInline(imageAsset({ displayable: false, dataUrl: '', sourceUrl: '', meta: { linkedPath: 'https://example.com/pic.png', sourceKind: 'linked' } })),
  ])], { externalLinkPolicy: 'allow' }).html
  assert.ok(html.includes('href="https://example.com/pic.png"'), html)
})

test('the Word renderer keeps allowed document links clickable', async () => {
  const host = globalThis.document.createElement('div')
  globalThis.document.body.append(host)
  const buffer = toArrayBuffer(documentWithLinks(['https://example.com/docs', '#chapter-2']))
  const wrapper = await word.renderFileViewerWordDoc(buffer, host, 'doc', emptyContext({
    options: { docx: { externalLinkPolicy: 'allow' } },
  }))
  try {
    const hrefs = Array.from(host.querySelectorAll('a[href]')).map(link => link.getAttribute('href'))
    assert.ok(hrefs.includes('https://example.com/docs'), hrefs.join(','))
    assert.ok(hrefs.includes('#chapter-2'), hrefs.join(','))
  } finally {
    wrapper.unmount()
  }
})

test('the Word renderer keeps bookmarks clickable by default', async () => {
  const host = globalThis.document.createElement('div')
  globalThis.document.body.append(host)
  const buffer = toArrayBuffer(documentWithLinks(['#chapter-2', '#chapter-3']))
  const wrapper = await word.renderFileViewerWordDoc(buffer, host, 'doc', emptyContext())
  try {
    const hrefs = Array.from(host.querySelectorAll('a[href]')).map(link => link.getAttribute('href'))
    assert.ok(hrefs.includes('#chapter-2'), hrefs.join(','))
    assert.ok(hrefs.includes('#chapter-3'), hrefs.join(','))
  } finally {
    wrapper.unmount()
  }
})

test('the Word renderer export keeps allowed links', async () => {
  const host = globalThis.document.createElement('div')
  globalThis.document.body.append(host)
  let adapter = null
  const buffer = toArrayBuffer(documentWithLinks(['https://example.com/docs', '#chapter-2']))
  const wrapper = await word.renderFileViewerWordDoc(buffer, host, 'doc', emptyContext({
    options: { docx: { externalLinkPolicy: 'allow' } },
    registerExportAdapter(value) { adapter = value },
  }))
  try {
    const exported = adapter.toHtml()
    const exportedHost = parseFragment({ window: globalThis.window }, exported)
    const hrefs = Array.from(exportedHost.querySelectorAll('a[href]')).map(link => link.getAttribute('href'))
    assert.ok(hrefs.includes('https://example.com/docs'), hrefs.join(','))
  } finally {
    wrapper.unmount()
  }
})

test('the document parser renders an embedded image fixture', async () => {
  const bytes = readFileSync(join(APP_DIR, 'packages/renderers/doc/test/fixtures/image-embedded.doc'))
  const rendered = await doc.parseMsDocToHtml(toArrayBuffer(bytes))
  assert.ok(rendered.html.includes('<img class="msdoc-image"'), rendered.html.slice(0, 300))
})

test('the project document checks pass', () => {
  const packageDir = join(APP_DIR, 'packages/renderers/doc')
  for (const script of ['verify-github-171.mjs', 'verify-github-192.mjs', 'verify-github-34.mjs', 'verify-github-87.mjs', 'verify-table-spec.mjs']) {
    const result = spawnSync(process.execPath, [join(packageDir, 'scripts', script)], {
      cwd: packageDir,
      encoding: 'utf8',
      timeout: 120000,
      env: { PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin', HOME: process.env.HOME || '/tmp' },
    })
    assert.equal(result.status, 0, `${script} failed:\n${result.stdout}\n${result.stderr}`)
  }
})
