'use strict';
const assert = require('assert');

/*
 * Hidden security group. Every case goes through the library's real public entry point
 * (sanitize) and asserts that the application policy registered on the element hook is
 * enforced: the attacker-controlled attribute/element the policy removes must be absent
 * from the sanitized result. Expectations are computed in the test, never by the product.
 */

module.exports = function (createDOMPurify, JSDOM) {
  function dom() {
    const { window } = new JSDOM('<!DOCTYPE html><body></body>', {
      runScripts: 'dangerously',
    });
    const DOMPurify = createDOMPurify(window);
    return { window, document: window.document, DOMPurify };
  }

  /* The application policy: every element that survives must lose this attribute. */
  function stripPolicyAttr(DOMPurify) {
    DOMPurify.addHook('afterSanitizeElements', (node) => {
      if (node.nodeType === 1 && node.hasAttribute('data-policy')) {
        node.removeAttribute('data-policy');
      }
    });
  }

  /* The application policy: elements carrying this marker must not survive. */
  function dropPolicyElements(DOMPurify) {
    DOMPurify.addHook('afterSanitizeElements', (node) => {
      if (node.nodeType === 1 && node.hasAttribute('data-drop')) {
        node.remove();
      }
    });
  }

  function parse(html) {
    const { window } = new JSDOM('<!DOCTYPE html><body></body>');
    const holder = window.document.createElement('div');
    holder.innerHTML = html;
    return holder;
  }

  const out = [];
  const add = (classname, name, run) => out.push({ classname, name, run });

  // ---------------------------------------------------------------- reported route
  add('security/kept-custom', 'kept custom element ignores the element policy (name pattern)', () => {
    const { DOMPurify } = dom();
    stripPolicyAttr(DOMPurify);
    const clean = DOMPurify.sanitize(
      '<div data-policy="d">a</div><x-keep data-policy="secret">b</x-keep>',
      { CUSTOM_ELEMENT_HANDLING: { tagNameCheck: /^x-/ } }
    );
    assert.ok(/<x-keep>b<\/x-keep>/.test(clean), `kept element changed: ${clean}`);
    assert.strictEqual(clean.indexOf('data-policy'), -1, `policy attribute survived: ${clean}`);
  });

  add('security/kept-custom', 'kept custom element ignores the element policy (predicate)', () => {
    const { DOMPurify } = dom();
    stripPolicyAttr(DOMPurify);
    const clean = DOMPurify.sanitize('<x-keep data-policy="secret">b</x-keep>', {
      CUSTOM_ELEMENT_HANDLING: {
        tagNameCheck: (tagName) => tagName.startsWith('x-'),
      },
    });
    assert.ok(/<x-keep>b<\/x-keep>/.test(clean), `kept element changed: ${clean}`);
    assert.strictEqual(clean.indexOf('data-policy'), -1, `policy attribute survived: ${clean}`);
  });

  add('security/kept-custom', 'kept custom element in a live tree ignores the element policy', () => {
    const { document, DOMPurify } = dom();
    stripPolicyAttr(DOMPurify);
    const root = document.createElement('div');
    root.innerHTML =
      '<x-keep data-policy="secret">b</x-keep><span data-policy="d">c</span>';
    document.body.appendChild(root);
    DOMPurify.sanitize(root, {
      IN_PLACE: true,
      CUSTOM_ELEMENT_HANDLING: { tagNameCheck: /^x-/ },
    });
    const kept = root.querySelector('x-keep');
    assert.ok(kept, 'kept custom element was removed');
    assert.strictEqual(kept.getAttribute('data-policy'), null, 'policy attribute survived in place');
    assert.strictEqual(root.querySelector('span').getAttribute('data-policy'), null);
  });

  add('security/kept-custom', 'kept custom element in a DOM result ignores the element policy', () => {
    const { DOMPurify } = dom();
    stripPolicyAttr(DOMPurify);
    const fragment = DOMPurify.sanitize('<x-keep data-policy="secret">b</x-keep>', {
      RETURN_DOM_FRAGMENT: true,
      CUSTOM_ELEMENT_HANDLING: { tagNameCheck: /^x-/ },
    });
    const kept = fragment.querySelector('x-keep');
    assert.ok(kept, 'kept custom element was removed');
    assert.strictEqual(kept.getAttribute('data-policy'), null, 'policy attribute survived in the DOM result');
  });

  add('security/kept-custom', 'the element policy can drop a kept custom element', () => {
    const { DOMPurify } = dom();
    dropPolicyElements(DOMPurify);
    const clean = DOMPurify.sanitize(
      '<x-evil data-drop="1">a</x-evil><x-ok>b</x-ok>',
      { CUSTOM_ELEMENT_HANDLING: { tagNameCheck: /^x-/ } }
    );
    assert.strictEqual(clean.indexOf('x-evil'), -1, `dropped element survived: ${clean}`);
    assert.ok(/<x-ok>b<\/x-ok>/.test(clean), `legitimate kept element lost: ${clean}`);
  });

  add('security/kept-custom', 'stored configuration cannot bypass the element policy', () => {
    const { DOMPurify } = dom();
    stripPolicyAttr(DOMPurify);
    DOMPurify.setConfig({
      CUSTOM_ELEMENT_HANDLING: { tagNameCheck: /^x-/ },
    });
    const clean = DOMPurify.sanitize('<x-keep data-policy="secret">b</x-keep>');
    assert.ok(/<x-keep>b<\/x-keep>/.test(clean), `kept element changed: ${clean}`);
    assert.strictEqual(clean.indexOf('data-policy'), -1, `policy attribute survived: ${clean}`);
  });

  // ---------------------------------------------------------------- second sink
  add('security/shadow-content', 'kept custom element in template content ignores the element policy', () => {
    const { DOMPurify } = dom();
    stripPolicyAttr(DOMPurify);
    const clean = DOMPurify.sanitize(
      '<div><template><x-keep data-policy="secret">b</x-keep></template></div>',
      {
        ADD_TAGS: ['template'],
        CUSTOM_ELEMENT_HANDLING: { tagNameCheck: /^x-/ },
      }
    );
    const holder = parse(clean);
    const template = holder.querySelector('template');
    assert.ok(template, `template lost: ${clean}`);
    const kept = template.content.querySelector('x-keep');
    assert.ok(kept, `kept custom element lost from template content: ${clean}`);
    assert.strictEqual(kept.getAttribute('data-policy'), null, `policy attribute survived: ${clean}`);
  });

  add('security/shadow-content', 'the element policy can drop a kept custom element in template content', () => {
    const { DOMPurify } = dom();
    dropPolicyElements(DOMPurify);
    const clean = DOMPurify.sanitize(
      '<div><template><x-evil data-drop="1">a</x-evil><x-ok>b</x-ok></template></div>',
      {
        ADD_TAGS: ['template'],
        CUSTOM_ELEMENT_HANDLING: { tagNameCheck: /^x-/ },
      }
    );
    const holder = parse(clean);
    const template = holder.querySelector('template');
    assert.ok(template, `template lost: ${clean}`);
    assert.strictEqual(template.content.querySelector('x-evil'), null, `dropped element survived: ${clean}`);
    assert.ok(template.content.querySelector('x-ok'), `legitimate kept element lost: ${clean}`);
  });

  add('security/shadow-content', 'kept custom element in an attached shadow root ignores the element policy', () => {
    const { document, DOMPurify } = dom();
    stripPolicyAttr(DOMPurify);
    const root = document.createElement('div');
    const host = document.createElement('x-host');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<x-in data-policy="secret">b</x-in>';
    root.appendChild(host);
    document.body.appendChild(root);
    DOMPurify.sanitize(root, {
      IN_PLACE: true,
      CUSTOM_ELEMENT_HANDLING: { tagNameCheck: /^x-/ },
    });
    const kept = shadow.querySelector('x-in');
    assert.ok(kept, 'kept custom element was removed from the shadow root');
    assert.strictEqual(kept.getAttribute('data-policy'), null, 'policy attribute survived in the shadow root');
  });

  // ---------------------------------------------------------------- predicate allow path
  add('security/predicate-kept', 'element kept by a caller predicate ignores the element policy', () => {
    const { DOMPurify } = dom();
    stripPolicyAttr(DOMPurify);
    const clean = DOMPurify.sanitize('<x-widget data-policy="secret">b</x-widget>', {
      ADD_TAGS: (tagName) => tagName === 'x-widget',
    });
    assert.ok(/<x-widget>b<\/x-widget>/.test(clean), `kept element changed: ${clean}`);
    assert.strictEqual(clean.indexOf('data-policy'), -1, `policy attribute survived: ${clean}`);
  });

  add('security/predicate-kept', 'element kept by a caller predicate in a live tree ignores the element policy', () => {
    const { document, DOMPurify } = dom();
    stripPolicyAttr(DOMPurify);
    const root = document.createElement('div');
    root.innerHTML = '<x-widget data-policy="secret">b</x-widget>';
    document.body.appendChild(root);
    DOMPurify.sanitize(root, {
      IN_PLACE: true,
      ADD_TAGS: (tagName) => tagName === 'x-widget',
    });
    const kept = root.querySelector('x-widget');
    assert.ok(kept, 'kept element was removed');
    assert.strictEqual(kept.getAttribute('data-policy'), null, 'policy attribute survived in place');
  });

  add('security/predicate-kept', 'the element policy can drop an element kept by a caller predicate', () => {
    const { DOMPurify } = dom();
    dropPolicyElements(DOMPurify);
    const clean = DOMPurify.sanitize('<x-widget data-drop="1">b</x-widget>', {
      ADD_TAGS: (tagName) => tagName === 'x-widget',
    });
    assert.strictEqual(clean.indexOf('x-widget'), -1, `dropped element survived: ${clean}`);
  });

  return out;
};
