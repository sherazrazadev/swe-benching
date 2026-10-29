/*
 * Hidden-test harness for the Spark history page.
 *
 * The product entry point is the real page module
 * (core/src/main/resources/org/apache/spark/ui/static/historypage.js): it is imported as an ES
 * module into a jsdom document, with the project's own vendored jQuery, DataTables and Mustache
 * (copied from the same pinned tree) bound to that document.  Only the two HTTP calls the page
 * makes are answered locally: the applications listing (the data under test) and the page
 * template, which is read from the submitted tree.  Everything downstream - the DataTables
 * column configuration, its render functions, the sort plug-ins, the template rendering and the
 * produced DOM - is the product's own code.
 *
 * Expected values are written out in the cases; no product code computes them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VENDOR = path.join(HERE, 'vendor');
const PRODUCT = process.env.PRODUCT_ENTRY ||
  '/workspace/core/src/main/resources/org/apache/spark/ui/static/historypage.js';
export const UIROOT = 'http://localhost:18080';

const vendor = (name) => fs.readFileSync(path.join(VENDOR, name), 'utf8');
const jqueryJs = vendor('jquery.min.js');
const dataTablesJs = vendor('jquery.dataTables.min.js');
const rowsGroupJs = vendor('dataTables.rowsGroup.js');
const mustacheJs = vendor('jquery.mustache.js');
const TEMPLATE = process.env.PRODUCT_TEMPLATE ||
  '/workspace/core/src/main/resources/org/apache/spark/ui/static/historypage-template.html';
const templateHtml = fs.readFileSync(TEMPLATE, 'utf8');


const DANGEROUS = new Set([
  'SCRIPT', 'IMG', 'IFRAME', 'FRAME', 'FRAMESET', 'OBJECT', 'EMBED', 'APPLET', 'SVG', 'MATH',
  'STYLE', 'LINK', 'META', 'BASE', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'OPTION',
  'VIDEO', 'AUDIO', 'SOURCE', 'TRACK', 'CANVAS', 'TEMPLATE',
]);
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href', 'poster', 'srcset']);

let seq = 0;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Import the product page into a fresh jsdom document and let it draw the table for `apps`.
 * Returns the document handle once the table has rows.
 */
export async function renderPage(apps) {
  const dom = new JSDOM(
    '<!doctype html><html><head></head><body>' +
    '<div id="before-history"></div><div id="history-summary"></div>' +
    '</body></html>',
    { url: UIROOT + '/history/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.__alerts = [];
  w.alert = (x) => { w.__alerts.push(String(x)); };

  w.eval(jqueryJs);
  w.eval(dataTablesJs);
  w.eval(rowsGroupJs);
  w.eval(mustacheJs);
  const $ = w.jQuery;
  if (!$) throw new Error('the vendored jQuery did not load');
  if (!$.fn.dataTable) throw new Error('the vendored DataTables did not load');
  if (!$.fn.dataTableExt || !$.fn.dataTableExt.oSort) {
    throw new Error('the vendored DataTables did not expose its sort registry');
  }
  if (!w.Mustache) throw new Error('the vendored Mustache did not load');

  $.blockUI = () => {};
  $.unblockUI = () => {};
  $.fn.tooltip = function () { return this; };
  $.getJSON = (_url, _data, callback) => { callback(clone(apps), 'success', {}); };
  $.get = (_url, callback) => { callback(templateHtml); };

  globalThis.window = w;
  globalThis.document = w.document;
  globalThis.jQuery = $;
  globalThis.$ = $;
  globalThis.Mustache = w.Mustache;
  globalThis.uiRoot = UIROOT;

  let importError = null;
  try {
    await import(pathToFileURL(PRODUCT).href + '?case=' + (++seq));
  } catch (e) {
    importError = e;
  }

  const deadline = Date.now() + 8000;
  let table = null;
  while (Date.now() < deadline) {
    table = w.document.querySelector('#history-summary-table');
    if (table && table.querySelector('tbody tr')) break;
    await new Promise((r) => setTimeout(r, 20));
  }
  if (importError) throw new Error('the page failed to load: ' + (importError && importError.message));
  if (!table) throw new Error('the page produced no history table');

  return { window: w, $, table, dom, container: w.document.querySelector('#history-summary'),
    document: w.document, alerts: w.__alerts };
}

export function closePage(page) {
  try { page.window.close(); } catch (_ignored) { /* already closed */ }
}

export function rows(page) {
  return Array.from(page.table.querySelectorAll('tbody tr'));
}

export function cellIndex(page, headerText) {
  const headers = Array.from(page.table.querySelectorAll('thead th'));
  const i = headers.findIndex((th) => th.textContent.trim() === headerText);
  if (i < 0) throw new Error('no "' + headerText + '" column (headers: ' +
    headers.map((th) => th.textContent.trim()).join(', ') + ')');
  return i;
}

export function cell(page, row, headerText) {
  const i = cellIndex(page, headerText);
  const td = row.children[i];
  if (!td) throw new Error('row has no cell for column "' + headerText + '"');
  return td;
}

/** The first row whose App Name cell shows exactly `name`. */
export function rowForName(page, name) {
  const i = cellIndex(page, 'App Name');
  for (const row of rows(page)) {
    if (row.children[i] && row.children[i].textContent === name) return row;
  }
  throw new Error('no row for application name ' + JSON.stringify(name) +
    ' (names: ' + JSON.stringify(rows(page).map((r) => r.children[i] && r.children[i].textContent)) + ')');
}

/** The row whose App ID cell shows exactly `id`. */
export function rowForId(page, id) {
  const i = cellIndex(page, 'App ID');
  for (const row of rows(page)) {
    if (row.children[i] && row.children[i].textContent === id) return row;
  }
  throw new Error('no row for application id ' + JSON.stringify(id) +
    ' (ids: ' + JSON.stringify(rows(page).map((r) => r.children[i] && r.children[i].textContent)) + ')');
}

/**
 * Assert that nothing inside `td` was created as live markup: no active element and no event
 * handler (the page's own expand-details handler is the only one allowed), and no script URL.
 */
export function assertInert(td, label) {
  for (const el of td.querySelectorAll('*')) {
    if (DANGEROUS.has(el.tagName)) {
      throw new Error(label + ': the value created a live <' + el.tagName.toLowerCase() + '> element');
    }
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name)) {
        // The page's own details expander carries an inline handler; tolerate that one and any
        // rewrite of it, but not a handler that came from a displayed value.
        const own = el.tagName === 'SPAN' && el.classList.contains('expand-details') &&
          attr.name === 'onclick' && /stacktrace-details/.test(attr.value);
        if (!own) {
          throw new Error(label + ': the value created the event-handler attribute "' +
            attr.name + '"="' + attr.value.slice(0, 80) + '"');
        }
      }
      if (URL_ATTRS.has(attr.name.toLowerCase())) {
        const v = attr.value.replace(/[\u0000- ]+/g, '').toLowerCase();
        if (v.startsWith('javascript:') || v.startsWith('vbscript:') ||
            v.startsWith('data:text/html')) {
          throw new Error(label + ': the value created a script address in "' + attr.name + '"');
        }
      }
    }
  }
}

/** Assert the value is visible as literal text (escaping, not stripping or rewriting). */
export function assertShownAsText(td, value, label) {
  if (!td.textContent.includes(value)) {
    throw new Error(label + ': the value is not shown as literal text; got ' +
      JSON.stringify(td.textContent.slice(0, 160)));
  }
}

/** Assert the whole row carries no live markup (every cell). */
export function assertRowInert(row, label) {
  Array.from(row.children).forEach((td, i) => assertInert(td, label + ' cell ' + i));
}

/** One application attempt, as the listing API returns it. */
export function attempt(attemptId, sparkUser, appSparkVersion, durationMs) {
  return {
    attemptId,
    sparkUser,
    appSparkVersion,
    completed: true,
    startTimeEpoch: 1700000000000,
    endTimeEpoch: 1700000100000,
    lastUpdatedEpoch: 1700000100000,
    duration: durationMs === undefined ? 100000 : durationMs,
  };
}

/** One application with one or more attempts. */
export function application(id, name, attempts) {
  return { id, name, attempts };
}
