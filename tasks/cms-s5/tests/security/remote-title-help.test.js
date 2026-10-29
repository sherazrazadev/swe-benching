'use strict';

const assert = require('node:assert');
const {test} = require('node:test');
const {
  openScreen,
  injectedMarkup,
  executeInjected,
  payload,
} = require('../support/widget');

test('a remote question title cannot become markup in the result list', () => {
  const {w, view} = openScreen('source', 'help');

  view.handleSearchSuccess({
    items: [
      {
        title: payload('cs-pwned'),
        link: 'https://craftcms.stackexchange.com/questions/1/example',
        is_answered: true,
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
