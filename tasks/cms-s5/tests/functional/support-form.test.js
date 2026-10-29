'use strict';

const assert = require('node:assert');
const {test} = require('node:test');
const {openScreen} = require('../support/widget');

test('every returned message keeps being shown in full', () => {
  const {view} = openScreen('source', 'feedback');

  view.parseSupportResponse({
    errors: {
      fromEmail: ['Please enter a valid email address.'],
      message: [
        'Message cannot be blank.',
        'Message must be at least 3 characters & be plain.',
      ],
    },
  });

  const list = view.$screen[0].querySelector('ul.errors');
  assert.ok(list, 'the widget keeps showing the messages');
  assert.strictEqual(list.parentNode, view.$supportForm[0].parentNode);
  assert.strictEqual(list.previousElementSibling, view.$supportForm[0]);

  const messages = Array.from(list.querySelectorAll('li')).map((li) => li.textContent);
  assert.deepStrictEqual(messages, [
    'Please enter a valid email address.',
    'Message cannot be blank.',
    'Message must be at least 3 characters & be plain.',
  ]);
});

test('a successful support response keeps clearing the form', () => {
  const {w, view} = openScreen('source', 'feedback');

  view.$body.val('A message');
  view.$supportMessage.val('A message');

  view.parseSupportResponse({success: true, errors: []});

  assert.strictEqual(w.__displaySuccess.length, 1);
  assert.strictEqual(view.$body.val(), '');
  assert.strictEqual(view.$supportMessage.val(), '');
  assert.strictEqual(view.$supportAttachment.val(), '');
  assert.strictEqual(view.$supportIframe.html(), '');
});
