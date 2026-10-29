'use strict';

const assert = require('node:assert');
const {test} = require('node:test');
const {openScreen} = require('../support/widget');

test('a legitimate result body keeps being shown on hover and cleared on leave', () => {
  const {$, view} = openScreen('source', 'feedback');
  const body = 'Steps to reproduce: open the dashboard.';

  view.handleSearchSuccess({
    items: [
      {
        title: 'An ordinary issue',
        html_url: 'https://github.com/craftcms/cms/issues/2000',
        state: 'open',
        body,
      },
    ],
  });

  const anchor = view.$screen[0].querySelector('.cs-search-results a');
  assert.ok(anchor, 'the result must be rendered');
  $(anchor).trigger('mouseenter');

  const preview = view.$screen[0].querySelector('.cs-result-preview');
  assert.ok(preview, 'hovering a result keeps showing its preview');
  assert.strictEqual(preview.textContent, body);

  view.$searchResults.trigger('mouseleave');
  assert.strictEqual(
    view.$screen[0].querySelector('.cs-result-preview'),
    null,
    'leaving the list keeps removing the preview'
  );
});
