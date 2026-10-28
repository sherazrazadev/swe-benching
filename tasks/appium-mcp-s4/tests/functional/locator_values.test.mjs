import test from 'node:test';
import assert from 'node:assert/strict';

import { androidPageSource, makeDriver, openServer, htmlViews, renderView } from '../support/harness.mjs';

test('functional: locator view shows values and sends the exact locator onward', async () => {
  const pageSource = androidPageSource({
    tag: 'android.widget.Button',
    text: 'Save & continue',
    contentDesc: "Don't & co",
    resourceId: 'com.example:id/btn',
  });
  const server = await openServer({ driver: makeDriver({ pageSource }) });
  try {
    const result = await server.call('generate_locators');
    assert.notEqual(result.isError, true);

    const views = htmlViews(result).map(renderView);
    const dom = views.find((candidate) => candidate.window.document.querySelector('.locator-card'));
    assert.ok(dom, 'a locator card view must be returned');
    const document = dom.window.document;

    assert.equal(document.querySelectorAll('.locator-card').length, 1);
    assert.equal(document.querySelector('.locator-card h3').textContent, 'android.widget.Button');
    assert.match(document.querySelector('.element-text').textContent, /Save & continue/);

    const posted = [];
    dom.window.postMessage = (message) => posted.push(message);
    const item = Array.from(document.querySelectorAll('.locator-item')).find(
      (candidate) => candidate.querySelector('.strategy')?.textContent === 'accessibility id'
    );
    assert.ok(item, 'the accessibility id locator must be offered');
    item.querySelector('.test-btn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    const intent = posted.find((message) => message?.payload?.toolName === 'appium_find_element');
    assert.ok(intent, 'the test control must send the element lookup onward');
    assert.equal(intent.payload.params.strategy, 'accessibility id');
    assert.equal(intent.payload.params.selector, "Don't & co", 'the exact locator must be preserved');
  } finally {
    await server.close();
  }
});
