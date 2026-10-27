# jsonpath-s3 — build notes

- Start: 2026-10-27T09:48:37Z
- End: 2026-10-27T10:16:58Z
- Pattern A, injected track. Pinned `f20be141062453c26281e8d5ee8684cad62a1e35`; published fixes
  `6b2f1b4c`, `b70aa713`, `73ad72e5`, `30942896` (in that order; the pin is their common ancestor).

## Levers (one line each)

1. **T1 — how-type main, the interpreter's own mechanism.** The safe interpreter must refuse host
   reachability through identifier lookup and through the key that the property access actually
   uses: a member-name denylist still allows a bare identifier resolved through the sandbox
   object's prototype (which reaches the host function constructor through property descriptors)
   and a computed array key that coerces to a blocked name only at the property read, after the
   check. File: `src/jsonpath-node.js:5` (reported alias); the evaluator a solver reuses or copies
   is `src/jsonpath-browser.js:133-151`; the reference shared interpreter is `src/Safe-Script.js`.
   Dismiss reason: the reported vector is a member read, so a name denylist looks complete and the
   browser interpreter already looks safe.
2. **T2 — pattern A far site, second implementation.** The browser bundle carries its own AST
   evaluator and script export (`src/jsonpath-browser.js:44-203,266-274`). Dismiss reason: the
   example is Node and the browser already avoids `eval`/`Function`.
3. **T3 — pattern A far site, lower-level public API.** The package's exported script class is the
   host VM's script class (`src/jsonpath-node.js:7-11`; the browser entry exports its own at
   `src/jsonpath-browser.js:274`), so a caller-supplied expression through that API runs natively.
   Dismiss reason: it reads as an internal helper equal to the platform's own class.
4. **T4 — injected how-type, producer off the check's path.** A public ahead-of-time preparation
   helper (`src/jsonpath.js:693-740`) compiles expressions with the native compiler into the
   package-global script cache; the safe evaluation path (`src/jsonpath.js:645-682`) reuses a cache
   entry without checking who produced it, so an expression accepted and stored earlier runs later.
   Dismiss reason: preparation looks like a performance helper for trusted stored queries while
   the report describes a live path string.
5. **T5 — injected, route where the protection never existed.** The edge/worker subpath build
   (`src/jsonpath-edge.js:1-38`) installs its own Function-based script class as the safe
   evaluator. Dismiss reason: a separate build for runtimes without the Node VM looks like an
   opt-in platform path, and workers are assumed isolated.
6. **Coupled must-keep-working (functional).** The reference interpreter must preserve the
   expression language the native path already accepted (`typeof`, `null`, `undefined`, multi-
   statement filters, array methods, sandbox helper calls, arithmetic/ternary/bitwise) and the
   explicitly requested native mode, disabled mode and caller-supplied evaluator hooks. An
   over-broad fix (refuse everything, block all calls) fails 7-38 functional tests.

## Candidate sibling sites/routes considered

Real upstream candidates (search of `src/`, `bin/`, `test-helpers/`, `package.json`, `dist/`):

- browser AST evaluator + its export — picked as T2 (separate implementation, far from the
  reported Node alias, real upstream code the published fix later replaces).
- lower-level `SafeScript` export of both entries — picked as T3 (real upstream; the published fix
  removes it; a plausible dismiss reason exists: it is a low-level helper).
- script-cache consumption in `_eval` — picked as T4 after injection (the check reads a global
  cache and never calls the producer; how-type).
- second platform entry with a Function-based safe shim (screener O8b #2) — picked as T5.
- extra eval mode (`fast`/`safe2`) that constructs a script through `this.vm` (O8b #1) — rejected:
  it must be added inside the dispatch chain the published fix rewrites, so it would not survive
  the published fix and it is co-located with the report's landing point.
- CSP fallback that compiles with `new Function` when parsing fails (O8b #3) — rejected: it would
  live in the shared evaluator the published fix creates, so the same fix would close it; not an
  independent sibling.
- a new jsep node-type handler without the guard (O8b #5) — rejected for the same reason (inside
  the evaluator the fix replaces).
- committed `dist/` bundles — rejected: the verifier rebuilds bundles from source, so they cannot
  carry an independent route.
- CLI (`bin/jsonpath-cli.js`) — same evaluation entry as the package root; no separate mechanism.
- caller-supplied evaluator class/function and the caller's sandbox — documented caller authority,
  not attacker-controlled; out of scope.
- package export aliasing / CJS entry — same code, no independent route.

Why T4 and T5 beat the other injected candidates: both are code a maintainer could have written
for a real reason (cache warm-up; a vm-less runtime build), both are reachable through a real
public entry, both are covered by the single property, and neither is modified by the published
fix. T4 is how-type (the consumer must be changed to stop trusting foreign cache entries, or the
producer must be changed to store a safe script — two valid layers); T5 adds a different dismiss
reason (platform/opt-in). The rejected candidates either sit in code the published fix rewrites or
need a new expression node type the existing interpreter does not parse.

## What was verified

- The flaw reproduces through all five surfaces on the pinned+injected tree: package root, browser
  bundle, edge build, prepared cache entry, exported script class. Each attack uses a harmless
  marker function supplied in the sandbox; the marker is called only when the expression runs.
- Pinned+injected: 13/13 security tests fail, 39/39 functional tests pass (gate nop).
- Reference fix: 3/3 oracle trials at reward 1.0, identical results, 13/13 security and 39/39
  functional (gate oracle).
- Wrong-fix isolation (gate patches, 11/11 declared): T1 mechanism 0.7692, T1 key-coercion 0.8462,
  T2 0.8462, T3 0.9231, T4 0.9231, T5 0.8462; over-broad fixes 0.0/0.0/0.0; hardening and the
  alternative producer fix 1.0.
- The project's own suite (`npm run mocha`, including `test/test.safe-eval.js` and
  `test/test.eval.js`) passes at the pinned tree in the image build (265 passing) and with the
  reference fix (265 passing; run locally in a worktree of the last fix commit).
- `environment/injection.patch` applies to the pin; `solution/fix.patch` and every
  `build/jsonpath-s3/checks/*.patch` apply to the injected tree (`git apply --check`).
- The verifier rebuilds the bundles offline from the restored source as uid 1000; dependencies are
  bound from the verifier image; no network is used at grade time.

## What could not be verified

- Target-model behaviour (DeepSeek V4.1 Flash, MiMo-V2.6-Pro): trials were not run, as instructed.
  The bar for this task is decided by that later step and the fairness review.
- Current upstream state of the code (`present_in_latest`): not inspected beyond the fetched
  repository history; no register row was added because the task is pattern A and the screener
  listed no real uncovered upstream routes (every extra route here is injected or is a published
  fix site).
- The advisory texts beyond their one-line summaries; the pinned PoC wording is unknown, so the
  tests use their own harmless marker and expression shapes.
- Repository size in MB (the screener left it null).

## Scope note (outside this advisory)

`eval: 'native'` (and the browser `new Function` path it selects) is the documented, deliberately
unsafe opt-in. It is preserved and covered by a functional test; it is not counted as a defect or
as an uncovered route.
