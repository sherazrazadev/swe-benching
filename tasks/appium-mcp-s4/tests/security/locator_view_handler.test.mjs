import test from 'node:test';
import assert from 'node:assert/strict';

import { androidPageSource, makeDriver, openServer, renderAll } from '../support/harness.mjs';

// A page-derived value placed in the JavaScript string of an inline event handler. The
// value is ordinary text as far as HTML entities are concerned; it becomes code only
// because the handler body is JavaScript.
test('locator view keeps a handler-shaped value out of the inline handler', async () => {
  const payload = '${window.__PWN_HANDLER__=1}';
  const server = await openServer({
    driver: makeDriver({ pageSource: androidPageSource({ contentDesc: payload }) }),
  });
  try {
    const result = await server.call('generate_locators');
    assert.notEqual(result.isError, true, 'the tool must still return its result');
    const views = renderAll(result);
    assert.ok(views.length > 0, 'the tool must still return a view');
    for (const dom of views) {
      assert.equal(dom.window.__PWN_HANDLER__, undefined, 'the value ran as code in the view');
    }
    // The value is content, so the locator view must still show it as text.
    const shown = views.some((dom) => dom.window.document.body.textContent.includes(payload));
    assert.ok(shown, 'the value must still be displayed as text');
  } finally {
    await server.close();
  }
});

// A page-derived value whose quotation marks end the HTML attribute that holds it.
test('locator view keeps a quote-breaking value inside its attribute', async () => {
  const payload = 'x" onmouseover="window.__PWN_ATTRHANDLER__=1" y="';
  const server = await openServer({
    driver: makeDriver({ pageSource: androidPageSource({ contentDesc: payload }) }),
  });
  try {
    const result = await server.call('generate_locators');
    assert.notEqual(result.isError, true, 'the tool must still return its result');
    const views = renderAll(result);
    assert.ok(views.length > 0, 'the tool must still return a view');
    for (const dom of views) {
      assert.equal(dom.window.__PWN_ATTRHANDLER__, undefined, 'the value added an event handler to the view');
    }
  } finally {
    await server.close();
  }
});
