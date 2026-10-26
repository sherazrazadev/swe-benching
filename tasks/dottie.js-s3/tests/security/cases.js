'use strict';

/*
 * Security cases: a caller-supplied key, path or path part must never let an operation reach,
 * create or replace an object's prototype chain, and no caller-supplied value may become an
 * object's prototype.
 *
 * Every case drives a public entry point, tolerates any refusal shape (skip or ordinary error),
 * and judges only side effects: the prototype of each object the library touched, whether the
 * attacker's field is visible by inheritance while not being an own field, the language's shared
 * prototype, and, for deletion, whether the marker the caller never named still exists.
 *
 * All marker names and expected values are literals written here; no product code is used to
 * compute them or to clean up.
 */

function own(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function checkProtected(observations, marker, id) {
  for (const obs of observations) {
    const obj = obs.obj;
    if (obj === undefined || obj === null || typeof obj !== 'object') continue;
    const proto = Object.getPrototypeOf(obj);
    // An ordinary object, or a deliberately prototype-less container, is fine. Anything else
    // means the caller's name replaced this object's prototype with an object of its choosing.
    if (proto !== Object.prototype && proto !== null) {
      throw new Error(`${id}: ${obs.label} had its prototype replaced with a caller-chosen object`);
    }
    if (!own(obj, marker) && obj[marker] !== undefined) {
      throw new Error(`${id}: ${obs.label} exposes ${JSON.stringify(marker)} through inheritance`);
    }
  }
  if (({})[marker] !== undefined) {
    throw new Error(`${id}: the shared prototype of ordinary objects was modified`);
  }
}

module.exports = function (D) {
  const cases = [];

  // A generic pollution case: call the operation, then judge the observable outcome. Any
  // refusal shape is accepted; the shared-prototype marker is always cleaned up in `finally`
  // so one failing case cannot hide another.
  function securityCase(id, description, call, observe) {
    const marker = 'probe_' + id.replace(/[^A-Za-z0-9]+/g, '_');
    cases.push({
      classname: 'security/' + id,
      name: `${id}: ${description}`,
      run() {
        const target = {};
        let result;
        try {
          try {
            result = call(D, target, marker);
          } catch (e) {
            // Any refusal shape is acceptable; only side effects are judged below.
          }
          checkProtected(observe(D, target, marker, result), marker, id);
        } finally {
          delete Object.prototype[marker];
        }
      },
    });
  }

  // --- the reported route: a nested write with a prototype-bearing part at any position ---
  securityCase('T0-set-first', 'a first path part naming a prototype is not written',
    (D, t, m) => D.set(t, '__proto__.' + m, true),
    (D, t) => [{ label: 'target', obj: t }]);

  securityCase('T0-set-second', 'a second path part naming a prototype is not written',
    (D, t, m) => D.set(t, 'session.__proto__.' + m, true),
    (D, t) => [{ label: 'target', obj: t }, { label: 'session', obj: t.session }]);

  securityCase('T0-set-third', 'a third path part naming a prototype is not written',
    (D, t, m) => D.set(t, 'a.b.__proto__.' + m, true),
    (D, t) => [{ label: 'target', obj: t }, { label: 'a.b', obj: t.a && t.a.b }]);

  securityCase('T0-set-last', 'a final part naming a prototype is not used to replace a prototype',
    (D, t, m) => D.set(t, 'session.__proto__', { [m]: true }),
    (D, t) => [{ label: 'target', obj: t }, { label: 'session', obj: t.session }]);

  securityCase('T0-set-force', 'the force option does not open a prototype-bearing part',
    (D, t, m) => { t.session = null; D.set(t, 'session.__proto__.' + m, true, { force: true }); },
    (D, t) => [{ label: 'target', obj: t }, { label: 'session', obj: t.session }]);

  securityCase('T0-default-route', 'the default-value route is closed for a prototype-bearing part',
    (D, t, m) => D['default'](t, 'session.__proto__.' + m, true),
    (D, t) => [{ label: 'target', obj: t }, { label: 'session', obj: t.session }]);

  // --- path parts that are not strings, converted to a property name only on access ---
  securityCase('L3a-array-json', 'a path part parsed from JSON that names a prototype is not written',
    (D, t, m) => {
      const path = JSON.parse('{"parts":[["__proto__"],"' + m + '"]}').parts;
      D.set(t, path, true);
    },
    (D, t) => [{ label: 'target', obj: t }]);

  securityCase('L3a-array-middle', 'a non-string middle part naming a prototype is not written',
    (D, t, m) => D.set(t, ['session', ['__proto__'], m], true),
    (D, t) => [{ label: 'target', obj: t }, { label: 'session', obj: t.session }]);

  securityCase('L3a-array-last', 'a non-string final part is not used to replace a prototype',
    (D, t, m) => D.set(t, [['__proto__']], { [m]: true }),
    (D, t) => [{ label: 'target', obj: t }]);

  securityCase('L3a-array-converted', 'a part whose text names a prototype is not written',
    (D, t, m) => D.set(t, [{ toString: function () { return '__proto__'; } }, m], true),
    (D, t) => [{ label: 'target', obj: t }]);

  securityCase('L3a-default-array', 'the default-value route is closed for non-string parts too',
    (D, t, m) => D['default'](t, [['__proto__'], m], true),
    (D, t) => [{ label: 'target', obj: t }]);

  // --- the flat-object conversion's split branch, at every position ---
  securityCase('L6-transform-first', 'a converted key beginning with a prototype name is not written',
    (D, t, m) => D.transform({ ['__proto__.' + m]: true }),
    (D, t, m, r) => [{ label: 'result', obj: r }]);

  securityCase('L6-transform-second', 'a converted key with a second prototype-bearing part is not written',
    (D, t, m) => D.transform({ ['user.__proto__.' + m]: true, 'user.name': 'guest' }),
    (D, t, m, r) => [{ label: 'result', obj: r }, { label: 'user', obj: r && r.user }]);

  securityCase('L6-transform-third', 'a converted key with a third prototype-bearing part is not written',
    (D, t, m) => D.transform({ ['a.b.__proto__.' + m]: true }),
    (D, t, m, r) => [{ label: 'result', obj: r },
                     { label: 'a.b', obj: r && r.a && r.a.b }]);

  securityCase('L6-transform-last', 'a converted key ending with a prototype name is not used as a prototype',
    (D, t, m) => D.transform({ 'user.__proto__': { [m]: true } }),
    (D, t, m, r) => [{ label: 'result', obj: r }, { label: 'user', obj: r && r.user }]);

  securityCase('L6-transform-one-arg', 'the one-argument conversion call is closed too',
    (D, t, m) => D({ ['user.__proto__.' + m]: true }),
    (D, t, m, r) => [{ label: 'result', obj: r }, { label: 'user', obj: r && r.user }]);

  // --- a caller-chosen separator ---
  securityCase('L3b-transform-delimiter', 'a caller-chosen separator does not open a prototype-bearing part',
    (D, t, m) => D.transform({ ['user/__proto__/' + m]: true }, { delimiter: '/' }),
    (D, t, m, r) => [{ label: 'result', obj: r }, { label: 'user', obj: r && r.user }]);

  // --- a key without the separator, copied verbatim ---
  securityCase('L1-transform-plain', 'a lone prototype key parsed from JSON is not used as a prototype',
    (D, t, m) => D.transform(JSON.parse('{"__proto__":{"' + m + '":true}}')),
    (D, t, m, r) => [{ label: 'result', obj: r }]);

  securityCase('L1-transform-plain-sibling', 'a lone prototype key next to a legitimate key is not written',
    (D, t, m) => D.transform(JSON.parse('{"__proto__":{"' + m + '":true},"user.name":"guest"}')),
    (D, t, m, r) => [{ label: 'result', obj: r }, { label: 'user', obj: r && r.user }]);

  securityCase('L1-transform-plain-array', 'a lone prototype key inside an array input is not written',
    (D, t, m) => D.transform([JSON.parse('{"__proto__":{"' + m + '":true}}')]),
    (D, t, m, r) => [{ label: 'result[0]', obj: r && r[0] }]);

  securityCase('L1-transform-plain-one-arg', 'the one-argument conversion call is closed for a lone key',
    (D, t, m) => D(JSON.parse('{"__proto__":{"' + m + '":true}}')),
    (D, t, m, r) => [{ label: 'result', obj: r }]);

  // --- expanding a flat map into an existing object ---
  securityCase('L7-expand-first', 'expanding a flat map with a first prototype-bearing part is not written',
    (D, t, m) => D.expand(t, { ['__proto__.' + m]: true }),
    (D, t) => [{ label: 'target', obj: t }]);

  securityCase('L7-expand-middle', 'expanding a flat map with a middle prototype-bearing part is not written',
    (D, t, m) => D.expand(t, { ['section.__proto__.' + m]: true }),
    (D, t) => [{ label: 'target', obj: t }, { label: 'section', obj: t.section }]);

  securityCase('L7-expand-last', 'an expanded final prototype name is not used as a prototype',
    (D, t, m) => D.expand(t, { 'section.__proto__': { [m]: true } }),
    (D, t) => [{ label: 'target', obj: t }, { label: 'section', obj: t.section }]);

  securityCase('L7-expand-delimiter', 'a caller-chosen separator does not open a prototype-bearing part when expanding',
    (D, t, m) => D.expand(t, { ['section/__proto__/' + m]: true }, '/'),
    (D, t) => [{ label: 'target', obj: t }, { label: 'section', obj: t.section }]);

  // --- combining nested data ---
  securityCase('L4-merge-plain', 'combining an own prototype key from parsed data does not reach a prototype',
    (D, t, m) => D.merge(t, JSON.parse('{"__proto__":{"' + m + '":true}}')),
    (D, t) => [{ label: 'target', obj: t }]);

  securityCase('L4-merge-nested', 'a nested own prototype key in combined data does not reach a prototype',
    (D, t, m) => { t.section = {}; D.merge(t, JSON.parse('{"section":{"__proto__":{"' + m + '":true}}}')); },
    (D, t) => [{ label: 'target', obj: t }, { label: 'section', obj: t.section }]);

  // --- deleting at a path ---
  // A caller-supplied prototype object: the marker sits on the prototype, never named as data.
  {
    const id = 'L5-remove-local';
    const marker = 'probe_' + id.replace(/[^A-Za-z0-9]+/g, '_');
    cases.push({
      classname: 'security/' + id,
      name: `${id}: deleting at a path cannot remove a field from a caller-supplied prototype`,
      run() {
        const proto = { [marker]: true, keep: true };
        const holder = { section: Object.create(proto) };
        try {
          D.remove(holder, 'section.__proto__.' + marker);
        } catch (e) {
          // Any refusal shape is acceptable.
        }
        if (!own(proto, marker)) {
          throw new Error(`${id}: a caller-supplied path deleted a field from a prototype object`);
        }
      },
    });
  }

  // The inherited constructor function leads to the language's shared prototype; a delete there
  // removes a field the caller never addressed. The marker is created and removed by this case.
  {
    const id = 'L5-remove-shared';
    const marker = 'probe_' + id.replace(/[^A-Za-z0-9]+/g, '_');
    cases.push({
      classname: 'security/' + id,
      name: `${id}: deleting at a path cannot remove a field from the shared prototype`,
      run() {
        Object.defineProperty(Object.prototype, marker, {
          value: true, writable: true, configurable: true, enumerable: false,
        });
        let present;
        try {
          try {
            D.remove({}, 'constructor.prototype.' + marker);
          } catch (e) {
            // Any refusal shape is acceptable.
          }
          present = own(Object.prototype, marker);
        } finally {
          delete Object.prototype[marker];
        }
        if (!present) {
          throw new Error(`${id}: a caller-supplied path deleted a field from the shared prototype`);
        }
      },
    });
  }

  return cases;
};
