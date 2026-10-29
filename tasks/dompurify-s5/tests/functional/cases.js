'use strict';
const assert = require('assert');

/*
 * Hidden functional group. Legitimate use of the sanitizer, including the behaviour
 * coupled to the protected hook lifecycle, must keep working exactly as before.
 */

module.exports = function (createDOMPurify, JSDOM) {
  function dom() {
    const { window } = new JSDOM('<!DOCTYPE html><body></body>', {
      runScripts: 'dangerously',
    });
    const DOMPurify = createDOMPurify(window);
    return { window, document: window.document, DOMPurify };
  }

  function parse(html) {
    const { window } = new JSDOM('<!DOCTYPE html><body></body>');
    const holder = window.document.createElement('div');
    holder.innerHTML = html;
    return holder;
  }

  const out = [];
  const add = (classname, name, run) => out.push({ classname, name, run });

  // ---------------------------------------------------------------- preserved configuration
  add('functional/kept-custom', 'configured custom elements survive (name pattern)', () => {
    const { DOMPurify } = dom();
    const clean = DOMPurify.sanitize('<x-keep title="t">b</x-keep>', {
      CUSTOM_ELEMENT_HANDLING: { tagNameCheck: /^x-/ },
    });
    assert.strictEqual(clean, '<x-keep title="t">b</x-keep>');
  });

  add('functional/kept-custom', 'configured custom elements survive (predicate)', () => {
    const { DOMPurify } = dom();
    const clean = DOMPurify.sanitize('<x-keep title="t">b</x-keep>', {
      CUSTOM_ELEMENT_HANDLING: { tagNameCheck: (tagName) => tagName.startsWith('x-') },
    });
    assert.strictEqual(clean, '<x-keep title="t">b</x-keep>');
  });

  add('functional/kept-custom', 'kept custom element attributes are still sanitized', () => {
    const { DOMPurify } = dom();
    const clean = DOMPurify.sanitize(
      '<x-keep onclick="alert(1)" href="javascript:alert(1)">' +
        '<img src="x" onerror="alert(1)"></x-keep>',
      { CUSTOM_ELEMENT_HANDLING: { tagNameCheck: /^x-/ } }
    );
    assert.ok(clean.indexOf('x-keep') !== -1, `kept element lost: ${clean}`);
    assert.strictEqual(/onclick/i.test(clean), false, clean);
    assert.strictEqual(/javascript:/i.test(clean), false, clean);
    assert.strictEqual(/onerror/i.test(clean), false, clean);
  });

  add('functional/kept-custom', 'unconfigured custom elements are removed and their content kept', () => {
    const { DOMPurify } = dom();
    const clean = DOMPurify.sanitize('<x-other>text</x-other>', {
      CUSTOM_ELEMENT_HANDLING: { tagNameCheck: /^x-keep$/ },
    });
    assert.strictEqual(clean.indexOf('x-other'), -1, clean);
    assert.ok(/text/.test(clean), clean);
  });

  add('functional/kept-custom', 'configured custom element inside template content survives', () => {
    const { DOMPurify } = dom();
    const clean = DOMPurify.sanitize(
      '<div><template><x-keep title="t">b</x-keep></template></div>',
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
    assert.strictEqual(kept.getAttribute('title'), 't');
  });

  // ---------------------------------------------------------------- hook scope
  add('functional/hook-scope', 'the element hook runs for surviving allowlisted elements', () => {
    const { DOMPurify } = dom();
    const seen = [];
    DOMPurify.addHook('afterSanitizeElements', (node) => {
      if (node.nodeType === 1) seen.push(node.tagName.toLowerCase());
    });
    DOMPurify.sanitize('<div>d</div>');
    assert.ok(seen.indexOf('div') !== -1, `hook did not see div: ${seen.join(',')}`);
  });

  add('functional/hook-scope', 'the element hook does not run for elements the sanitizer removes', () => {
    const { DOMPurify } = dom();
    const seen = [];
    DOMPurify.addHook('afterSanitizeElements', (node) => {
      if (node.nodeType === 1) seen.push(node.tagName.toLowerCase());
    });
    DOMPurify.sanitize(
      '<script>alert(1)</script><x-unknown>u</x-unknown><foo>t</foo><div>d</div>'
    );
    assert.strictEqual(seen.indexOf('script'), -1, `hook ran for removed script: ${seen.join(',')}`);
    assert.strictEqual(seen.indexOf('x-unknown'), -1, `hook ran for removed element: ${seen.join(',')}`);
    assert.strictEqual(seen.indexOf('foo'), -1, `hook ran for removed element: ${seen.join(',')}`);
    assert.ok(seen.indexOf('div') !== -1, `hook missed the surviving element: ${seen.join(',')}`);
  });

  add('functional/hook-scope', 'the element hook runs once per surviving element', () => {
    const { DOMPurify } = dom();
    const counts = Object.create(null);
    DOMPurify.addHook('afterSanitizeElements', (node) => {
      if (node.nodeType !== 1) return;
      const name = node.tagName.toLowerCase();
      counts[name] = (counts[name] || 0) + 1;
    });
    DOMPurify.sanitize('<div>a</div><b>c</b>', {
      CUSTOM_ELEMENT_HANDLING: { tagNameCheck: /^x-/ },
    });
    assert.strictEqual(counts.div, 1, `div seen ${counts.div} times`);
    assert.strictEqual(counts.b, 1, `b seen ${counts.b} times`);
  });

  // ---------------------------------------------------------------- caller predicate keep
  add('functional/predicate-kept', 'elements kept by a caller predicate survive and are sanitized', () => {
    const { DOMPurify } = dom();
    const clean = DOMPurify.sanitize('<x-widget title="t" bad="1">b</x-widget>', {
      ADD_TAGS: (tagName) => tagName === 'x-widget',
    });
    assert.strictEqual(clean, '<x-widget title="t">b</x-widget>');
  });

  add('functional/predicate-kept', 'the forbid list still wins over a caller predicate', () => {
    const { DOMPurify } = dom();
    const clean = DOMPurify.sanitize('<x-widget>a</x-widget>', {
      ADD_TAGS: (tagName) => tagName === 'x-widget',
      FORBID_TAGS: ['x-widget'],
    });
    assert.strictEqual(clean.indexOf('x-widget'), -1, clean);
    assert.ok(/a/.test(clean), clean);
  });

  // ---------------------------------------------------------------- ordinary behaviour
  add('functional/preservation', 'ordinary markup is unchanged', () => {
    const { DOMPurify } = dom();
    const clean = DOMPurify.sanitize(
      '<b>bold</b><script>alert(1)</script>' +
        '<a href="javascript:alert(1)">x</a><img src="x" onerror="alert(1)">'
    );
    assert.ok(/<b>bold<\/b>/.test(clean), clean);
    assert.strictEqual(/<script/i.test(clean), false, clean);
    assert.strictEqual(/javascript:/i.test(clean), false, clean);
    assert.strictEqual(/onerror/i.test(clean), false, clean);
  });

  add('functional/preservation', 'element and attribute hooks keep their documented order', () => {
    const { DOMPurify } = dom();
    const order = [];
    DOMPurify.addHook('afterSanitizeElements', (node) => {
      if (node.nodeType === 1) {
        order.push('element:' + node.tagName.toLowerCase());
        node.setAttribute('data-hook', '1');
      }
    });
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.nodeType === 1) order.push('attributes:' + node.tagName.toLowerCase());
    });
    const clean = DOMPurify.sanitize('<div>d</div>');
    assert.ok(
      order.indexOf('element:div') < order.indexOf('attributes:div'),
      `hook order changed: ${order.join(',')}`
    );
    assert.ok(/data-hook="1"/.test(clean), clean);
  });

  return out;
};
