import test from 'node:test';
import assert from 'node:assert/strict';

import { androidPageSource, makeDriver, openServer, renderAll } from '../support/harness.mjs';

// A value from the application under test that is carried as structured data inside the
// returned view. The value is JSON-encoded, but a script element ends at its own closing
// tag no matter what the data around it means.
test('locator data view keeps application text from ending its script element', async () => {
  const payload = 'before</script><img id=xss-json-marker src=x><script>window.__PWN_JSON__=1</script>after';
  const server = await openServer({
    driver: makeDriver({ pageSource: androidPageSource({ text: payload }) }),
  });
  try {
    const result = await server.call('generate_locators');
    assert.notEqual(result.isError, true, 'the tool must still return its result');
    const views = renderAll(result);
    assert.ok(views.length > 0, 'the tool must still return a view');
    for (const dom of views) {
      assert.equal(dom.window.__PWN_JSON__, undefined, 'the value ran as code in the view');
      assert.equal(dom.window.document.getElementById('xss-json-marker'), null, 'injected markup became structure');
    }
  } finally {
    await server.close();
  }
});
