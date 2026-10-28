import test from 'node:test';
import assert from 'node:assert/strict';

import { androidPageSource, makeDriver, openServer, htmlViews, renderView } from '../support/harness.mjs';

test('functional: page-source view still displays the page source and keeps its controls', async () => {
  const pageSource = androidPageSource({
    tag: 'android.widget.Button',
    text: 'Save and continue',
    contentDesc: 'sign in',
    resourceId: 'com.example:id/btn',
  });
  const server = await openServer({ driver: makeDriver({ pageSource }) });
  try {
    const result = await server.call('appium_get_page_source');
    assert.notEqual(result.isError, true);

    const views = htmlViews(result).map(renderView);
    const dom = views.find((candidate) => candidate.window.document.getElementById('xmlContent'));
    assert.ok(dom, 'a page-source view must be returned');
    const document = dom.window.document;

    const shown = document.getElementById('xmlContent').textContent;
    assert.ok(shown.includes('android.widget.Button'), 'the page source must be displayed');
    assert.ok(shown.includes('Save and continue'), 'the element value must be displayed');
    assert.match(document.querySelector('.info').textContent, /\d+ characters/);

    const searchBox = document.getElementById('searchBox');
    assert.ok(searchBox, 'the search control must still be offered');
    searchBox.value = 'Save';
    searchBox.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    assert.ok(document.getElementById('xmlContent').textContent.includes('Save'));
  } finally {
    await server.close();
  }
});
