import { readFileSync } from 'node:fs'

import { parse } from 'parse5'

// The product under test. The default is the restored workspace; the override exists only
// so the builder can run the same suites against scratch checkouts on a host.
export const PRODUCT =
  process.env.SSR_ERROR_PRODUCT || '/workspace/utils/render-ssr-error'

export function makeRequest({ headers = {}, url = '/', method = 'GET' } = {}) {
  return {
    headers,
    url,
    method,
    httpVersion: '1.1',
    socket: {
      encrypted: false,
      remoteAddress: '127.0.0.1',
      remotePort: 41234
    }
  }
}

export async function loadRender() {
  const module = await import(`${PRODUCT}/src/index.js`)
  return module.default
}

export function render(renderSSRError, { err, req, rootFolder = '/workspace' }) {
  return renderSSRError({ err, req, rootFolder })
}

function elementOf(node) {
  return node && node.tagName ? node : null
}

// A structural fingerprint: which elements, attributes and comments the HTML parser
// produces, in order, with every text and attribute value ignored. A request value that
// is carried as inert data cannot change this fingerprint; one that becomes part of the
// document does.
export function structure(html) {
  const out = []

  function walk(node, insideRawText) {
    const tag = node.tagName
    const raw = insideRawText || tag === 'script' || tag === 'style'

    if (node.nodeName === '#comment') {
      out.push('comment')
    }

    if (tag) {
      out.push(`tag:${tag}`)
      if (node.attrs && !raw) {
        out.push(`attrs:${node.attrs.map(attr => attr.name).sort().join(',')}`)
      }
    }

    for (const child of node.childNodes || []) {
      walk(child, raw)
    }
  }

  walk(parse(html), false)
  return out
}

// Text the browser renders to the user (text outside script/style). Values carried inside
// a script or style element are data, not visible text.
export function visibleText(html) {
  const out = []

  function walk(node, insideRawText) {
    const tag = node.tagName
    const raw = insideRawText || tag === 'script' || tag === 'style'

    if (node.nodeName === '#text' && !raw) {
      out.push(node.value)
    }

    for (const child of node.childNodes || []) {
      walk(child, raw)
    }
  }

  walk(parse(html), false)
  return out.join('')
}

export function elements(html) {
  const out = []

  function walk(node) {
    if (elementOf(node)) out.push(node)
    for (const child of node.childNodes || []) walk(child)
  }

  walk(parse(html))
  return out
}

export function attribute(element, name) {
  const found = (element.attrs || []).find(attr => attr.name === name)
  return found ? found.value : null
}

export function scriptTexts(html) {
  return elements(html)
    .filter(element => element.tagName === 'script')
    .map(script => (script.childNodes || []).map(child => child.value || '').join(''))
}

function readAsset(name) {
  return readFileSync(`${PRODUCT}/compiled-assets/${name}-injection`, 'utf8')
}

// The main data block sits between the page's static prefix and static suffix.
export function mainPayload(html) {
  const before = readAsset('before')
  const after = readAsset('after')

  const start = html.indexOf(before)
  if (start < 0) throw new Error('the page does not start with the packaged prefix')
  const end = html.indexOf(after, start + before.length)
  if (end < 0) throw new Error('the page does not contain the packaged suffix')

  return html.slice(start + before.length, end)
}

// Evaluate the embedded data block the way the packaged page does. Callers use it only
// with legitimate values, never with an attack payload.
export function readMainData(html) {
  return new Function(`return (${mainPayload(html)})`)()
}
