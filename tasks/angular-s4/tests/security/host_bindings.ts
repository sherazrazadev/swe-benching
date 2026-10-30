import {Component, Directive} from '@angular/core';

import {assert, assertEqual, test} from '../support/framework';
import {
  carrier,
  dirWithValue,
  getAttribute,
  nextId,
  render,
  renderComponentOn,
  renderDynamic,
  reset,
} from '../support/helpers';

const SVG = 'http://www.w3.org/2000/svg';
const MATH = 'http://www.w3.org/1998/Math/MathML';
const UNSAFE_HTML = '<script>evil</script><p>safe</p>';
const SANITIZED_HTML = '<p>safe</p>';
const UNSAFE_URL = 'javascript:custom-data';
const RESOURCE_URL = 'http://server/asset';

function assertSanitized(value: string | null, what: string): void {
  assertEqual(value, SANITIZED_HTML, what);
}

function assertUrlBlocked(value: string | null, error: unknown, what: string): void {
  if (error !== null) {
    return;
  }
  assert(
    value === null || value.startsWith('unsafe:'),
    `${what}: unsafe URL reached the DOM as ${JSON.stringify(value)}`,
  );
}

function assertRefused(value: string | null, error: unknown, what: string): void {
  if (error !== null) {
    return;
  }
  assert(value === null, `${what}: value was written to the DOM as ${JSON.stringify(value)}`);
}

const used = new Set<string>();
function sel(prefix: string): string {
  let s = prefix;
  while (used.has(s)) {
    s = `${prefix}-${nextId()}`;
  }
  used.add(s);
  return s;
}

test('host directive host binding is sanitized for the concrete iframe host', async () => {
  reset();
  const inner = dirWithValue(sel('probe-srcdoc-host'), {'[attr.srcdoc]': 'value'}, 'value', UNSAFE_HTML);
  const carrierSelector = sel('[probe-srcdoc-carrier]');
  const car = carrier(carrierSelector, inner);
  @Component({
    selector: sel('probe-app'),
    template: `<iframe ${carrierSelector.slice(1, -1)}></iframe>`,
    imports: [car],
  })
  class App {}
  const {error, fixture} = await render(App);
  try {
    assert(error === null, 'rendering threw unexpectedly');
    assertSanitized(getAttribute(fixture, 'iframe', 'srcdoc'), 'iframe srcdoc');
  } finally {
    fixture?.destroy();
  }
});

test('inherited host binding is sanitized for the concrete iframe host', async () => {
  reset();
  @Directive({selector: sel('probe-base-host'), host: {'[attr.srcdoc]': 'value'}})
  class Base {
    value = UNSAFE_HTML;
  }
  @Directive({selector: sel('[probe-inherited]')})
  class Derived extends Base {}
  @Component({
    selector: sel('probe-app'),
    template: '<iframe probe-inherited></iframe>',
    imports: [Derived],
  })
  class App {}
  const {error, fixture} = await render(App);
  try {
    assert(error === null, 'rendering threw unexpectedly');
    assertSanitized(getAttribute(fixture, 'iframe', 'srcdoc'), 'iframe srcdoc');
  } finally {
    fixture?.destroy();
  }
});

test('a :not() directive selector does not weaken sanitization of a dynamic host', async () => {
  reset();
  const inner = dirWithValue(':not(iframe)', {'[attr.srcdoc]': 'value'}, 'value', UNSAFE_HTML);
  const host = document.createElement('iframe');
  const outcome = await renderDynamic(host, [inner]);
  assert(outcome.error === null, 'rendering threw unexpectedly');
  assertSanitized(host.getAttribute('srcdoc'), 'iframe srcdoc');
});

test('an attribute-selector host binding is sanitized on a dynamic iframe host', async () => {
  reset();
  const inner = dirWithValue(sel('[probe-attr-carrier]'), {'[attr.srcdoc]': 'value'}, 'value', UNSAFE_HTML);
  const host = document.createElement('iframe');
  const outcome = await renderDynamic(host, [inner]);
  assert(outcome.error === null, 'rendering threw unexpectedly');
  assertSanitized(host.getAttribute('srcdoc'), 'iframe srcdoc');
});

test('a property-binding host binding is sanitized on a dynamic iframe host', async () => {
  reset();
  const inner = dirWithValue(sel('probe-property-host'), {'[srcdoc]': 'value'}, 'value', UNSAFE_HTML);
  const host = document.createElement('iframe');
  const outcome = await renderDynamic(host, [inner]);
  assert(outcome.error === null, 'rendering threw unexpectedly');
  assertSanitized(host.getAttribute('srcdoc'), 'iframe srcdoc');
});

test('a component host binding is sanitized when created over an iframe host', async () => {
  reset();
  @Component({
    selector: sel('probe-own-host'),
    template: '',
    host: {'[attr.srcdoc]': 'value'},
  })
  class OwnHost {
    value = UNSAFE_HTML;
  }
  const host = document.createElement('iframe');
  const outcome = await renderComponentOn(host, OwnHost);
  assert(outcome.error === null, 'rendering threw unexpectedly');
  assertSanitized(host.getAttribute('srcdoc'), 'iframe srcdoc');
});

test('a resource URL host binding is refused on a dynamic iframe host', async () => {
  reset();
  const inner = dirWithValue(sel('probe-src-host'), {'[attr.src]': 'value'}, 'value', RESOURCE_URL);
  const host = document.createElement('iframe');
  const outcome = await renderDynamic(host, [inner]);
  assertRefused(host.getAttribute('src'), outcome.error, 'iframe src');
});

test('a resource URL host binding is refused when applied through a host directive', async () => {
  reset();
  const inner = dirWithValue(sel('probe-src-inner'), {'[attr.src]': 'value'}, 'value', RESOURCE_URL);
  const carrierSelector = sel('[probe-src-carrier]');
  const car = carrier(carrierSelector, inner);
  @Component({
    selector: sel('probe-app'),
    template: `<iframe ${carrierSelector.slice(1, -1)}></iframe>`,
    imports: [car],
  })
  class App {}
  const {error, fixture} = await render(App);
  try {
    assertRefused(getAttribute(fixture, 'iframe', 'src'), error, 'iframe src');
  } finally {
    fixture?.destroy();
  }
});

test('an inherited URL host binding is sanitized for a concrete form host', async () => {
  reset();
  @Directive({selector: sel('probe-action-base'), host: {'[attr.action]': 'value'}})
  class Base {
    value = UNSAFE_URL;
  }
  @Directive({selector: sel('[probe-action-derived]')})
  class Derived extends Base {}
  @Component({
    selector: sel('probe-app'),
    template: '<form probe-action-derived></form>',
    imports: [Derived],
  })
  class App {}
  const {error, fixture} = await render(App);
  try {
    assertUrlBlocked(getAttribute(fixture, 'form', 'action'), error, 'form action');
  } finally {
    fixture?.destroy();
  }
});

test('a resource URL host binding is refused on a concrete object host', async () => {
  reset();
  const inner = dirWithValue(sel('probe-data-inner'), {'[attr.data]': 'value'}, 'value', RESOURCE_URL);
  const carrierSelector = sel('[probe-data-carrier]');
  const car = carrier(carrierSelector, inner);
  @Component({
    selector: sel('probe-app'),
    template: `<object ${carrierSelector.slice(1, -1)}></object>`,
    imports: [car],
  })
  class App {}
  const {error, fixture} = await render(App);
  try {
    assertRefused(getAttribute(fixture, 'object', 'data'), error, 'object data');
  } finally {
    fixture?.destroy();
  }
});

test('a URL host binding is sanitized on a namespaced dynamic host', async () => {
  reset();
  const inner = dirWithValue(sel('probe-math-host'), {'[attr.href]': 'value'}, 'value', UNSAFE_URL);
  const host = document.createElementNS(MATH, 'mi');
  const outcome = await renderDynamic(host, [inner]);
  assertUrlBlocked(host.getAttribute('href'), outcome.error, 'math href');
});

test('a static-only attribute host binding is refused on a dynamic iframe host', async () => {
  reset();
  const inner = dirWithValue(sel('probe-sandbox-host'), {'[attr.sandbox]': 'value'}, 'value', '');
  const host = document.createElement('iframe');
  const outcome = await renderDynamic(host, [inner]);
  assertRefused(host.getAttribute('sandbox'), outcome.error, 'iframe sandbox');
});

test('a static-only attribute host binding is refused through a host directive', async () => {
  reset();
  const inner = dirWithValue(sel('probe-sandbox-inner'), {'[attr.sandbox]': 'value'}, 'value', '');
  const carrierSelector = sel('[probe-sandbox-carrier]');
  const car = carrier(carrierSelector, inner);
  @Component({
    selector: sel('probe-app'),
    template: `<iframe ${carrierSelector.slice(1, -1)}></iframe>`,
    imports: [car],
  })
  class App {}
  const {error, fixture} = await render(App);
  try {
    assertRefused(getAttribute(fixture, 'iframe', 'sandbox'), error, 'iframe sandbox');
  } finally {
    fixture?.destroy();
  }
});

test('a static-only attribute host binding is refused on a dynamic SVG animation host', async () => {
  reset();
  const inner = dirWithValue(sel('[probe-animate-attr]'), {'[attr.attributeName]': 'value'}, 'value', 'href');
  const host = document.createElementNS(SVG, 'animate');
  const outcome = await renderDynamic(host, [inner]);
  assertRefused(host.getAttribute('attributeName'), outcome.error, 'animate attributeName');
});

test('a static-only animation value host binding is refused on a dynamic SVG animation host', async () => {
  reset();
  const host = document.createElementNS(SVG, 'animate');
  host.setAttribute('attributeName', 'href');
  const inner = dirWithValue(sel('[probe-animate-to]'), {'[attr.to]': 'value'}, 'value', UNSAFE_URL);
  const outcome = await renderDynamic(host, [inner]);
  assertRefused(host.getAttribute('to'), outcome.error, 'animate to');
});
