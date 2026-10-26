# dottie.js-s3 — build notes

Started (UTC): 2026-10-26T20:08:09Z
Finished (UTC): 2026-10-26T20:27Z

Task: build-v1, pattern B, track injected.
Advisory: GHSA-4gxf-g5gf-22h4 / GHSA-r5mx-6wc6-7h9w (CWE-1321 prototype pollution through
caller-chosen path segments). Repo mickhansen/dottie.js. Pinned b48e22714aae4489ea6276452f22cc61980ba5a4.
Published fixes 7d3aee1c9c3c842720506e131de7e181e5c8db68 (first-segment guard) and
7e8fa1345a4b46325f0eab8d7aeb1c4deaefdb14 (all-segment guard in the nested write and in the
flat-object conversion). At the pinned commit neither function has any guard.

The pinned tree is one 227-line ES5 UMD module. A previous stacking task for the same advisory
(`stk-dottie-js-ghsar5mx`, pattern A+B, no injection) was gated green on 2026-10-23; its register
rows are T4 (separator-free own `__proto__` key) and T5 (raw array-part comparison). This task is
a separate slug on the injected track: real upstream routes plus three maintained sibling
helpers added to our copy, and a functional boundary (final names stay data) that the published
all-names-everywhere guard gets wrong.

## Plan (written before building)

### Product story and the one property

The project is a small JavaScript library for reading, writing, reshaping and deleting nested
values in plain objects from dotted key paths. Callers hand it names and values that come from
end users (settings maps, stored JSON, request payloads). A name must never become a way to
write through, into or onto an object's prototype.

Property, stated once in the report:

> No caller-supplied key, path or part of one may reach, create or replace an object's prototype
> chain. No operation may add, change or delete anything on a prototype, and no caller-supplied
> value may become an object's prototype. This holds for every public operation that accepts a
> caller-supplied key or path, wherever the name appears and however the caller supplies it.

Refusal contract: an unsafe name is skipped (an ordinary error is also acceptable for a
single-value call); the call keeps going, and every other key in the same input keeps its
ordinary result. Preservation contract: a final name is ordinary data unless writing it would
itself change a prototype, so ordinary final field names (including names that merely resemble a
built-in object concept) keep being stored and returned.

### Levers, each with a different reason to dismiss

Main lever (HOW-type, route where protection never existed):
- L1 `T4` — the conversion's separator-free branch copies an own key as an ordinary field. An
  own `__proto__` key (exactly what `JSON.parse` produces) goes through the prototype setter and
  replaces the returned object's prototype, while a guard placed inside the split branch never
  sees it. A solver who treats "no separator" as "not a path" leaves it open; both published
  fixes leave this branch untouched and current upstream 2.0.7 still does.
  where: dottie.js:161-162 (pinned), reached through the conversion call and its one-argument form.
  Reason to dismiss: a key with no separator is a verbatim copy, not path expansion, and it only
  touches the fresh result object.

Other lever with a different reason (HOW-type, coupled must-keep-working):
- L2 `boundary` — the refusal must be scoped. A final name that is ordinary data (the value being
  stored under `prototype`/`constructor`, e.g. a config field) must still be stored; and one
  refused key must not abort the conversion or drop the surrounding keys/records. The published
  all-names guard blocks final names; a `break`/`throw` guard aborts the call.
  where: dottie.js:74-107 and 138-164 (pinned), and the reference guard site.
  Reason to dismiss: blocking more looks strictly safer, and the solver only re-runs the attack,
  never the legitimate map.

More levers:
- L3a `shape-coercion` (HOW-type shape) — an array path part that is not a string is converted to
  a property name only on property access. `['session', ['__proto__'], marker]` pollutes while a
  guard comparing the raw parts (`===`, `indexOf`, `includes`) sees nothing. A correct guard
  compares the converted property name. where dottie.js:74,81,86,89. Reason to dismiss: array
  paths are documented as arrays of strings.
- L3b `shape-delimiter` — the conversion splits on a caller-chosen separator. A guard that
  hardcodes `.` (or checks the raw key) misses `{'user/__proto__/x': 1}` with
  `{delimiter:'/'}`. where dottie.js:141-143. Reason to dismiss: the documented form is the
  default dot.
- L4 `sibling-merge` (injected, HOW-type) — a maintained deep-combine helper walks the source's
  own keys and recurses whenever `target[key]` is an object. For an own `__proto__` key (from
  parsed JSON) `target['__proto__']` resolves to `Object.prototype`, so the recursion writes a
  caller key onto the language's shared prototype. This is a different mechanism from path
  segments: a literal own key plus inherited resolution. where dottie.js new `Dottie.merge`.
  Reason to dismiss: combining plain nested objects parses no path.
- L5 `sibling-remove` (injected, HOW-type) — a maintained path-deletion helper walks parts with
  no type check, so `constructor.prototype.marker` steps through the inherited `Object` function
  and deletes the marker from `Object.prototype`. Deletion is an outcome the "pollution" framing
  hides. where dottie.js new `Dottie.remove`. Reason to dismiss: deletion cannot inject a value.
- L6 `second-implementation` (Pattern A/B) — the conversion runs its own split-and-walk. A fix
  placed only in the nested write never reaches it. where dottie.js:141-156. Reason to dismiss:
  the report shows the nested write, so the conversion reads as a different feature.

Coupled must-keep-working values (functional):
- ordinary nested writes/creates, the `force` option over null/non-objects and the existing throw;
- array paths whose parts contain the separator or are non-strings but name ordinary keys
  (a guard that joins and re-splits breaks these);
- a custom separator still nests; conversion of an array of records still converts each record;
- the null-intermediate break in the conversion keeps its behaviour;
- final field names that are ordinary data (`prototype`, `constructor`, similar names) still bind,
  in the write, the conversion, the combine and the delete helpers;
- one refused key next to legitimate keys leaves all legitimate keys untouched, including the
  second record of an array input;
- combine merges nested objects/primitives/arrays and keeps target values; expand merges a flat
  map into an existing target and preserves existing fields; delete removes an ordinary nested
  path and is a no-op on a missing path;
- the project's own Mocha suite (46 cases).

Legitimate magnitude next to the attack: a ten-level ordinary path, and an array part containing
the separator, are ordinary values; only names that reach/replace a prototype are refused.

### Injected sibling candidates found (all of them), and why the picks won

Screener O8/O8b leads plus my own search of the file:
1. `Dottie.transform` separator-free branch (real upstream) — picked as L1 (main).
2. `Dottie.transform` split branch (real upstream, second implementation) — picked as L6.
3. `Dottie.set` raw array parts (real upstream) — picked as L3a.
4. `Dottie.transform` caller separator (real upstream) — picked as L3b.
5. `Dottie['default']` wrapper — delegates to the nested write; a guard at the shared write covers
   it, so it is a test of layer placement, not a sibling gap. Kept as an input route only.
6. `Dottie.get` memo cache keyed by the raw path (`memoized[path]`): `__proto__`/`constructor`
   paths read `Object.prototype`/`Object` and then `.slice` throws. A read-side crash/DoS, not a
   prototype write; the advisory's property is about modification. Rejected (noted out of scope).
7. `Dottie.flatten`/`Dottie.paths` enumerate inherited properties (`for..in` without an own
   guard in `paths`). Read-only information exposure, no prototype modification. Rejected.
8. `Dottie.flatten` copying an own `__proto__` key: a non-object value is ignored by the setter;
   `null` sets the fresh result's prototype to null, and objects recurse into `__proto__.x`
   string keys. Weak, fresh-object-only, and the helper is a read/reshape utility. Rejected.
9. Inject a flat-map `expand` helper (inverse of flatten) — picked as L2/I2 below.
10. Inject a fill-missing `defaults(object, flat)` walk — the same segment-walk concept as the
    write/conversion; a guard at the shared walk covers it, and a separate copy is an unrealistic
    duplicate. Rejected as redundant.
11. Inject a deep `clone` — literal `__proto__` sets only the clone's prototype; same literal-key
    concept as merge with a weaker outcome. Rejected.
12. Inject `setMany`/`assign` batch wrapper — either delegates to the write (auto-covered) or
    duplicates the walker for no plausible reason. Rejected.
13. Inject a bracket-notation query parser — a different input syntax unrelated to the library's
    documented dotted-path feature; a second parsing concept, less realistic here. Rejected.

Picked injected siblings: `merge` (L4), `expand`, `remove` (L5).
- `merge` (L4) beats the others because its mechanism is different (literal own key + inherited
  target resolution) and it reaches the *shared* `Object.prototype` in one call; a segment-name
  guard alone does not cover it.
- `remove` (L5) beats `defaults`/`clone` because the outcome is deletion on a shared prototype
  reached through the inherited constructor function: a how-type mechanism with a dismissal
  ("deletion cannot inject") that the other candidates do not have.
- `expand` beats the remaining walker candidates because it is the natural symmetric helper of
  the maintained `flatten` (the screener's O8b lead), it is reachable through a real exported
  entry point, and its traversal differs from the write/conversion: it only creates a namespace
  when the current value is not an object, so an inherited prototype is traversed rather than
  overwritten and the caller's key lands on the shared prototype. Its dismissal is "it is
  flatten's inverse, a reshaping helper", distinct from the other two.
The three are placed after `transform` and after the default route; they are documented in the
README like the rest of the API, contain no test code, and are not touched by either published
fix.

### Sites, routes and shapes the security tests cover

- nested write (and its default-value delegate): `__proto__` at first/middle/final position,
  with and without `force`, string and array paths (T0).
- array paths whose part is an array or an object whose text is `__proto__`, including a path
  parsed from JSON (L3a).
- conversion: dotted key first/middle/final (L6); caller separator (L3b); one-argument callable
  form (L6); separator-free own `__proto__` key alone, next to a legitimate key, and inside an
  array input (L1).
- combine: own `__proto__` key at top level and nested into an existing object (L4).
- delete: `a.__proto__.marker` on a caller-supplied prototype, and
  `constructor.prototype.marker` on the shared prototype (L5).
Every case goes through a public entry point, catches any refusal shape, and judges only side
effects (prototype identity, inherited visibility, shared-prototype state, residual marker).

### Verification limits

- No target model is run here (per the build prompt); the bar is estimated from the lever design.
- `present_in_latest` was checked by reading current upstream `dottie.js` (2.0.7): the
  separator-free branch is still unguarded, and the all-segment guard still compares raw parts.
- Docker/Harbor gate stages are the only end-to-end verification available on this machine.

## Build record

### What was built

- `tasks/dottie.js-s3/environment/injection.patch` — adds three maintained helpers to the pinned
  copy (`Dottie.remove`, `Dottie.expand`, `Dottie.merge`) plus their README sections. Nothing is
  shipped upstream; no test code is added to the image.
- `tasks/dottie.js-s3/instruction.md` — 450 words. Product story, one write trigger
  (`profile.__proto__.isAdmin`), the invariant stated once, the refusal/boundary/preservation
  contracts, and the standard constraints. No function, file or package name of a far site.
- `tasks/dottie.js-s3/solution/fix.patch` — the reference fix: shared predicate
  (`String(part)`, `__proto__` anywhere, `constructor`/`prototype` only as a non-final part)
  applied to the nested write, both conversion branches, expansion, combine and deletion.
- `tests/support/runner.js`, `tests/security/cases.js` (29 cases), `tests/functional/cases.js`
  (33 cases), `tests/functional/project/` (the pinned Mocha suite, 46 cases),
  `tests/functional/project.js`, `tests/test.sh`, `tests/Dockerfile`, `tests/score.py` (template,
  unchanged).
- `build/dottie.js-s3/checks/` — 14 patches (see `manifest.patch_checks`; `blind.patch` is left to
  `run_blindfix`).

### Verified

Local run with the exact verifier runner and cases (Node 22) against the injected pinned tree and
every variant:

| variant | security | functional |
|---|---|---|
| pinned+injected (nop) | 0/29 | 79/79 |
| reference | 29/29 | 79/79 |
| alternative (descriptor/own-property design) | 29/29 | 79/79 |
| hardening | 29/29 | 79/79 |
| sf_literal | 25/29 | 79/79 |
| sf_transform_split | 23/29 | 79/79 |
| sf_coercion | 24/29 | 79/79 |
| sf_delimiter | 28/29 | 79/79 |
| sf_merge | 27/29 | 79/79 |
| sf_remove | 27/29 | 79/79 |
| sf_expand | 25/29 | 79/79 |
| sf_set_only | 11/29 | 79/79 |
| reads_only | 0/29 | 79/79 |
| ff_overbroad_names | 29/29 | 76/79 |
| ff_refuse_all | 29/29 | 78/79 |
| ff_throw | 29/29 | 78/79 |

Every patch applies to the injected tree with `patch -p1`, and each generated patch file was
re-checked to reproduce exactly its variant. `npm ci` and the pinned Mocha suite (46 passing) were
run on a clean pinned checkout.

Gate stages (Harbor, separate verifier, non-root, offline), run one at a time in order:

- `static` PASS (conformance, canary GUIDs, no hidden-test leak, leak terms, catalogue, hardening
  and blind entries).
- `nop` PASS (29/29 security fail, 79/79 functional pass).
- `oracle` PASS (3/3 identical, reward 1.0, 108 tests each).
- `patches` PASS 14/14 with the declared expectations (counts above).
- Consolidated full run (`gate.py dottie.js-s3`, all four stages in order): PASS, exit 0,
  `build/dottie.js-s3/gate_report.json`.

### What could not be verified

- No target model was run (the build prompt forbids it), so the bar is a design estimate: the
  main lever is the real upstream branch DeepSeek missed 6/6 in the O8 register, the shape lever is
  the raw-part comparison the complete published fix still misses, and the over-broad final-name
  contract punishes a deny-list-everywhere fix.
- `present_in_latest` for L1/L3 was read from current upstream `dottie.js` (2.0.7) only; no release
  or tag history was inspected.
- The blind-patch and fairness review are produced after this build.

### Out of scope (not built on)

- `Dottie.get`'s path memo reads `memoized[path]` off a plain object, so `get(obj,'__proto__')` and
  `get(obj,'constructor')` throw instead of returning; that is a read-side crash/DoS, not a
  prototype write, and no test exercises it.
- `Dottie.flatten`/`Dottie.paths` enumerate inherited properties (`paths` has no own-property
  filter); information exposure, not prototype modification.
- On a fresh plain object, `constructor`/`prototype` segments are overwritten with new own objects
  by the write and conversion, so they are not independently exploitable there; they are exercised
  only where a real prototype is reachable (deletion through the inherited constructor, and the
  final-name boundary).
- The pinned+injection tree intentionally does not contain the advisory's regression tests (they
  first appear in the fix commits).
