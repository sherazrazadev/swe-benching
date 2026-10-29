/*
 * Security cases: values carried in an application's event-log record must be shown by the
 * history page as literal text, never interpreted as markup. Each case drives the real page
 * module in a jsdom document with the project's own vendored jQuery/DataTables/Mustache; the
 * only stubbed surface is the HTTP responses that carry the application record and the page
 * template (the submitted template file is served).
 */
import {
  application, attempt, cell, assertInert, assertRowInert, assertShownAsText,
  renderPage, rowForId, rowForName,
} from '../support/harness.mjs';

const IMG = '<img src=x onerror=alert(1)>';
const ATTR = '" onmouseover="alert(1)';

function caseDef(id, name, apps, run) {
  return { id, classname: 'security/' + id, name, apps, run };
}

export const cases = [
  caseDef(
    'app-name-short',
    'a short application name is shown as text',
    [application('application_1700000000000_0001', 'etl-' + IMG, [attempt('1', 'alice', '3.5.0')])],
    (page) => {
      const td = cell(page, rowForId(page, 'application_1700000000000_0001'), 'App Name');
      assertInert(td, 'app-name-short');
      assertShownAsText(td, 'etl-' + IMG, 'app-name-short');
    }),

  caseDef(
    'app-name-long-details',
    'a long application name is shown as text, including in its expanded details',
    [application('application_1700000000000_0002',
      'A'.repeat(70) + IMG + ' tail', [attempt('1', 'alice', '3.5.0')])],
    (page) => {
      const full = 'A'.repeat(70) + IMG + ' tail';
      const td = cell(page, rowForId(page, 'application_1700000000000_0002'), 'App Name');
      assertInert(td, 'app-name-long-details');
      assertShownAsText(td, full, 'app-name-long-details');
      const pre = td.querySelector('pre');
      if (pre) {
        if (pre.children.length !== 0) {
          throw new Error('app-name-long-details: the expanded details contain live elements');
        }
        assertShownAsText(pre, full, 'app-name-long-details pre');
      }
    }),

  caseDef(
    'app-name-download-title',
    'an application name cannot break out of the download link text',
    [application('application_1700000000000_0003', 'x' + ATTR, [attempt('1', 'alice', '3.5.0')])],
    (page) => {
      const td = cell(page, rowForId(page, 'application_1700000000000_0003'), 'Event Log');
      assertInert(td, 'app-name-download-title');
      const a = td.querySelector('a');
      if (!a) throw new Error('app-name-download-title: the download link is gone');
      const title = a.getAttribute('title') || '';
      const want = 'Download the event log for x' + ATTR;
      if (title !== want) {
        throw new Error('app-name-download-title: the tooltip shows ' + JSON.stringify(title) +
          ', expected ' + JSON.stringify(want));
      }
    }),

  caseDef(
    'app-name-notice',
    'an application name cannot create markup in the multiple-attempt notice',
    [application('application_1700000000000_0004', 'etl-' + IMG,
      [attempt('1', 'alice', '3.5.0'), attempt('2', 'alice', '3.5.0')])],
    (page) => {
      const notice = page.document.querySelector('#history-notice');
      if (!notice) throw new Error('app-name-notice: the multiple-attempt notice is gone');
      assertInert(notice, 'app-name-notice');
      assertShownAsText(notice, 'etl-' + IMG, 'app-name-notice');
    }),

  caseDef(
    'spark-user',
    'the application user is shown as text',
    [application('application_1700000000000_0005', 'etl', [attempt('1', 'user-' + IMG, '3.5.0')])],
    (page) => {
      const td = cell(page, rowForId(page, 'application_1700000000000_0005'), 'Spark User');
      assertInert(td, 'spark-user');
      assertShownAsText(td, 'user-' + IMG, 'spark-user');
    }),

  caseDef(
    'version',
    'the application version is shown as text',
    [application('application_1700000000000_0006', 'etl',
      [attempt('1', 'alice', '3.5.0-' + IMG)])],
    (page) => {
      const td = cell(page, rowForId(page, 'application_1700000000000_0006'), 'Version');
      assertInert(td, 'version');
      assertShownAsText(td, '3.5.0-' + IMG, 'version');
    }),

  caseDef(
    'app-id-attribute',
    'an application id cannot break out of a rendered attribute',
    [application('application_1700000000000_0007' + ATTR, 'etl',
      [attempt('1', 'alice', '3.5.0'), attempt('2', 'alice', '3.5.0')])],
    (page) => {
      const id = 'application_1700000000000_0007' + ATTR;
      const row = rowForName(page, 'etl');
      assertRowInert(row, 'app-id-attribute');
      assertShownAsText(cell(page, row, 'App ID'), id, 'app-id-attribute');
      assertInert(cell(page, row, 'Event Log'), 'app-id-attribute download');
    }),

  caseDef(
    'app-id-element',
    'an application id cannot create an element in the table',
    [application('application_' + IMG + '_0008', 'etl', [attempt('1', 'alice', '3.5.0')])],
    (page) => {
      const id = 'application_' + IMG + '_0008';
      const row = rowForName(page, 'etl');
      assertRowInert(row, 'app-id-element');
      assertShownAsText(cell(page, row, 'App ID'), id, 'app-id-element');
    }),

  caseDef(
    'attempt-id-attribute',
    'an attempt id cannot break out of a rendered attribute',
    [application('application_1700000000000_0009', 'etl',
      [attempt('1' + ATTR, 'alice', '3.5.0'), attempt('1' + ATTR, 'alice', '3.5.0')])],
    (page) => {
      const value = '1' + ATTR;
      const row = rowForName(page, 'etl');
      assertRowInert(row, 'attempt-id-attribute');
      assertShownAsText(cell(page, row, 'Attempt ID'), value, 'attempt-id-attribute');
    }),

  caseDef(
    'attempt-id-element',
    'an attempt id cannot create an element in the table',
    [application('application_1700000000000_0010', 'etl',
      [attempt(IMG, 'alice', '3.5.0'), attempt(IMG, 'alice', '3.5.0')])],
    (page) => {
      const row = rowForName(page, 'etl');
      assertRowInert(row, 'attempt-id-element');
      assertShownAsText(cell(page, row, 'Attempt ID'), IMG, 'attempt-id-element');
    }),
];

export default cases;
