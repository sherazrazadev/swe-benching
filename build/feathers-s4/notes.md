# feathers-s4 — build notes

- Start: 2026-10-29T11:27:47Z
- End: 2026-10-29T13:01:40Z

## Task

`feathersjs/feathers` at `3c3da6d688e62a1f832f549d3271c80ce3a47b01` (v5.0.44), published fix
`28b3c03c63bdbff53115fdaa46c56980e7942acc` (merge guards only). Advisory GHSA-28XV-PH75-77WH /
CVE-2026-54335: prototype pollution (CWE-1321) in the shared recursive object merge.

Track: injected. Pattern: B. Source: mined + injected.

## Design

The property is written once over the outcome: no key from data a client or an upstream service
supplies may act as a prototype key — neither on the shared prototype all objects inherit nor on
the prototype of any object the framework builds, returns or stores, at any depth and in any
position. Every route and injected sibling falls under it as written; the instruction does not
describe where any of them lives.

Levers (one line each):

- T1 (report-led, real): `packages/commons/src/index.ts:75-89` — an own `__proto__` object from
  JSON reaches Object.prototype through the recursion, and a non-object `__proto__` value
  replaces the merge target's prototype. No reason to dismiss (the report leads here); the
  how-type part is the non-object shape plus the coupled merge contract that punishes a
  throw-on-name or shallow repair.
- T2 (uncovered, real): `packages/commons/src/index.ts:54-72` — `extend`/`omit`/`pick` apply no
  key discipline, so a source's own `__proto__` changes the prototype of the object they build;
  the adapter's flat `$select` projection reaches the same sink. Reason to dismiss: the advisory
  names the recursive merge, and Object.assign only changes the local result, never the shared
  prototype.
- T3 (uncovered, real): `packages/adapter-commons/src/query.ts:21-23,57-67,101` — caller query
  keys, nested values and `$sort` field names become property names with no filter. Reason to
  dismiss: it is query parsing, not merging, and the sanitized object is short-lived.
- T4 (injected sibling, how-type): `packages/adapter-commons/src/index.ts:37-76` — dotted
  `$select` support splits a field name on `.` and uses each part as a property name; the guard
  beside it checks only the first part, so `profile.__proto__` (and `profile.__proto__.x`, which
  reaches the shared prototype) get through. Reason to dismiss: the field looks checked, and a
  dotted path reads as data rather than a key. This is the separator-split / guard-on-the-wrong-
  representation shape.
- T5 (injected sibling, producer off the check's path): `packages/memory/src/index.ts:25-45` —
  a hand-written deep copy at the adapter's read boundary writes every stored key into a fresh
  object, so a stored own `__proto__` changes the prototype of every record the service returns,
  with or without projection. Reason to dismiss: the copy is not a merge, and the projection it
  feeds is a different layer. The copy is a producer that no check in the projection calls.

## Candidate list and why the picks beat the others

Every candidate site/route found (screener O8/O8b plus a search of `packages/*/src`):

1. `packages/commons/src/index.ts:75-89` `_.merge` — picked (T1).
2. `packages/commons/src/index.ts:54-56` `_.extend` (Object.assign) — picked (T2).
3. `packages/commons/src/index.ts:58-61` `_.omit` (built through extend) — covered by T2.
4. `packages/commons/src/index.ts:64-72` `_.pick` — picked (T2); also the sink of route 5.
5. `packages/adapter-commons/src/index.ts:12-29` `select($select)` — picked as the production route
   for T2 (flat) and extended by T4 (nested, injected).
6. `packages/adapter-commons/src/query.ts:23,57-67,101` `validateQueryProperty`/`getQuery`/`$sort` —
   picked (T3).
7. `packages/errors/src/index.ts:258-271` `convert(error)` (Object.assign of an upstream error
   payload) — real route, considered; dropped to keep the task within the fairness budget (a
   fourth package a blind engineer must search, for the same one-line key filter already tested
   in three places).
8. `packages/transport-commons/src/socket/utils.ts:108-110` socket params Object.assign — real
   route; dropped: it needs a socket.io server/client to reach, adding harness weight and a
   flaky network loopback for the same local-prototype outcome.
9. `packages/transport-commons/src/socket/utils.ts:21-27` `normalizeError` — writes
   `Object.getOwnPropertyNames(e)` into a fresh object; error properties are internal, not
   client data; dropped.
10. `packages/authentication-local/src/hooks/protect.ts:30` Object.assign over a service result —
    real route; dropped: deprecated hook, and the result data would first have to be stored with
    an own `__proto__` (which T5 already covers at the adapter boundary).
11. `packages/authentication-local/src/strategy.ts:59` `Object.assign({}, params, ...)` — real;
    dropped: local params clone, same one-line filter as T2, no distinct mechanism.
12. `packages/authentication-client/src/hooks/authentication.ts:21` Object.assign of an auth
    result — real; dropped: client-side package with a heavy setup for the same outcome.
13. `packages/schema/src/resolver.ts:168` `result[name] = value` with client data keys — probed:
    `resolvers['__proto__']` resolves to Object.prototype and the resolver call throws a
    BadRequest, so the route refuses instead of polluting; not a security route.
14. `packages/schema/src/hooks/resolve.ts:167-172` `res[key] = ...` over a resolved record —
    reached only after (13) succeeds, so an own `__proto__` record never gets there; dropped.
15. `packages/configuration/src/index.ts:16-24` config spreads — config is operator data, not
    client/upstream data; out of the property; dropped.
16. `packages/commons/src/debug.ts:16-23` debugger registry key copy — keys are developer
    namespace names, not request data; dropped.
17. `packages/memory/src/index.ts:24-28` JSON round-trip in `_select` — not itself vulnerable,
    but the producer next to it was replaced by the injected deep copy (T5).
18. Injected candidates considered and not used: a `_.defaults`/`_.deepCopy` helper in the
    public `_` bag (same file as the report — where-type, little added difficulty); a deep merge
    of environment config in `@feathersjs/configuration` (trusted config); a nested patch merge in
    the memory adapter (changes documented shallow-patch semantics and breaks project
    expectations); a nested `$select` projection (kept, T4); a record clone/sanitizer in the
    memory adapter (kept, T5).

T4 and T5 beat the other injected candidates because they are how-type: T4 requires checking
every path segment rather than the field string the report suggests, and T5 is a producer the
projection check never calls, in a different package from both the report and the projection.
The other injected candidates were where-type copies in the report's own file or changed trusted
input.

## Verified

- Pinned tree, hidden suites: 14/14 security fail, 19/19 functional pass.
- Oracle (`solution/fix.patch` = published merge fix + all route fixes): 14/14 security pass,
  19/19 functional pass.
- The project's own suites pass on pinned+injected and on the oracle: commons 20,
  adapter-commons 72, memory 149 (16 pending), run with the project's mocha/ts-node config.
- Every wrong-fix patch was applied to the pinned+injected tree and run with the same suites:
  - sf_miss_merge 3 security failing, functional all pass
  - sf_miss_copy 4 security failing, functional all pass
  - sf_miss_query 2 security failing, functional all pass
  - sf_miss_nested_select 1 security failing, functional all pass
  - sf_miss_clone 2 security failing, functional all pass
  - upstream_fix_only 11 security failing, functional all pass
  - ff_shallow_merge, ff_refuse_all, ff_deep_extend each break at least one functional test
  - hardening and alt_correct_fix each score 14/14 + 19/19
- `injection.patch` and `fix.patch` apply cleanly with `patch -p1` to the pinned commit, and
  applying both reproduces the oracle tree byte for byte.
- Current upstream (`dove`) still has the T2 and T3 sinks (no key filter in extend/omit/pick,
  query.ts, or the sort copy); `merge` is guarded. The T4/T5 code does not exist upstream.

## Not verified / unknowns

- Gate stages, all PASSED:
  - static: conformant, no leaks, manifest catalogue complete.
  - nop: 14 security tests fail on the untouched tree, 260 functional tests pass.
  - oracle: 3/3 runs reward 1.0, identical results.
  - patches: sf_miss_merge 3 security failing; sf_miss_copy 4; sf_miss_query 2;
    sf_miss_nested_select 1; sf_miss_clone 2; upstream_fix_only 11; ff_shallow_merge 2
    functional failing; ff_refuse_all 1; ff_deep_extend 1; hardening 1.0; alt_correct_fix 1.0.
- Target-model behaviour (the 3-run bar) is not measured here; no trials were run.
- `present_in_latest` was read from the `dove` branch head on 2026-10-29, not from a release tag.
- The nested projection (T4) changes the meaning of a `$select` entry that contains a literal
  dot; no project test or documented behaviour depends on a dotted literal field name.
- The record copy (T5) is equivalent to the JSON round-trip for JSON data; a record holding a
  non-JSON value (Date, undefined, function) would be copied differently, which no project test
  or hidden functional test exercises.

## Files

- `tasks/feathers-s4/environment/injection.patch` — the only source changes in the image.
- `tasks/feathers-s4/solution/fix.patch` — the oracle.
- `build/feathers-s4/checks/*.patch` — wrong-fix and pass patches (blind is written later).
