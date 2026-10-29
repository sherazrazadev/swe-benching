'use strict';

const assert = require('node:assert');
const {test} = require('node:test');
const {openScreen} = require('../support/widget');

function anchors(root) {
  return Array.from(root.querySelectorAll('.cs-search-results > li > a'));
}

test('legitimate results keep their link, status indicator and visible text', () => {
  const {view} = openScreen('source', 'feedback');

  view.handleSearchSuccess({
    items: [
      {
        title: 'How do I use & in a title?',
        html_url: 'https://github.com/craftcms/cms/issues/1',
        state: 'open',
      },
      {
        title: 'Comparison: a < b',
        html_url: 'https://github.com/craftcms/cms/issues/2',
        state: 'closed',
      },
      {
        title: 'Quotes "double" and \'single\'',
        html_url: 'https://github.com/craftcms/cms/issues/3',
        state: 'open',
      },
    ],
  });

  const links = anchors(view.$screen[0]);
  assert.strictEqual(links.length, 3);

  const expected = [
    ['https://github.com/craftcms/cms/issues/1', 'status green', 'How do I use & in a title?'],
    ['https://github.com/craftcms/cms/issues/2', 'status red', 'Comparison: a < b'],
    ['https://github.com/craftcms/cms/issues/3', 'status green', 'Quotes "double" and \'single\''],
  ];

  links.forEach((a, i) => {
    assert.strictEqual(a.getAttribute('href'), expected[i][0]);
    assert.strictEqual(a.getAttribute('target'), '_blank');
    const status = a.querySelector('span.status');
    assert.ok(status, 'each result keeps its status indicator');
    assert.strictEqual(status.getAttribute('class'), expected[i][1]);
    assert.strictEqual(a.textContent, expected[i][2]);
  });
});

test('an ordinary result next to a hostile one keeps rendering exactly as today', () => {
  const {view} = openScreen('source', 'feedback');

  view.handleSearchSuccess({
    items: [
      {
        title: '<img src="x" onerror="window.__csPwned=1">',
        html_url: 'https://github.com/craftcms/cms/issues/10',
        state: 'open',
      },
      {
        title: 'An ordinary issue title',
        html_url: 'https://github.com/craftcms/cms/issues/11',
        state: 'closed',
      },
    ],
  });

  const links = anchors(view.$screen[0]);
  assert.strictEqual(links.length, 2);

  const ordinary = links[1];
  assert.strictEqual(
    ordinary.getAttribute('href'),
    'https://github.com/craftcms/cms/issues/11'
  );
  assert.strictEqual(ordinary.getAttribute('target'), '_blank');
  const status = ordinary.querySelector('span.status');
  assert.ok(status);
  assert.strictEqual(status.getAttribute('class'), 'status red');
  assert.strictEqual(ordinary.textContent, 'An ordinary issue title');
});

test('the result list keeps its twenty-entry limit and ordering', () => {
  const {view} = openScreen('source', 'help');

  const items = [];
  for (let i = 0; i < 25; i++) {
    items.push({
      title: 'Result ' + i,
      link: 'https://craftcms.stackexchange.com/questions/' + i,
      is_answered: i % 2 === 0,
    });
  }

  view.handleSearchSuccess({items});

  const links = anchors(view.$screen[0]);
  assert.strictEqual(links.length, 20);
  assert.strictEqual(links[0].textContent, 'Result 0');
  assert.strictEqual(links[19].textContent, 'Result 19');
  assert.strictEqual(links[0].getAttribute('href'), items[0].link);
  assert.strictEqual(links[19].getAttribute('href'), items[19].link);
});
