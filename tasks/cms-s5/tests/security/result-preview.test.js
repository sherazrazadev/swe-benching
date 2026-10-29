'use strict';

const assert = require('node:assert');
const {test} = require('node:test');
const {
  openScreen,
  injectedMarkup,
  executeInjected,
  payload,
} = require('../support/widget');

test('a remote result body shown on hover cannot become markup', () => {
  const {w, $, view} = openScreen('source', 'feedback');

  view.handleSearchSuccess({
    items: [
      {
        title: 'An ordinary issue',
        html_url: 'https://github.com/craftcms/cms/issues/2000',
        state: 'open',
        body: payload('cs-pwned'),
      },
    ],
  });

  const anchor = view.$screen[0].querySelector('.cs-search-results a');
  if (anchor) {
    $(anchor).trigger('mouseenter');
  }

  const root = view.$screen[0];
  executeInjected(root, w);

  assert.strictEqual(w.__csPwned, undefined, 'an injected handler must not run');
  assert.deepStrictEqual(injectedMarkup(root, 'cs-pwned'), {
    marker: false,
    handler: false,
    script: false,
  });
});
