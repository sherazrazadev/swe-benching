import test from 'node:test';
import assert from 'node:assert/strict';

import { androidPageSource, makeDriver, openServer, renderAll } from '../support/harness.mjs';

for (const [label, payload, marker] of [
  ['interpolation', 'before${window.__PWN_PAGE_INTERP__=1}after', '__PWN_PAGE_INTERP__'],
  ['template terminator', 'before`;window.__PWN_PAGE_TICK__=1;x=`after', '__PWN_PAGE_TICK__'],
]) {
  test(`page-source view keeps a ${label} value out of its script`, async () => {
    const pageSource = androidPageSource({ text: payload });
    const server = await openServer({ driver: makeDriver({ pageSource }) });
    try {
      const result = await server.call('appium_get_page_source');
      assert.notEqual(result.isError, true, 'the tool must still return its result');
      const views = renderAll(result);
      assert.ok(views.length > 0, 'the tool must still return a view');
      for (const dom of views) {
        assert.equal(dom.window[marker], undefined, 'the value ran as code in the view');
      }
      // The view must keep showing the page source it was given.
      const shown = views.some((dom) =>
        (dom.window.document.getElementById('xmlContent')?.textContent || '').includes('android.widget.TextView')
      );
      assert.ok(shown, 'the view must still display the page source');
    } finally {
      await server.close();
    }
  });
}
