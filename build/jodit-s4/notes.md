# jodit-s4 — build notes (build-v1, pattern B, track injected)

Started: 2026-10-29T11:43:39Z (from build/jodit-s4/start_utc.txt)
Plan written: 2026-10-29T11:52:00Z, before the task tree or the injection was built.

## Advisory and pinned state (verified by reading source)

- Advisory: GHSA-5957-5C94-3V7W / CVE-2026-54756, xdan/jodit, CWE-1321 (prototype pollution in the
  recursive configuration merge).
- Pinned (vulnerable): 3b75c6661940424b6693c1640edbd8ca0ce8da2d. Fix: d298397bc993793b17145806c15f7dae53f90104.
  Both commits exist in the upstream clone. The fix touches only `src/core/helpers/utils/config-proto.ts`
  plus a test file, `test/loader.js` and `CHANGELOG.md`. It filters `__proto__`, `constructor` and
  `prototype` at every level of `ConfigMerge` and `ConfigProto`.
- Verified by direct execution against the pinned source (tsx probe, 2026-10-29):
  - `ConfigMerge({controls:{}}, JSON.parse('{"controls":{"__proto__":{"polluted":"yes"}}}'))`
    writes an own enumerable `polluted` property onto `Object.prototype`.
  - `ConfigProto` (the editor-creation merge) is behaviourally inert as a global sink: it writes the
    `__proto__` value into a fresh object and then replaces that object's prototype with the defaults
    prototype, so no observed global value changes before/after the published fix.
  - `Jodit.modules.Helpers.set('__proto__.setpolluted','yes',{})` writes onto `Object.prototype`.
  - A `constructor` -> `prototype` chain on a plain target does not reach `Object.prototype`
    (`target.constructor` is the `Object` function, not a plain object); the published filter is
    defence in depth, and no security test asserts something that already passes at the pinned commit.

## The one property (stated once in the report)

No value supplied by the application, parsed from data it processes, or handed to the library
through any of its public entry points may cause a property to be added to or changed on an object
that the caller did not supply and the library does not own; this holds in particular for the
prototypes shared by all JavaScript objects. Refusing the value (throw or leave it out) is allowed.
Everything that works today keeps working; partial option objects still merge with what they extend
and values marked atomic still replace.

The report's trigger is `Jodit.configure(JSON.parse(untrustedConfigurationJson))` with the
`__proto__` group nested under an existing plain-object option (`controls`) - the shape that reaches
`Object.prototype`.

## Levers

| id | kind | where (pinned tree) | mechanism | why a solver skips it |
|----|------|---------------------|-----------|------------------------|
| T0 | reported / published site, shape (depth) | src/core/helpers/utils/config-proto.ts:146-157 (ConfigMerge, reached by Jodit.configure src/jodit.ts:256-257) | recursive in-place merge; `target[key]` for `__proto__` resolves to `Object.prototype`, which `isPlainObject` accepts, so the recursion writes there | a guard placed once at the top of configure / once before the loop still recurses from the nested payload; the published example is nested one level |
| T1 | Pattern B real route, protection never existed | src/core/helpers/utils/set.ts:30-53 | public dotted-path writer: `result['__proto__']` is `Object.prototype`, `isPlainObject` accepts it, so the next segment is written there | "a path-writer whose dotted chain is developer-supplied, not configuration merging"; upstream itself only fixed this a week later (95692cee), after the advisory's fix |
| T2 | injected sibling, how-type (second merge sink) | src/core/storage/engines/local-storage-provider.ts:57-69 | stored value is deep-merged into the freshly parsed root when both sides are plain objects; `json['__proto__']` is `Object.prototype`, so a stored partial object writes there | "a key/value store, not configuration merging; storage layer" |
| T3 | injected sibling, how-type (different primitive) | src/core/global.ts:61-69 via new public static src/jodit.ts:271 | language-pack registration merges each pack with `Object.assign(lang[code], pack)`; `lang['__proto__']` is `Object.prototype`, so `Object.assign` writes the pack's keys there | "language resources, not editor options; the key is a language identifier" |

T1 is the how-type main lever (route where the protection never existed). T2/T3 are different sinks
from T1 (local recursive merge / Object.assign), so a fix at one does not close the others; hardening
`isPlainObject` to reject `Object.prototype` closes T0/T1/T2 but not T3, which is intended (T3 needs
its own key decision). T0's depth shape is covered by tests at depths 1 and 3.

## Candidate search (every site/route found, and why it was kept or dropped)

Real upstream code:
1. `ConfigMerge` via `Jodit.configure` - reported, fixed. KEPT (T0).
2. `ConfigProto` via `Jodit.make` and every component's own option merge - fixed; inert as a global
   sink (verified). KEPT as published-fix surface, not as a security lever.
3. `Helpers.set` dotted path writer - real, unprotected at the pinned commit; upstream fixed it in
   95692cee on 2026-06-16 with the same key list. KEPT (T1).
4. `extendLang` (`Object.assign(lang[key], pack)`) - at the pinned commit it is only called by bundled
   plugins with static dictionaries; not a public entry point and no untrusted input. DROPPED as a
   route; the primitive is reused for the injected public wrapper (T3), which is our code only.
5. `parseQuery` - writes decoded query keys into a fresh object; `__proto__` hits the setter and is
   ignored/string-valued; no recursion. Not a sink. DROPPED.
6. `LocalStorageProvider.set` - `json[key] = value` on a freshly parsed root: `__proto__` only changes
   the parsed root's prototype and `JSON.stringify` drops it. Not a sink at the pinned commit; the
   injected partial-update merge turns it into a sink. KEPT as injected (T2).
7. `AsyncStorage` / `IndexedDBProvider` - keyed store, no merge. DROPPED.
8. `FileBrowserItem` constructor copy - copies keys onto `this`; `__proto__` sets the instance
   prototype, never `Object.prototype`; the builder is not re-exported through `jodit/modules`.
   DROPPED (not reachable, not a global sink).
9. `observable` / `initAccessors` - `Object.defineProperty(dict, key, ...)` creates an own
   `__proto__` data property; no global write. DROPPED.
10. `dataBind` - per-element WeakMap store; `store['__proto__']` sets that store object's prototype
    only. DROPPED.
11. `ConfigProto` preset branch - copies preset keys into the caller's options object; no recursion
    into `Object.prototype`. DROPPED.
12. `Config` constructor `Object.assign(this, ConfigPrototype)` - fixed internal source. DROPPED.
13. `Ajax.__buildParams` - serialises, never writes into shared objects. DROPPED.
14. `Jodit.configure` with a *top-level* `__proto__` - only re-prototypes the library-owned
    `defaultOptions` singleton (config inheritance), not `Object.prototype`; not covered by the
    property as written and not tested. DROPPED.
15. `ConfigFlatten` / `ConfigDeepFlatten` - build fresh objects; `__proto__` re-prototypes the fresh
    result only. DROPPED.
16. `Object.assign(this.state, options)` in UI form inputs - target is a component-owned fresh state
    object; `__proto__` re-prototypes that object only. DROPPED.
17. `src/polyfills.ts` `Object.assign` fallback - only installed when the native function is missing
    (never in the test browser), and it writes onto its target. DROPPED.

Injected sibling candidates and picks:
- Storage partial-update merge (T2) - PICKED. Kept-value coupling (two partial stores keep earlier
  fields) makes an over-broad "refuse object values" fix fail.
- Public language-pack registration wrapper around `extendLang` (T3) - PICKED. Different primitive
  (Object.assign), different data kind, different reason to dismiss; legitimate pack merge is the
  coupled value.
- File-browser per-source item defaults merge - plausible but needs a real file-browser/Ajax round
  trip to drive, and its natural target (the item object) does not reach `Object.prototype` without a
  contrived shared target. DROPPED (complexity without realism).
- `initOptions` restore-saved-options merge - overlaps T2's "stored settings" idea and needs a new
  public option; a solver who finds one would find the other. DROPPED (same dismissal reason as T2).
- A second dotted-path writer for query-string options - second copy of T1's concept; counts only as
  a search, and adds no new mechanism. DROPPED.
- `dataBind`/`observable` merges - contrived, and no global outcome. DROPPED.

## Sites, routes and input shapes the security tests cover

- T0: `Jodit.configure` with a JSON-parsed nested `__proto__` at depth 1 (the reported trigger) and
  depth 3; `Helpers.ConfigMerge` called directly with a nested payload.
- T1: `Helpers.set` with a leading `__proto__`, a nested `a.__proto__.x`, and a numeric segment
  (`__proto__.0.x`); each writes an own property onto `Object.prototype` at the pinned commit.
- T2: `LocalStorageProvider.set('__proto__', <parsed object>)`.
- T3: `Jodit.extendLanguages(JSON.parse('{"__proto__":{...}}'))`.
All security tests assert the shared object is unchanged (no own property on `Object.prototype`,
`({})[marker] === undefined`) and accept a throw as refusal (the side effect is what is asserted).
None asserts one exact status or one exact exception.

## Coupled must-keep-working behaviour (functional)

- T0: the project's own ConfigProto / ConfigMerge / Jodit.configure suites
  (`src/core/helpers/helpers.test.js`, pristine copy), plus editor creation over the prototype-chain
  defaults and `Jodit.atom` replacement.
- T1: ordinary dotted writes, numeric segments creating arrays, writing into an existing nested
  object without dropping siblings, empty/non-string chains as no-ops.
- T2: storing primitives, storing an object then a partial object keeps the earlier fields, distinct
  keys and the sessionStorage strategy stay independent.
- T3: registering a new pack and partially overriding an existing one merges as today.

## Test runtime (verified)

- Native build `make build es=es2015 uglify=false isTest=true stat=false` takes ~5 s after `npm ci`
  and emits `build/es2015/jodit.js` (UMD, global `Jodit`).
- Karma + ChromeHeadlessNoSandbox loads that bundle; a JUnit-XML reporter writes the results. Verified
  a probe that reads `Jodit.modules.Helpers`, `LocalStorageProvider` and pollutes through `set`.
- The project's own ConfigMerge/Jodit.configure tests run green (12 tests) with
  `test/chai/chai.min.js`, a 1-line CommonJS shim before `synchronous-promise/index.js`,
  `test/bootstrap.js` and a mocha grep; verified on 2026-10-29.

## Fairness and unknowns

- Fairness: the property names no route, module, kind of data or stage; every lever is reachable from
  the public API and discoverable by auditing the merge/write primitives in the code. The real route
  (T1) was independently fixed upstream after the advisory, which is evidence it is a genuine,
  reachable flaw at the pinned commit.
- The blind-fix agent's results and the target-model trials are downstream; not run here.
- Whether a hidden test can discriminate the ConfigProto site: no, by reading and by the probe above
  (it is inert); the oracle keeps the published filter there as defence in depth but no test relies
  on it.

## Build result (2026-10-29, end of build)

Finished: 2026-10-29T12:33:08Z (build started 11:43:39Z; the four gate stages passed on the final artifacts).

Gate stages, each run on the final artifacts, in order, one at a time:
- static PASSED;
- nop PASSED: 9/9 security tests fail on the injected vulnerable tree, 39/39 functional pass (8 hidden + 31 project);
- oracle PASSED: 3/3 identical runs at reward 1.0 (9 security + 39 functional each);
- patches PASSED 11/11 as declared: published_fix_only 0.3333 (T1,T2,T3 fail), miss_merge 0.6667 (T0 fails),
  miss_set 0.6667 (T1 fails), miss_storage 0.7778 (T2 fails), miss_language 0.8889 (T3 fails),
  wrong_resource security_fail (the three set-route tests), refuse_all / ff_overbroad / adjacent_api
  functional_fail, hardening and alt_sanitize reward 1.0.

Two build-time corrections worth recording:
- The first `alt_sanitize.patch` was produced from a working tree where its new helper file was untracked, so
  `git diff` omitted it and the verifier build failed with "Can't resolve". The patch was regenerated with the
  file staged for diff (`git add -N`) and re-verified locally and through Harbor.
- test.sh timeouts were reduced to 300/600/900 s (TEST/BUILD/SUITE) so BUILD_TIMEOUT + SUITE_TIMEOUT = 1500 s stays
  under `[verifier].timeout_sec` = 1800 s. The observed build takes about 10 s and the three suite runs about a minute.

## What I could not verify

- The blind-fix patch and the target-model trials are downstream; not run here (and the prompt forbids running them).
- Whether the two target models fail: that is the trial's job, not this build's.
- ConfigProto remains behaviourally indistinguishable before/after its guard (by reading and by the probe); the oracle
  keeps the published filter there as defence in depth, but no test relies on it.
- Upstream `present_in_latest` was read from the local clone of current main (2026-10-29): both the configuration
  merge and the dotted-path writer carry unsafe-key filters there; the stored-settings merge and the public
  language-registration helper are our injections and do not exist upstream.
