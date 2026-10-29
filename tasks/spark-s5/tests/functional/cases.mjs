/*
 * Functional cases: the history page must keep doing what it does today for ordinary values.
 * All of them pass on the pinned code; they exist so an over-broad or feature-removing fix fails.
 * Expected values (text and addresses) are literals here.
 */
import {
  application, attempt, cell, cellIndex, renderPage, rows, rowForId, UIROOT,
} from '../support/harness.mjs';

const ID1 = 'application_1700000000000_0001';
const ID2 = 'application_1700000000000_0002';
const USER = 'alice';
const VERSION = '3.5.0';

function caseDef(id, name, apps, run) {
  return { id, classname: 'functional/' + id, name, apps, run };
}

export const cases = [
  caseDef(
    'ordinary-row',
    'an ordinary application row shows its values and working links',
    [application(ID1, 'Daily ETL & load', [attempt('1', USER, VERSION)])],
    (page) => {
      const row = rowForId(page, ID1);
      const expectText = (header, value) => {
        const got = cell(page, row, header).textContent;
        if (got !== value) {
          throw new Error(header + ' shows ' + JSON.stringify(got) + ', expected ' + JSON.stringify(value));
        }
      };
      expectText('Version', VERSION);
      expectText('App Name', 'Daily ETL & load');
      expectText('Spark User', USER);
      const appLink = cell(page, row, 'App ID').querySelector('a');
      if (!appLink) throw new Error('the App ID cell no longer links to the application');
      const appHref = appLink.getAttribute('href');
      const wantApp = UIROOT + '/history/' + ID1 + '/1/jobs/';
      if (appHref !== wantApp) {
        throw new Error('App ID link is ' + JSON.stringify(appHref) + ', expected ' + JSON.stringify(wantApp));
      }
      const download = cell(page, row, 'Event Log').querySelector('a');
      if (!download) throw new Error('the event-log cell no longer offers a download');
      const logHref = download.getAttribute('href');
      const wantLog = UIROOT + '/api/v1/applications/' + ID1 + '/1/logs';
      if (logHref !== wantLog) {
        throw new Error('download link is ' + JSON.stringify(logHref) + ', expected ' + JSON.stringify(wantLog));
      }
      const wantTitle = 'Download the event log for Daily ETL & load';
      if (download.getAttribute('title') !== wantTitle) {
        throw new Error('download tooltip is ' + JSON.stringify(download.getAttribute('title')) +
          ', expected ' + JSON.stringify(wantTitle));
      }
    }),

  caseDef(
    'multiple-attempts',
    'multi-attempt applications keep one attempt row per attempt with its own links',
    [application(ID1, 'etl', [attempt('1', USER, VERSION), attempt('2', USER, VERSION)])],
    (page) => {
      const table = page.table;
      const attemptIndex = cellIndex(page, 'Attempt ID');
      const all = rows(page);
      if (all.length !== 2) throw new Error('expected 2 attempt rows, got ' + all.length);
      const seen = [];
      for (const row of all) {
        const attemptId = row.children[attemptIndex].textContent;
        seen.push(attemptId);
        const href = row.children[attemptIndex].querySelector('a').getAttribute('href');
        const want = UIROOT + '/history/' + ID1 + '/' + attemptId + '/jobs/';
        if (href !== want) {
          throw new Error('attempt ' + attemptId + ' links to ' + JSON.stringify(href) +
            ', expected ' + JSON.stringify(want));
        }
        const logHref = cell(page, row, 'Event Log').querySelector('a').getAttribute('href');
        const wantLog = UIROOT + '/api/v1/applications/' + ID1 + '/' + attemptId + '/logs';
        if (logHref !== wantLog) {
          throw new Error('attempt ' + attemptId + ' download is ' + JSON.stringify(logHref) +
            ', expected ' + JSON.stringify(wantLog));
        }
      }
      if (seen.sort().join(',') !== '1,2') throw new Error('attempt column shows ' + JSON.stringify(seen));
      const notice = page.document.querySelector('#history-notice');
      if (!notice) throw new Error('the multiple-attempt notice is gone');
      if (!notice.textContent.includes('etl')) {
        throw new Error('the multiple-attempt notice no longer names the application: ' +
          JSON.stringify(notice.textContent));
      }
    }),

  caseDef(
    'long-name-expands',
    'a long name keeps its abbreviation and its complete expanded text',
    [application(ID1, 'A'.repeat(70) + ' R&D pipeline', [attempt('1', USER, VERSION)])],
    (page) => {
      const full = 'A'.repeat(70) + ' R&D pipeline';
      const td = cell(page, rowForId(page, ID1), 'App Name');
      const summary = 'A'.repeat(60) + '...';
      if (!td.textContent.includes(summary)) {
        throw new Error('the abbreviated summary is missing; cell text is ' +
          JSON.stringify(td.textContent.slice(0, 120)));
      }
      const pre = td.querySelector('pre');
      if (!pre) throw new Error('the expanded details lost their container');
      if (pre.textContent !== full) {
        throw new Error('the expanded details show ' + JSON.stringify(pre.textContent) +
          ', expected ' + JSON.stringify(full));
      }
      const expander = td.querySelector('span.expand-details');
      if (!expander) throw new Error('the details expander is gone');
    }),

  caseDef(
    'sort-by-app-id',
    'sorting by application id still orders ordinary ids numerically',
    [application(ID1, 'first', [attempt('1', USER, VERSION)]),
     application(ID2, 'second', [attempt('1', USER, VERSION)])],
    (page) => {
      const api = page.$('#history-summary-table').DataTable();
      const col = cellIndex(page, 'App ID');
      const ids = () => rows(page).map((r) => cell(page, r, 'App ID').textContent);
      api.order([[col, 'asc']]).draw();
      const asc = ids();
      if (asc.join(',') !== [ID1, ID2].join(',')) {
        throw new Error('ascending sort gives ' + JSON.stringify(asc));
      }
      api.order([[col, 'desc']]).draw();
      const desc = ids();
      if (desc.join(',') !== [ID2, ID1].join(',')) {
        throw new Error('descending sort gives ' + JSON.stringify(desc));
      }
    }),
];

export default cases;
