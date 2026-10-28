import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'

const here = dirname(fileURLToPath(import.meta.url))
export const APP_DIR = process.env.APP_DIR || '/workspace'
export const FIXTURE = join(here, 'image-linked.doc')

const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
export const SAFE_IMAGE = PIXEL

/** A DOM the product can mount into. Installing globals mirrors a browser page. */
export function setupDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>', {
    pretendToBeVisual: true,
    url: 'https://viewer.example/doc',
  })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.DOMParser = dom.window.DOMParser
  globalThis.Node = dom.window.Node
  globalThis.Element = dom.window.Element
  globalThis.HTMLElement = dom.window.HTMLElement
  return dom
}

/** A detached element with the given markup, for inspection without a live page. */
export function parseFragment(dom, html) {
  const host = dom.window.document.createElement('div')
  host.innerHTML = html
  return host
}

let docModule
export async function loadDoc() {
  docModule ??= await import(pathToFileURL(join(APP_DIR, 'packages/renderers/doc/dist/index.js')).href)
  return docModule
}

let wordModule
export async function loadWord() {
  wordModule ??= await import(pathToFileURL(join(APP_DIR, 'packages/renderers/word/dist/index.js')).href)
  return wordModule
}

function baseDoc(blocks) {
  return {
    kind: 'msdoc',
    version: 1,
    warnings: [],
    meta: {
      fib: { wIdent: 0, nFib: 0, fWhichTblStm: 0, fComplex: false, fEncrypted: false, ccpText: 1 },
      counts: { paragraphs: 0, blocks: blocks.length, assets: 0, styles: 0, fonts: 0 },
    },
    fonts: [],
    styles: [],
    blocks,
    assets: [],
  }
}

export function charStyle(overrides = {}) {
  return { underline: 0, hidden: false, ...overrides }
}

export function textInline(text, overrides = {}) {
  return { type: 'text', text, style: charStyle(), ...overrides }
}

export function imageInline(asset, overrides = {}) {
  return { type: 'image', asset, style: charStyle(), ...overrides }
}

export function attachmentInline(asset, overrides = {}) {
  return { type: 'attachment', asset, style: charStyle(), ...overrides }
}

export function imageAsset(overrides = {}) {
  return {
    id: 'image-1',
    type: 'image',
    mime: 'image/gif',
    bytes: new Uint8Array([0]),
    dataUrl: PIXEL,
    displayable: true,
    meta: {},
    ...overrides,
  }
}

export function attachmentAsset(overrides = {}) {
  return {
    id: 'attachment-1',
    type: 'attachment',
    name: 'notes.bin',
    mime: 'application/octet-stream',
    bytes: new Uint8Array([0]),
    dataUrl: 'data:application/octet-stream;base64,AA==',
    meta: {},
    ...overrides,
  }
}

export function paragraph(inlines, overrides = {}) {
  return {
    type: 'paragraph',
    id: 'para-1',
    styleId: 0,
    styleName: 'Normal',
    paraState: {},
    inlines,
    text: inlines.map(node => (typeof node.text === 'string' ? node.text : '')).join(''),
    ...overrides,
  }
}

export function attachmentsBlock(items) {
  return { type: 'attachments', id: 'attachments-1', items }
}

export function parsed(blocks) {
  return baseDoc(blocks)
}

export function render(renderMsDoc, blocks, options = {}) {
  return renderMsDoc(baseDoc(blocks), options)
}

/** Remove the whitespace and control characters a browser ignores inside a URL. */
export function normalizeUrl(value) {
  return String(value ?? '').replace(/[\u0000- \u007f-\u009f]/g, '')
}

const ACTIVE_SCHEME = /^(?:javascript|vbscript|file|blob):/i
const ACTIVE_DATA = /^data:(?!image\/(?:png|gif|jpe?g|webp|bmp|x-icon)[;,])/i

/** True when an href is script-capable, local-file, or a document/script data URL. */
export function isActiveHref(value) {
  const href = normalizeUrl(value)
  if (!href) return false
  if (href.startsWith('//') || href.startsWith('\\\\') || href.startsWith('\\')) return true
  if (ACTIVE_SCHEME.test(href)) return true
  if (ACTIVE_DATA.test(href)) return true
  return false
}

/** Anchors carrying an active destination, as {href, className}. */
export function activeAnchors(root) {
  return Array.from(root.querySelectorAll('a[href]'))
    .map(link => ({ href: link.getAttribute('href') || '', className: link.getAttribute('class') || '' }))
    .filter(entry => isActiveHref(entry.href))
}

export function eventHandlerAttributes(root) {
  const found = []
  for (const element of root.querySelectorAll('*')) {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name)) {
        found.push(`${element.tagName.toLowerCase()}[${attribute.name}]`)
      }
    }
  }
  return found
}

export function htmlHasEventHandler(html, name) {
  return new RegExp(`\\b${name}\\s*=`, 'i').test(html)
}

const utf16 = value => Buffer.from(String(value), 'utf16le')

/**
 * Rewrite the two INCLUDEPICTURE field instructions inside the linked-picture
 * fixture into HYPERLINK fields with the requested targets, keeping byte length.
 */
export function documentWithLinks(targets) {
  const bytes = Buffer.from(readFileSync(FIXTURE))
  const needle = utf16('INCLUDEPICTURE')
  const positions = []
  let from = 0
  while (true) {
    const index = bytes.indexOf(needle, from)
    if (index < 0) break
    positions.push(index)
    from = index + needle.length
  }
  const list = targets.slice(0, positions.length)
  positions.forEach((position, index) => {
    let start = position
    while (start > 0 && !(bytes[start] === 0x13 && bytes[start + 1] === 0x00)) start -= 2
    let end = position
    while (end < bytes.length && !(bytes[end] === 0x14 && bytes[end + 1] === 0x00)) end += 2
    const current = bytes.subarray(start + 2, end).toString('utf16le')
    const replacement = ` HYPERLINK "${list[index] ?? '#'}"`
    if (replacement.length > current.length) {
      throw new Error('replacement link target is longer than the reserved field instruction')
    }
    bytes.write(replacement.padEnd(current.length, ' '), start + 2, 'utf16le')
  })
  return bytes
}

export function toArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

export function emptyContext(extra = {}) {
  return {
    registerExportAdapter() {},
    registerThumbnailAdapter() {},
    options: {},
    ...extra,
  }
}
