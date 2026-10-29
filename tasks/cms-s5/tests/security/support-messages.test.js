'use strict';

const assert = require('node:assert');
const {test} = require('node:test');
const {
  openScreen,
  injectedMarkup,
  executeInjected,
  payload,
} = require('../support/widget');

test('a message returned by the support request cannot become markup', () => {
  const {w, view} = openScreen('source', 'feedback');

  view.parseSupportResponse({
    errors: {
      fromEmail: [payload('cs-pwned')],
      message: ['ordinary message'],
    },
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
