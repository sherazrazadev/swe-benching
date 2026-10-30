# appium-s4 - build notes

- Start: 2026-10-30T00:15Z
- End: 2026-10-30T01:06Z
- Repo: appium/appium, pinned 47638650 (parent of published fix d94a40af).
- Pattern: A, track injected. Advisory: GHSA-3WGP-X9P5-C7CC / CVE-2026-58191 (reflected
  XSS/debug surface, CWE-79 + CWE-489).

## What the published fix does (verified from the diff)

`d94a40af` does not add escaping. It removes the default surface: `server()` reads
`APPIUM_ENABLE_LEGACY_TEST_PAGES` and only then requires the new `test-pages` barrel and passes a
`registerTestPages` callback to `configureServer()`; `configureServer()` itself mounts the favicon,
the fixture static directory, the two deliberate error routes and the four dynamic pages only when
that callback is supplied. The fixture directory and the template compiler move out of the always
loaded path. The security property is therefore "the built-in test/debug surface is opt-in", and
the coupled behaviour is that the opted-in pages keep binding submitted values unchanged (they are
test fixtures; escaping them would break driver suites).

## One-line levers

- **T1 dynamic pages (A, report site)**: `packages/base-driver/lib/express/server.ts:216-219` mounts
  `/welcome` and the three guinea-pig pages unconditionally; `static.ts:36-46` reflects
  `?throwError`, the `comments` body field and the User-Agent. Covered by
  `security/test_pages.test.js`; coupled functional `optin_pages.test.js`.
- **T2 static + error surfaces (A, far sites, different dismissal)**: `server.ts:183-188` mounts
  `serve-favicon`, `express.static(STATIC_DIR)` (the whole fixture tree at the server root) and
  `${basePath}/produce_error` / `${basePath}/crash`. Covered by `security/static_assets.test.js` and
  `security/deliberate_errors.test.js`; coupled `optin_assets.test.js`, `optin_errors.test.js`.
- **T3 assembly API (A, far entry point)**: `configureServer()` (`server.ts:168-176`) is the shared
  assembly point, so the exported configuration API mounts the same surface; a fix that only gates
  the factory's switch leaves it open. Covered by `security/assembly_api.test.js`.
- **T4 coupled must-keep-working (how)**: with the opt-in on, query/body/header values must be
  bound into the page unchanged. The tempting wrong fix (HTML-escape the interpolations, the
  advisory's headline XSS fix) breaks `functional/optin_pages.test.js` and
  `functional/optin_assets.test.js`. check: `escape_values.patch` (functional_fail).
- **T5 injected sibling, route where protection never existed (how)**: a reachability page at
  `/sample-page` that echoes `?message` through a plain template literal. New module
  `packages/base-driver/lib/express/sample-page.ts`, wired unconditionally at `server.ts` (injected
  tree) next to the bootstrap. check: `miss_sample_page.patch`.
- **T6 injected sibling, second static mount**: `/ci-assets` serves `packages/base-driver/assets/ci`
  (new `lib/express/ci-assets.ts`), a driver-CI convenience that looks like inert assets. check:
  `miss_ci_assets.patch`.
- **T7 opt-in value contract (how, config decision)**: only `1`/`true`/`yes` in any case enable it;
  `0`, `false`, `no`, `off`, an empty value and unrelated words must leave it off. A truthiness check
  passes every positive example and opens the surface for `0`. check: `env_truthy.patch`;
  the case-before-normalisation variant is `env_case.patch` (functional_fail).

Every lever sits under the one general property: the built-in test/debug support (pages, bundled
sample/fixture files, deliberate error triggers) must not be reachable unless the operator
explicitly turns it on; while it is off a request for it is a client error with no side effect;
while it is on the pages keep behaving exactly as today; everything else keeps working.

## Candidate sibling sites found, and why the picks won

Screener leads (O8b) and my search of `packages/*`:
1. A fourth page registered next to the existing three (screener O8b #1) - rejected: it lives in
   the same route-registration block the published fix removes, so it falls with the block; it adds
   no scope.
2. A second echo (`fbemail`) inside the existing templates (O8b #2) - rejected: the whole template
   surface is gated as one unit, so it falls with T1 and adds no dismissal reason.
3. A second consumer of `compileLodashTemplate` in another package (O8b #3) - rejected: the
   published fix deletes that export from `lib/utils.ts`, so applying the reference fix would make
   the consumer fail to compile, forcing the find; and a plugin HTML report is a different
   protection (data formatting), not the built-in test surface.
4. `packages/appium` bootstrap / `driver-test-support` fixture servers - rejected: they are not the
   Appium HTTP server's default assembly; driving them would need installed extensions and would
   argue about scope.
5. `--allow-insecure` features and plugin `updateServer` hooks - rejected: a different protection.
6. Chosen S1/S2 (T5/T6): both are new files reached through the real default assembly, in the
   server bootstrap but outside the blocks the published fix edits, and each has its own dismissal
   reason (a plain reachability page; inert sample files for driver CI). They are independent of
   the fixture-directory relocation, so a solver who re-executes the published reorganisation
   neither breaks them nor finds them by accident.

## What was verified

- Pinned+injected tree, through the built package: `/test/guinea-pig` (GET/POST/PUT, repeated key,
  header), `/welcome`, `/test/guinea-pig-scrollable`, `/test/guinea-pig-app-banner`,
  `/test/welcome.html`, `/appium.png`, `/favicon.ico`, `/crash` (500 with its message),
  `/produce_error` (404 with its message), `/ci-assets/*`, `/sample-page` are all served; the
  direct `configureServer()` assembly serves them too. 27 security tests fail; 28 hidden
  functional + 7 project tests pass.
- Reference fix: all 62 pass, three times identical (gate oracle stage).
- Every `checks/` patch was applied to the injected tree, rebuilt, and both suites (plus the
  project subset) run locally before the gate. Observed:
  gate_pages_only 17 security fail / 0 functional; miss_pages 16 / 0; miss_static_errors 7 / 0;
  default_mount 4 / 0; miss_sample_page 9 / 0; miss_ci_assets 1 / 0; env_truthy 5 / 0;
  crash_as_refusal 27 / 0; reads_only 3 / 0; env_case 0 / 4; escape_values 0 / 4;
  disable_feature 0 / 23; refuse_all 0 / 3 hidden + 2 project; hardening 0 / 0;
  alt_fix 0 / 0.
- The injected tree is exactly `injection.patch` applied to the pinned commit (byte-identical
  source); `solution/fix.patch` applies cleanly to it.

## Deviations / guesses not verified

- The reference fix is the published fix reduced to its behavioural source change: it keeps the
  files where they are and gates the mounts at `configureServer()`, plus the two injected
  siblings. The published reorganisation (moving `static/` to `test-fixtures/`, relocating the
  template compiler, the package manifest change) is not required by the property and is not used
  by the tests; a solver may do it and still pass (the tests only use `server()`,
  `configureServer()` and the `STATIC_DIR` export).
- `STATIC_DIR` is checked functionally (the export resolves and both fixture files exist), not by
  comparing it to a fixed path, so both the in-place and the relocated layout pass.
- The project subset excludes one stale mount-count assertion from the pinned
  `server.spec.ts`; the published fix rewrites that assertion, so keeping it would fail every
  correct fix. The rest of the file is used verbatim.
- Not verified against a later release (the inputs give no latest version); `present_in_latest`
  rows are not applicable because this is not a pattern-B build.
- Whether the two injected siblings are "what a maintainer would add" is a judgement call; both
  are documented and typed in the injected copy so a blind engineer can find them from the general
  property.
- Pattern B register: no upstream uncovered routes were found or built (the advisory's own fix
  covers every upstream mount), so no rows were added to `build/audit/uncovered-routes.tsv`.

## Scope note

External driver packages that mount these same fixture handlers in their own servers (the still
exported `STATIC_DIR` exists for them) are out of scope and were not inspected.

## Gate results (2026-10-30)

- `static`: PASSED (no warnings; blind.patch is the only declared check file not written here, per
  the process).
- `nop`: PASSED - 27 security tests fail on the pinned+injected tree, 35 functional pass
  (28 hidden + 7 restored project).
- `oracle` (strict, 3 runs): PASSED - every run reward 1.0 with identical result sets
  (27 security + 35 functional).
- `patches`: PASSED - all 15 checked variants behaved as declared:
  - security_fail: gate_pages_only (17 security failing), miss_pages (16), miss_static_errors (7),
    default_mount (4), miss_sample_page (9), miss_ci_assets (1), env_truthy (5),
    crash_as_refusal (27), reads_only (3), each with 0 functional failures;
  - functional_fail: env_case (4 functional failing), escape_values (4), disable_feature (23),
    refuse_all (5);
  - pass: hardening 1.0, alt_fix 1.0.
- Reports kept: `gate_report.partial.json` (last stage), `gate_report.static2.json`,
  `gate-oracle.log`, `gate-patches.log`.
