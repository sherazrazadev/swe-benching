import test from 'node:test';
import assert from 'node:assert/strict';

import { makeDriver, openServer, htmlViews, renderView } from '../support/harness.mjs';

test('functional: attribute view still displays the exact value', async () => {
  const value = 'Don\'t & "special"';
  const server = await openServer({ driver: makeDriver({ attributes: { text: value } }) });
  try {
    const result = await server.call('appium_get_element_attribute', {
      elementUUID: 'element-1',
      attribute: 'text',
    });
    assert.notEqual(result.isError, true);
    assert.match(result.content[0].text, /^elementId 'element-1'/, 'the text result keeps its first line');

    const views = htmlViews(result).map(renderView);
    const dom = views.find((candidate) => candidate.window.document.querySelector('.attr-value'));
    assert.ok(dom, 'an attribute view must be returned');
    assert.equal(dom.window.document.querySelector('.attr-value').textContent, value);
  } finally {
    await server.close();
  }
});
