'use strict';

const assert = require('node:assert');
const {test} = require('node:test');
const {
  openScreen,
  injectedMarkup,
  executeInjected,
  payload,
} = require('../support/widget');

test('the widget asset that the control panel serves does not render a returned message as markup', () => {
  const {w, view} = openScreen('served', 'feedback');

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
