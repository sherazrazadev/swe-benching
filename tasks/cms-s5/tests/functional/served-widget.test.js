'use strict';

const assert = require('node:assert');
const {test} = require('node:test');
const {openScreen} = require('../support/widget');

test('the served widget keeps rendering legitimate results with their link, status and text', () => {
  const {view} = openScreen('served', 'feedback');

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
    ],
  });

  const links = Array.from(
    view.$screen[0].querySelectorAll('.cs-search-results > li > a')
  );
  assert.strictEqual(links.length, 2);

  assert.strictEqual(links[0].getAttribute('href'), 'https://github.com/craftcms/cms/issues/1');
  assert.strictEqual(links[0].querySelector('span.status').getAttribute('class'), 'status green');
  assert.strictEqual(links[0].textContent, 'How do I use & in a title?');

  assert.strictEqual(links[1].getAttribute('href'), 'https://github.com/craftcms/cms/issues/2');
  assert.strictEqual(links[1].querySelector('span.status').getAttribute('class'), 'status red');
  assert.strictEqual(links[1].textContent, 'Comparison: a < b');
});

test('the served widget keeps showing every returned message in full', () => {
  const {view} = openScreen('served', 'feedback');

  view.parseSupportResponse({
    errors: {
      fromEmail: ['Please enter a valid email address.'],
      message: ['Message cannot be blank.', 'Message must be at least 3 characters.'],
    },
  });

  const list = view.$screen[0].querySelector('ul.errors');
  assert.ok(list);
  const messages = Array.from(list.querySelectorAll('li')).map((li) => li.textContent);
  assert.deepStrictEqual(messages, [
    'Please enter a valid email address.',
    'Message cannot be blank.',
    'Message must be at least 3 characters.',
  ]);
});

test('the served widget keeps showing a legitimate result preview', () => {
  const {$, view} = openScreen('served', 'feedback');
  const body = 'Steps to reproduce: open the dashboard.';

  view.handleSearchSuccess({
    items: [
      {
        title: 'An ordinary issue',
        html_url: 'https://github.com/craftcms/cms/issues/2001',
        state: 'open',
        body,
      },
    ],
  });

  const anchor = view.$screen[0].querySelector('.cs-search-results a');
  assert.ok(anchor);
  $(anchor).trigger('mouseenter');

  const preview = view.$screen[0].querySelector('.cs-result-preview');
  assert.ok(preview);
  assert.strictEqual(preview.textContent, body);
});
