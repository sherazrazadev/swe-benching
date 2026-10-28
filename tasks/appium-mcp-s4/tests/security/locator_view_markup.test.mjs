import test from 'node:test';
import assert from 'node:assert/strict';

import { androidPageSource, makeDriver, openServer, renderAll } from '../support/harness.mjs';

for (const [label, payload, forbiddenId] of [
  ['element text', 'before<script>window.__PWN_TEXT__=1</script><img id="xss-text-marker" src=x>', 'xss-text-marker'],
  ['resource id', 'com.example:id/<u id="xss-rid-marker">x</u>', 'xss-rid-marker'],
  ['content description', '<b id="xss-desc-marker">x</b> after', 'xss-desc-marker'],
]) {
  test(`locator view keeps application ${label} inert`, async () => {
    const pageSource = androidPageSource({
      text: label === 'element text' ? payload : '',
      contentDesc: label === 'content description' ? payload : '',
      resourceId: label === 'resource id' ? payload : 'com.example:id/widget',
    });
    const server = await openServer({ driver: makeDriver({ pageSource }) });
    try {
      const result = await server.call('generate_locators');
      assert.notEqual(result.isError, true, 'the tool must still return its result');
      const views = renderAll(result);
      assert.ok(views.length > 0, 'the tool must still return a view');
      for (const dom of views) {
        assert.equal(dom.window.__PWN_TEXT__, undefined, 'injected script ran');
        assert.equal(dom.window.document.getElementById(forbiddenId), null, 'injected markup became structure');
      }
    } finally {
      await server.close();
    }
  });
}
