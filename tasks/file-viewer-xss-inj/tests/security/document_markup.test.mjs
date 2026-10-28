import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  setupDom, parseFragment, loadDoc, loadWord, render, APP_DIR,
  paragraph, textInline, imageInline, attachmentInline, imageAsset, attachmentAsset, attachmentsBlock,
  activeAnchors, eventHandlerAttributes, documentWithLinks, toArrayBuffer, emptyContext,
} from '../support/helpers.mjs'

setupDom()
const doc = await loadDoc()

const JAVASCRIPT = "javascript:document.title='pwn'"
const JAVASCRIPT_MIXED = "JaVa\nScRiPt:document.title='pwn'"

function cell(id, inlines) {
  return {
    id,
    paragraphs: [paragraph(inlines)],
    meta: { width: 2400 },
    colIndex: 0,
  }
}

function table(inlines) {
  return {
    type: 'table',
    id: 'table-1',
    depth: 1,
    gridWidthTwips: 2400,
    state: {},
    rows: [{ id: 'row-1', cells: [cell('cell-1', inlines)], state: {}, gridWidthTwips: 2400 }],
  }
}

test('a document link with a script target is not rendered as an active link', () => {
  const html = render(doc.renderMsDoc, [paragraph([textInline('see this', { href: JAVASCRIPT })])]).html
  assert.equal(html.includes('href="javascript:'), false, html)
})

test('a mixed-case, whitespace-obfuscated script target is not rendered as an active link', () => {
  const html = render(doc.renderMsDoc, [paragraph([textInline('see this', { href: JAVASCRIPT_MIXED })])]).html
  assert.equal(html.includes('href="JaVa'), false, html)
})

test('a script target is blocked even when external links are allowed', () => {
  const html = render(
    doc.renderMsDoc,
    [paragraph([textInline('see this', { href: JAVASCRIPT })])],
    { externalLinkPolicy: 'allow' },
  ).html
  assert.equal(html.includes('href="javascript:'), false, html)
})

test('a linked image cannot carry a script target', () => {
  const html = render(doc.renderMsDoc, [paragraph([
    imageInline(imageAsset(), { href: JAVASCRIPT }),
  ])]).html
  assert.equal(html.includes('href="javascript:'), false, html)
})

test('a hyperlink inside a table cell is treated like any other document link', () => {
  const html = render(doc.renderMsDoc, [table([textInline('cell link', { href: JAVASCRIPT })])]).html
  assert.equal(html.includes('href="javascript:'), false, html)
})

test('an undisplayable image does not become a document-typed data link', () => {
  const html = render(doc.renderMsDoc, [paragraph([
    imageInline(imageAsset({ displayable: false, dataUrl: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' })),
  ])]).html
  assert.equal(/href="data:text\/html/i.test(html), false, html)
})

test('an inline attachment does not become a script-bearing data link', () => {
  const html = render(doc.renderMsDoc, [paragraph([
    attachmentInline(attachmentAsset({ dataUrl: 'data:application/javascript;base64,YWxlcnQoMSk=' })),
  ])]).html
  assert.equal(/href="data:application\/javascript/i.test(html), false, html)
})

test('the trailing attachments block does not offer executable content', () => {
  const html = render(doc.renderMsDoc, [attachmentsBlock([
    attachmentAsset({ name: 'report.svg', mime: 'image/svg+xml', dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+' }),
    attachmentAsset({ name: 'report.html', mime: 'text/html', dataUrl: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' }),
  ])]).html
  assert.equal(/href="data:(?:image\/svg|text\/html)/i.test(html), false, html)
})

test('a font name cannot break out of the style attribute', () => {
  const html = render(doc.renderMsDoc, [paragraph([
    textInline('styled', { style: { underline: 0, fontFamily: `Safe" onmouseover="document.title='pwn'` } }),
  ])]).html
  const host = parseFragment({ window: globalThis.window }, html)
  assert.deepEqual(eventHandlerAttributes(host), [])
})

test('a linked-picture target from the document is not an active link', () => {
  const html = render(doc.renderMsDoc, [paragraph([
    imageInline(imageAsset({
      displayable: false,
      dataUrl: '',
      sourceUrl: '',
      meta: { linkedPath: JAVASCRIPT, sourceKind: 'linked' },
    })),
  ])]).html
  assert.equal(html.includes('href="javascript:'), false, html)
})

test('a document style name cannot break out of its attribute', () => {
  const styleName = `Normal" onmouseover="document.title='pwn'`
  const html = render(doc.renderMsDoc, [paragraph([textInline('styled')], { styleName })]).html
  const host = parseFragment({ window: globalThis.window }, html)
  assert.deepEqual(eventHandlerAttributes(host), [])
})

test('mounting a rendered document adds no active link', () => {
  const host = globalThis.document.getElementById('host')
  const rendered = render(doc.renderMsDoc, [paragraph([textInline('go', { href: JAVASCRIPT })])])
  doc.mountMsDoc(host, rendered)
  assert.deepEqual(activeAnchors(host), [])
})

test('the viewer helper mounts without adding an active link', () => {
  const host = globalThis.document.createElement('div')
  globalThis.document.body.append(host)
  const rendered = render(doc.renderMsDoc, [paragraph([textInline('go', { href: JAVASCRIPT })])])
  const viewer = doc.createMsDocViewer(host)
  viewer.mount(rendered)
  try {
    assert.deepEqual(activeAnchors(host), [])
  } finally {
    viewer.destroy()
  }
})

test('a crafted document parsed and rendered in one step has no active link', async () => {
  const rendered = await doc.parseMsDocToHtml(toArrayBuffer(documentWithLinks([JAVASCRIPT, JAVASCRIPT_MIXED])))
  const host = parseFragment({ window: globalThis.window }, rendered.html)
  assert.deepEqual(activeAnchors(host), [])
})

test('the worker render message applies the same protection to a pre-parsed document', async () => {
  const posted = []
  const listeners = []
  globalThis.self = {
    addEventListener(type, handler) {
      if (type === 'message') listeners.push(handler)
    },
    postMessage(message) {
      posted.push(message)
    },
  }
  await import(pathToFileURL(join(APP_DIR, 'packages/renderers/doc/dist/worker.js')).href)
  const parsed = render(doc.renderMsDoc, [paragraph([textInline('go', { href: JAVASCRIPT })])]).parsed
  for (const handler of listeners) {
    handler({ data: { id: 7, type: 'render', parsed, options: {} } })
  }
  assert.equal(posted.length, 1, JSON.stringify(posted))
  assert.equal(posted[0].ok, true, JSON.stringify(posted[0]))
  assert.equal(posted[0].result.html.includes('href="javascript:'), false, posted[0].result.html)
})

test('the Word renderer mounts a crafted document without active links', async () => {
  const word = await loadWord()
  const host = globalThis.document.createElement('div')
  globalThis.document.body.append(host)
  const buffer = toArrayBuffer(documentWithLinks([JAVASCRIPT, JAVASCRIPT_MIXED]))
  const wrapper = await word.renderFileViewerWordDoc(buffer, host, 'doc', emptyContext())
  try {
    assert.deepEqual(activeAnchors(host), [])
  } finally {
    wrapper.unmount()
  }
})

test('the Word renderer does not export crafted document links as active links', async () => {
  const word = await loadWord()
  const host = globalThis.document.createElement('div')
  globalThis.document.body.append(host)
  let adapter = null
  const buffer = toArrayBuffer(documentWithLinks([JAVASCRIPT, JAVASCRIPT_MIXED]))
  const wrapper = await word.renderFileViewerWordDoc(buffer, host, 'doc', emptyContext({
    registerExportAdapter(value) { adapter = value },
  }))
  try {
    assert.ok(adapter && typeof adapter.toHtml === 'function')
    const exported = adapter.toHtml()
    const exportedHost = parseFragment({ window: globalThis.window }, exported)
    assert.deepEqual(activeAnchors(exportedHost), [])
  } finally {
    wrapper.unmount()
  }
})
