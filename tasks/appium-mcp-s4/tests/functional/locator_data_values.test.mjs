import test from 'node:test';
import assert from 'node:assert/strict';

import { androidPageSource, makeDriver, openServer, htmlViews, renderView } from '../support/harness.mjs';

test('functional: locator data survives unchanged in the structured result', async () => {
  const pageSource = androidPageSource({
    text: 'Save & continue',
    contentDesc: "Don't & co",
    resourceId: 'com.example:id/btn',
  });
  const server = await openServer({ driver: makeDriver({ pageSource }) });
  try {
    const result = await server.call('generate_locators');
    assert.notEqual(result.isError, true);

    const described = JSON.parse(result.content[0].text);
    assert.equal(described.interactableElements[0].text, 'Save & continue');
    assert.equal(described.interactableElements[0].contentDesc, "Don't & co");
    assert.equal(described.interactableElements[0].resourceId, 'com.example:id/btn');

    for (const html of htmlViews(result)) {
      const dom = renderView(html);
      const document = dom.window.document;
      const candidates = [];
      for (const node of Array.from(document.querySelectorAll('script[type="application/json"]'))) {
        candidates.push(node.textContent);
      }
      for (const element of Array.from(document.querySelectorAll('*'))) {
        for (const attribute of Array.from(element.attributes)) {
          if (attribute.value && attribute.value.trim().startsWith('[')) {
            candidates.push(attribute.value);
          }
        }
      }
      for (const candidate of candidates) {
        let data;
        try {
          data = JSON.parse(candidate);
        } catch {
          continue;
        }
        if (Array.isArray(data) && data[0] && data[0].contentDesc !== undefined) {
          assert.equal(data[0].contentDesc, "Don't & co", 'the structured view must carry the same value');
        }
      }
    }
  } finally {
    await server.close();
  }
});
