import {Component} from '@angular/core';

import {assert, assertEqual, test} from '../support/framework';
import {
  carrier,
  dirWithValue,
  getAttribute,
  nextId,
  render,
  renderDynamic,
  reset,
} from '../support/helpers';

const SVG = 'http://www.w3.org/2000/svg';
const UNSAFE_HTML = '<script>evil</script><p>safe</p>';
const SANITIZED_HTML = '<p>safe</p>';
const UNSAFE_URL = 'javascript:custom-data';
const SAFE_URL = 'https://example.com/go';

const used = new Set<string>();
function sel(prefix: string): string {
  let s = prefix;
  while (used.has(s)) {
    s = `${prefix}-${nextId()}`;
  }
  used.add(s);
  return s;
}

async function renderWith(template: string, imports: any[]) {
  const result = {cls: null as any, outcome: null as any};
  @Component({selector: sel('probe-app'), template, imports})
  class App {}
  result.cls = App;
  result.outcome = await render(App);
  return result.outcome;
}

test('a value bound to a non-sensitive attribute on a div is written unchanged', async () => {
  reset();
  const directive = dirWithValue('div', {'[attr.srcdoc]': 'value'}, 'value', UNSAFE_HTML);
  const {error, fixture} = await renderWith('<div probe-div-srcdoc></div>', [directive]);
  try {
    assert(error === null, 'rendering threw unexpectedly');
    assertEqual(getAttribute(fixture, 'div', 'srcdoc'), UNSAFE_HTML, 'div srcdoc');
  } finally {
    fixture?.destroy();
  }
});

test('a resource-looking value on a div data attribute is written unchanged', async () => {
  reset();
  const directive = dirWithValue('div', {'[attr.data]': 'value'}, 'value', 'http://server/asset');
  const {error, fixture} = await renderWith('<div probe-div-data></div>', [directive]);
  try {
    assert(error === null, 'rendering threw unexpectedly');
    assertEqual(getAttribute(fixture, 'div', 'data'), 'http://server/asset', 'div data');
  } finally {
    fixture?.destroy();
  }
});

test('a URL-looking value on a div action attribute is written unchanged', async () => {
  reset();
  const directive = dirWithValue('div', {'[attr.action]': 'value'}, 'value', UNSAFE_URL);
  const {error, fixture} = await renderWith('<div probe-div-action></div>', [directive]);
  try {
    assert(error === null, 'rendering threw unexpectedly');
    assertEqual(getAttribute(fixture, 'div', 'action'), UNSAFE_URL, 'div action');
  } finally {
    fixture?.destroy();
  }
});

test('a value on a non-link SVG element is written unchanged', async () => {
  reset();
  const directive = dirWithValue('rect', {'[attr.href]': 'value'}, 'value', UNSAFE_URL);
  const {error, fixture} = await renderWith('<svg><rect probe-rect-href></rect></svg>', [directive]);
  try {
    assert(error === null, 'rendering threw unexpectedly');
    assertEqual(getAttribute(fixture, 'rect', 'href'), UNSAFE_URL, 'rect href');
  } finally {
    fixture?.destroy();
  }
});

test('a safe value bound to an iframe srcdoc keeps working', async () => {
  reset();
  const inner = dirWithValue(sel('probe-safe-srcdoc'), {'[attr.srcdoc]': 'value'}, 'value', SANITIZED_HTML);
  const carrierSelector = sel('[probe-safe-carrier]');
  const car = carrier(carrierSelector, inner);
  const {error, fixture} = await renderWith(
    `<iframe ${carrierSelector.slice(1, -1)}></iframe>`,
    [car],
  );
  try {
    assert(error === null, 'rendering threw unexpectedly');
    assertEqual(getAttribute(fixture, 'iframe', 'srcdoc'), SANITIZED_HTML, 'iframe srcdoc');
  } finally {
    fixture?.destroy();
  }
});

test('a safe URL bound to a form action keeps working', async () => {
  reset();
  const inner = dirWithValue(sel('probe-safe-action'), {'[attr.action]': 'value'}, 'value', SAFE_URL);
  const carrierSelector = sel('[probe-safe-action-carrier]');
  const car = carrier(carrierSelector, inner);
  const {error, fixture} = await renderWith(
    `<form ${carrierSelector.slice(1, -1)}></form>`,
    [car],
  );
  try {
    assert(error === null, 'rendering threw unexpectedly');
    assertEqual(getAttribute(fixture, 'form', 'action'), SAFE_URL, 'form action');
  } finally {
    fixture?.destroy();
  }
});

test('a sandbox binding on a non-iframe element keeps working', async () => {
  reset();
  const directive = dirWithValue('div', {'[attr.sandbox]': 'value'}, 'value', '');
  const {error, fixture} = await renderWith('<div probe-div-sandbox></div>', [directive]);
  try {
    assert(error === null, 'rendering threw unexpectedly');
    assertEqual(getAttribute(fixture, 'div', 'sandbox'), '', 'div sandbox');
  } finally {
    fixture?.destroy();
  }
});

test('static iframe policy attributes keep working', async () => {
  reset();
  @Component({
    selector: sel('probe-app'),
    template: '<iframe sandbox srcdoc="hello"></iframe>',
  })
  class App {}
  const {error, fixture} = await render(App);
  try {
    assert(error === null, 'rendering threw unexpectedly');
    assertEqual(getAttribute(fixture, 'iframe', 'sandbox'), '', 'iframe sandbox');
    assertEqual(getAttribute(fixture, 'iframe', 'srcdoc'), 'hello', 'iframe srcdoc');
  } finally {
    fixture?.destroy();
  }
});

test('a value bound to a non-sensitive attribute on a dynamic div is written unchanged', async () => {
  reset();
  const inner = dirWithValue(sel('probe-div-host'), {'[attr.data]': 'value'}, 'value', 'http://server/asset');
  const host = document.createElement('div');
  const outcome = await renderDynamic(host, [inner]);
  assert(outcome.error === null, 'rendering threw unexpectedly');
  assertEqual(host.getAttribute('data'), 'http://server/asset', 'dynamic div data');
});

test('a host directive value on a non-sensitive element is written unchanged', async () => {
  reset();
  const inner = dirWithValue('div', {'[attr.data]': 'value'}, 'value', 'http://server/asset');
  const carrierSelector = sel('[probe-div-carrier]');
  const car = carrier(carrierSelector, inner);
  const {error, fixture} = await renderWith(
    `<div ${carrierSelector.slice(1, -1)}></div>`,
    [car],
  );
  try {
    assert(error === null, 'rendering threw unexpectedly');
    assertEqual(getAttribute(fixture, 'div', 'data'), 'http://server/asset', 'div data');
  } finally {
    fixture?.destroy();
  }
});

test('a value on a non-link dynamic SVG element is written unchanged', async () => {
  reset();
  const inner = dirWithValue(sel('probe-rect-host'), {'[attr.href]': 'value'}, 'value', UNSAFE_URL);
  const host = document.createElementNS(SVG, 'rect');
  const outcome = await renderDynamic(host, [inner]);
  assert(outcome.error === null, 'rendering threw unexpectedly');
  assertEqual(host.getAttribute('href'), UNSAFE_URL, 'dynamic rect href');
});

test('a safe URL bound to an anchor keeps working', async () => {
  reset();
  const directive = dirWithValue('a', {'[attr.href]': 'value'}, 'value', SAFE_URL);
  const {error, fixture} = await renderWith('<a probe-anchor-href></a>', [directive]);
  try {
    assert(error === null, 'rendering threw unexpectedly');
    assertEqual(getAttribute(fixture, 'a', 'href'), SAFE_URL, 'anchor href');
  } finally {
    fixture?.destroy();
  }
});

test('an HTML host binding is still sanitized where the element is an HTML sink', async () => {
  reset();
  const inner = dirWithValue(sel('probe-innerhtml-host'), {'[innerHTML]': 'value'}, 'value', UNSAFE_HTML);
  const carrierSelector = sel('[probe-innerhtml-carrier]');
  const car = carrier(carrierSelector, inner);
  const {error, fixture} = await renderWith(
    `<div ${carrierSelector.slice(1, -1)}></div>`,
    [car],
  );
  try {
    assert(error === null, 'rendering threw unexpectedly');
    assertEqual((fixture?.nativeElement as HTMLElement).querySelector('div')!.innerHTML, SANITIZED_HTML, 'innerHTML');
  } finally {
    fixture?.destroy();
  }
});
