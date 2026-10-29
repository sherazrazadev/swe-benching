'use strict';

const assert = require('node:assert');
const {test} = require('node:test');
const {
  openScreen,
  injectedMarkup,
  executeInjected,
  payload,
} = require('../support/widget');

test('a remote issue title cannot become markup in the result list', () => {
  const {w, view} = openScreen('source', 'feedback');

  view.handleSearchSuccess({
    items: [
      {
        title: payload('cs-pwned'),
        html_url: 'https://github.com/craftcms/cms/issues/1000',
        state: 'open',
        body: 'ordinary body',
      },
    ],
  });

  const root = view.$screen[0];
  executeInjected(root, w);

  assert.strictEqual(w.__csPwned, undefined, 'an injected handler must not run');
  assert.deepStrictEqual(injectedMarkup(root, 'cs-pwned'), {
    marker: false,
    handler: false,
    script: false,
  });
});
