'use strict';

/*
 * Functional cases: legitimate use and the coupled values that sit next to the hidden ones.
 * Every expectation below is what the pinned library already produces today; these must keep
 * working whatever the fix does. Values are literals in the case table; nothing is computed with
 * the product.
 */

function own(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

module.exports = function (D) {
  const cases = [];

  function functionalCase(id, description, run) {
    cases.push({
      classname: 'functional/' + id,
      name: `${id}: ${description}`,
      run,
    });
  }

  function eq(got, want, what) {
    if (got !== want) {
      throw new Error(`${what} is ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
    }
  }

  // --- ordinary nested writes ---
  functionalCase('F-set-existing', 'setting an existing nested value keeps working', () => {
    const data = { foo: { bar: 'baa' } };
    D.set(data, 'foo.bar', 'baz');
    eq(data.foo.bar, 'baz', 'data.foo.bar');
  });

  functionalCase('F-set-create', 'writing a missing nested value still creates the structure', () => {
    const data = {};
    D.set(data, 'level1.level2', 'foo');
    eq(typeof data.level1, 'object', 'typeof data.level1');
    eq(data.level1.level2, 'foo', 'data.level1.level2');
  });

  functionalCase('F-set-undefined', 'an undefined intermediate value is still converted to an object', () => {
    const data = { values: undefined };
    D.set(data, 'values.level1', 'foo');
    eq(data.values.level1, 'foo', 'data.values.level1');
  });

  functionalCase('F-set-force-null', 'the force option still overwrites a null intermediate value', () => {
    const data = { values: null };
    D.set(data, 'values.level1', 'foo', { force: true });
    eq(data.values.level1, 'foo', 'data.values.level1');
  });

  functionalCase('F-set-force-nonobject', 'the force option still overwrites a non-object intermediate value', () => {
    const data = { foo: { bar: 'baa' } };
    D.set(data, 'foo.bar.baz', 'someValue', { force: true });
    eq(data.foo.bar.baz, 'someValue', 'data.foo.bar.baz');
  });

  functionalCase('F-set-throws-nonobject', 'an unsuitable intermediate value still raises without force', () => {
    const data = { foo: { bar: 'baa' } };
    let threw = false;
    try { D.set(data, 'foo.bar.baz', 'someValue'); } catch (e) { threw = true; }
    eq(threw, true, 'the error raised for a non-object intermediate value');
  });

  functionalCase('F-set-deep', 'a long ordinary path still binds', () => {
    const data = {};
    D.set(data, 'a.b.c.d.e.f.g.h.i.j', 'deep');
    eq(data.a.b.c.d.e.f.g.h.i.j, 'deep', 'the tenth level');
  });

  functionalCase('F-set-similar-names', 'a path part resembling a prototype name still binds', () => {
    const data = {};
    D.set(data, 'a.__proto__x.y', 1);
    eq(data.a && own(data.a, '__proto__x') ? data.a['__proto__x'].y : undefined, 1,
      'data.a["__proto__x"].y');
  });

  // A final field name is ordinary data even when it resembles a built-in object concept.
  functionalCase('F-set-final-fields', 'a final field name resembling a built-in concept is stored as data', () => {
    const data = {};
    D.set(data, 'cfg.prototype', 'legacy');
    D.set(data, 'cfg.constructor', 'ctor');
    D.set(data, 'prototype', 'top');
    eq(data.cfg.prototype, 'legacy', 'data.cfg.prototype');
    eq(data.cfg.constructor, 'ctor', 'data.cfg.constructor');
    eq(data.prototype, 'top', 'data.prototype');
    eq(own(data.cfg, 'prototype') && own(data.cfg, 'constructor'), true,
      'the fields being own fields of cfg');
  });

  // --- array paths, including the coupled shapes next to the hidden ones ---
  functionalCase('F-set-array-dotted', 'an array path part that contains the separator stays whole', () => {
    const data = {};
    D.set(data, ['some.dot.containing', 'value'], 'razzamataz');
    eq(data['some.dot.containing'].value, 'razzamataz', 'data["some.dot.containing"].value');
  });

  functionalCase('F-set-array-nested', 'a non-string path part that names an ordinary key still binds', () => {
    const data = {};
    D.set(data, [['a.b'], 'value'], 7);
    eq(data['a.b'].value, 7, 'data["a.b"].value');
  });

  functionalCase('F-set-array-from-json', 'a path parsed from JSON still binds ordinary names', () => {
    const path = JSON.parse('{"parts":[["a.b"],"value"]}').parts;
    const data = {};
    D.set(data, path, 'ok');
    eq(data['a.b'].value, 'ok', 'data["a.b"].value');
  });

  // --- the default route and reads ---
  functionalCase('F-default-route', 'the default route still writes only a missing value', () => {
    const data = { a: { b: 1 } };
    D['default'](data, 'a.b', 2);
    D['default'](data, 'a.c', 3);
    eq(data.a.b, 1, 'data.a.b');
    eq(data.a.c, 3, 'data.a.c');
  });

  functionalCase('F-get', 'reading nested values is unchanged', () => {
    const data = { a: { b: 1 }, 'c.d': { e: 2 } };
    eq(D.get(data, 'a.b'), 1, 'D.get(data, "a.b")');
    eq(D.get(data, ['c.d', 'e']), 2, 'D.get(data, ["c.d","e"])');
    eq(D.get(data, 'a.missing', 'fallback'), 'fallback', 'the default value');
  });

  // --- ordinary conversion ---
  functionalCase('F-transform-basic', 'dotted keys are still nested', () => {
    const r = D.transform({
      'user.name': 'John Doe',
      'user.email': 'jd@foobar.com',
      'user.location.country': 'Zanzibar',
      'user.location.city': 'Zanzibar City',
    });
    eq(r.user.name, 'John Doe', 'r.user.name');
    eq(r.user.email, 'jd@foobar.com', 'r.user.email');
    eq(r.user.location.city, 'Zanzibar City', 'r.user.location.city');
  });

  functionalCase('F-transform-delimiter', 'a custom separator still nests', () => {
    const r = D.transform({
      user_name: 'Mick Hansen',
      user_email: 'maker@mhansen.io',
      project_title: 'dottie',
    }, { delimiter: '_' });
    eq(r.user.name, 'Mick Hansen', 'r.user.name');
    eq(r.user.email, 'maker@mhansen.io', 'r.user.email');
    eq(r.project.title, 'dottie', 'r.project.title');
  });

  functionalCase('F-transform-null-break', 'a null intermediate value still stops that key', () => {
    const r = D.transform({
      'section.id': 20,
      'section.layout': null,
      'section.layout.id': null,
      'section.layout.name': null,
    });
    eq(r.section.layout, null, 'r.section.layout');
    eq(r['section.layout.id'], undefined, 'r["section.layout.id"]');
    eq(r['section.layout.name'], undefined, 'r["section.layout.name"]');
  });

  functionalCase('F-transform-array', 'array input is still converted element by element', () => {
    const r = D.transform([
      { 'customer.name': 'John Doe', 'customer.age': 15, client: 'Lolcat' },
      { 'client.name': 'John Doe', 'client.age': 15, customer: 'Lolcat' },
    ]);
    eq(r[0].customer.name, 'John Doe', 'r[0].customer.name');
    eq(r[1].client.name, 'John Doe', 'r[1].client.name');
  });

  functionalCase('F-transform-plain-key', 'a key without the separator is still an own field', () => {
    const r = D.transform({ 'customer.name': 'John Doe', client: 'Lolcat' });
    eq(r.client, 'Lolcat', 'r.client');
    eq(own(r, 'client'), true, 'client being an own field');
  });

  functionalCase('F-transform-similar-names', 'names that merely resemble a prototype name still bind', () => {
    const r = D.transform({ '__proto__x': 'safe', proto_field: 'ok', 'a.__proto__x': 'ok2' });
    eq(own(r, '__proto__x') ? r['__proto__x'] : undefined, 'safe', 'r["__proto__x"]');
    eq(own(r, 'proto_field') ? r.proto_field : undefined, 'ok', 'r.proto_field');
    eq(r.a && own(r.a, '__proto__x') ? r.a['__proto__x'] : undefined, 'ok2', 'r.a["__proto__x"]');
  });

  functionalCase('F-transform-final-fields', 'final field names resembling built-ins are still data', () => {
    const r = D.transform({ 'cfg.prototype': 'legacy', 'cfg.constructor': 'ctor', 'prototype': 'top' });
    eq(r.cfg.prototype, 'legacy', 'r.cfg.prototype');
    eq(r.cfg.constructor, 'ctor', 'r.cfg.constructor');
    eq(r.prototype, 'top', 'r.prototype');
  });

  functionalCase('F-one-argument-entry', 'the one-argument conversion call still nests ordinary keys', () => {
    const r = D({ 'user.name': 'guest', 'user.role': 'reader' });
    eq(r.user.name, 'guest', 'r.user.name');
    eq(r.user.role, 'reader', 'r.user.role');
  });

  // A refused key must not abort the call or discard the other keys and records.
  functionalCase('F-transform-partial-refusal', 'one refused key leaves every other key and record intact', () => {
    const bad = 'section.__proto__.probe_intruder';
    const r = D.transform({ [bad]: true, 'user.name': 'Jo', 'user.email': 'jo@example.com' });
    eq(r.user.name, 'Jo', 'r.user.name');
    eq(r.user.email, 'jo@example.com', 'r.user.email');

    const list = D.transform([
      { [bad]: true, 'customer.name': 'A' },
      { 'customer.name': 'B' },
    ]);
    eq(list[0].customer.name, 'A', 'list[0].customer.name');
    eq(list[1].customer.name, 'B', 'list[1].customer.name');
  });

  // --- combining data ---
  functionalCase('F-merge-basic', 'combining nested data still merges plain objects and primitives', () => {
    const target = { user: { role: 'admin' }, keep: 'x' };
    D.merge(target, { user: { name: 'Jo' }, active: true });
    eq(target.user.role, 'admin', 'target.user.role');
    eq(target.user.name, 'Jo', 'target.user.name');
    eq(target.active, true, 'target.active');
    eq(target.keep, 'x', 'target.keep');
  });

  functionalCase('F-merge-arrays', 'combining data still replaces list values as before', () => {
    const target = { list: [1], flag: false };
    D.merge(target, { list: [2], flag: true });
    eq(target.list.length, 1, 'target.list.length');
    eq(target.list[0], 2, 'target.list[0]');
    eq(target.flag, true, 'target.flag');
  });

  functionalCase('F-merge-final-fields', 'combining data still stores final fields resembling built-ins', () => {
    const target = {};
    D.merge(target, { prototype: 'p', constructor: 'c', ordinary: 1 });
    eq(target.prototype, 'p', 'target.prototype');
    eq(target.constructor, 'c', 'target.constructor');
    eq(target.ordinary, 1, 'target.ordinary');
  });

  // --- expanding a flat map into an existing object ---
  functionalCase('F-expand-basic', 'expanding a flat map preserves existing fields', () => {
    const target = { user: { role: 'admin' } };
    D.expand(target, { 'user.name': 'Jo', 'user.email': 'jo@example.com' });
    eq(target.user.role, 'admin', 'target.user.role');
    eq(target.user.name, 'Jo', 'target.user.name');
    eq(target.user.email, 'jo@example.com', 'target.user.email');
  });

  functionalCase('F-expand-delimiter', 'expanding with a caller-chosen separator still nests', () => {
    const target = {};
    D.expand(target, { user_name: 'Jo', user_email: 'jo@example.com' }, '_');
    eq(target.user.name, 'Jo', 'target.user.name');
    eq(target.user.email, 'jo@example.com', 'target.user.email');
  });

  functionalCase('F-expand-similar-names', 'expanding keeps names that merely resemble a prototype name', () => {
    const target = {};
    D.expand(target, { 'a.__proto__x.y': 1, plain: 'ok' });
    eq(target.a && own(target.a, '__proto__x') ? target.a['__proto__x'].y : undefined, 1,
      'target.a["__proto__x"].y');
    eq(target.plain, 'ok', 'target.plain');
  });

  // --- deleting at a path ---
  functionalCase('F-remove-basic', 'deleting an ordinary nested path keeps the siblings', () => {
    const data = { a: { b: 1, c: 2 } };
    D.remove(data, 'a.b');
    eq(own(data.a, 'b'), false, 'b being deleted');
    eq(data.a.c, 2, 'data.a.c');
  });

  functionalCase('F-remove-missing', 'deleting a missing path is a no-op', () => {
    const data = { a: { b: 1 } };
    D.remove(data, 'x.y.z');
    eq(data.a.b, 1, 'data.a.b');
  });

  functionalCase('F-remove-array-path', 'deleting with an array path still addresses ordinary names', () => {
    const data = { a: { b: 1, c: 2 } };
    D.remove(data, ['a', 'b']);
    eq(own(data.a, 'b'), false, 'b being deleted');
    eq(data.a.c, 2, 'data.a.c');
  });

  functionalCase('F-remove-final-field', 'deleting a final field resembling a built-in is ordinary data', () => {
    const data = { a: { prototype: 1, keep: 2 } };
    D.remove(data, 'a.prototype');
    eq(own(data.a, 'prototype'), false, 'prototype being deleted');
    eq(data.a.keep, 2, 'data.a.keep');
  });

  return cases;
};
