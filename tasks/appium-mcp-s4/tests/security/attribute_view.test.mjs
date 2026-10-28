import test from 'node:test';
import assert from 'node:assert/strict';

import { makeDriver, openServer, renderAll } from '../support/harness.mjs';

// A value read from an element of the application under test, displayed in its own view.
test('attribute view keeps a quote-breaking value inside its attribute', async () => {
  const payload = 'x" onmouseover="window.__PWN_ATTR_VIEW__=1';
  const server = await openServer({
    driver: makeDriver({ attributes: { text: payload } }),
  });
  try {
    const result = await server.call('appium_get_element_attribute', {
      elementUUID: 'element-1',
      attribute: 'text',
    });
    assert.notEqual(result.isError, true, 'the tool must still return its result');
    const views = renderAll(result);
    assert.ok(views.length > 0, 'the tool must still return a view');
    for (const dom of views) {
      assert.equal(dom.window.__PWN_ATTR_VIEW__, undefined, 'the value added an event handler to the view');
    }
    const shown = views.some((dom) => dom.window.document.body.textContent.includes(payload));
    assert.ok(shown, 'the value must still be displayed as text');
  } finally {
    await server.close();
  }
});
