# typespec-s4 — build notes (PLAN, written before building)

- Start UTC: 2026-10-29T17:27:23Z
- End UTC: (filled at the end)
- Advisory: GHSA-2Q42-4Q24-7RGV (microsoft/typespec, CWE-22/CWE-73)
- Pinned: ddb3519c8e1bba87b21fa0649f4ef8df9d9b8e52 (verified parent of fix)
- Published fix: e0f67bdf3c5a0875dfa98b475648af37caac71a6 (14 files; package diff read in full)
- Track: injected. Pattern: A+B.

## Security property (written once, before routes)

A name that the author of a spec writes must never cause the toolchain to create, change or remove
anything outside the output directory the caller chose for that emitter — whatever emitter or
option uses the name, and whatever text the name contains.

Coupled preservation clause: names that are safe path text keep producing exactly the same output
(dotted names such as `Pet.Store`, `1.0.0`, `2021-10-01-preview`, `..dir`, `dir..`); output templates
that put a name inside sub-directories keep their separators; documented dotted layouts keep their
layout; and references between generated files keep pointing at the files actually produced.

## Levers (one line each)

- L1 how-type / shape: a value made only of dots (`..`) used by a directory in the output template.
  A separator-only check (`/`, `\`) looks complete but `..` is one directory level per segment.
  Dismissal: "`..` is not a separator, and stripping dots breaks benign `Pet.Store` / `1.0.0`".
  Sites: openapi3 `{version}` and `{service-name}`, graphql `{schema-name}`.
- L2 how-type / coupled: benign dotted names, sub-directory templates and json-schema relative
  `$ref`s must survive. Dismissal: an over-broad fix (basename / replace-all-dots / flatten
  separators) also stops the attack and looks simpler. MiMo over-hardens.
- L3 pattern A far site: `@typespec/asset-emitter` public `createSourceFile` API (also the layer
  that protects json-schema per-declaration files). Dismissal: generic framework, "not OpenAPI".
- L4 pattern B real route: graphql `$onEmit` interpolates the spec's schema name into the output
  file. Dismissal: a different emitter with its own `{schema-name}` variable; report is OpenAPI3.
- L5 pattern B real route: protobuf writes one file per package, building directories from the
  package name split on `.`. Dismissal: package names look validated (an unused
  `invalid-package-name` diagnostic exists) and the dotted layout is documented.
- L6 injected: json-schema opt-in per-namespace output index written with `emitFile` into a
  directory named from the schema namespace (raw name). A separate writer in a new file, called
  from `writeOutput`, not the published hunk. Dismissal: "the fix for schema file names does not
  cover a discoverability index".
- L7 injected: protobuf opt-in package descriptor manifest written at the emitter root from the
  raw, unsplit package name. Dismissal: "the .proto path is what matters; a side artifact is
  separate". Different construction from L5 (unsplit vs split).

## Sites the oracle will fix

Published: compiler path helper + both barrels; openapi3 `{version}`/`{service-name}`/
`{service-name-if-multiple}`; asset-emitter `createSourceFile`; json-schema declaration name.
Added for real routes: graphql schema name; protobuf package path segments.
Added for injected siblings: json-schema output index namespace directory; protobuf descriptor
manifest package name.

## Full candidate list (all found) and why the picks won

Real routes:
- protobuf `packages/protobuf/src/transform/index.ts:76-82` (package split on ".") — PICKED (L5).
- graphql `packages/graphql/src/emitter.tsx:33-38` (`{schema-name}`) — PICKED (L4).
- json-schema bundle path (`json-schema-emitter.ts:976-978`) — rejected: `bundleId` is an emitter
  option, not spec-supplied; the property is over spec names.
- emitter-framework `write-output.ts:23-26` + http-client-js `client-directory.tsx:42` — rejected:
  the only in-tree driver is http-client-js and the sub-client name goes through the TypeScript
  name policy, which strips separators; not a reachable spec-name route without a deliberately
  broken name policy.
- http-server-js `write.ts:58` module cursor path — rejected: namespace components go through
  `parseCase(...).kebabCase`, which splits on `/ \ . : - _ space`, so no separators survive.
- html-program-viewer `emitter.ts` — rejected: writes two fixed file names; no spec name.
- http-client-python `emitter.ts:152-155` — rejected: package excluded from the pnpm workspace and
  copies an externally generated tree; out of scope for this advisory.
- http-client-csharp / http-server-csharp / http-client-java — excluded from the workspace
  (`pnpm-workspace.yaml`), not buildable here; noted, not built.
- tspd / pack / bundler / openapi convert — not spec-emitter entry points.

Injected siblings considered:
- json-schema per-namespace index (INJ-A) — PICKED (L6): directory component + created directory,
  separate writer, non-overlapping with the published json-schema hunk.
- protobuf package descriptor manifest (INJ-B) — PICKED (L7): raw unsplit package name, separate
  artifact, non-overlapping with the real split route's construction.
- openapi3 service index — rejected: `openapi.ts` is the file the published fix edits; lower
  plausibility and higher patch-conflict risk.
- graphql per-operation files — rejected: same emitter, same name->path concept; "more routes of
  one concept".
- emitter-framework new writer — rejected: no in-tree emitter drives it without building
  http-client-js, and the name policy sanitizes that path.
- html-program-viewer per-namespace pages — rejected: heavy React/Vite build and a fixed-name
  writer; adding pages is speculative.
- asset-emitter second helper — rejected: the published fix edits this file and no natural caller.

Why the picks beat the others: L6/L7 are in new code paths reached through ordinary opt-in emitter
options, use different constructions (directory index vs root manifest; namespace vs package), sit
far from the OpenAPI version report, and are covered by the property as written without any
sentence of their own.

## Coupled must-keep-working behaviours (functional tests)

- openapi3: benign dotted service/version names, `{version}` as a directory, multiple services.
- json-schema: per-declaration file names, benign dotted declaration names, relative `$ref`s.
- asset-emitter: `src/models/a.ts` keeps its sub-directories; `Pet.Store.ts` keeps its dot.
- graphql: benign schema name output and valid SDL.
- protobuf: `foo.bar.baz` still emits `foo/bar/baz.proto`.
- INJ-A: benign namespace index lists the files actually emitted.
- INJ-B: benign package descriptor manifest still written at the root.

## Verified before building (local dev tree, pinned commit)

- Toolchain: pnpm 11.10.0, node 22, full workspace install 23 s; affected project suites pass:
  openapi3 output-file 20/20, json-schema 193/193, asset-emitter 48/48, compiler
  path-interpolation 6/6, graphql 368/368, protobuf 35/35.
- Reproduction on pinned through real entry points (NodeHost + real emitter, temp output dir):
  openapi3 `{version}` `../../../escaped` escapes the emitter dir; `{service-name}` escapes;
  json-schema declaration name writes outside; asset-emitter `createSourceFile` returns/writes
  outside; graphql `{schema-name}` writes outside; protobuf absolute package name writes outside
  (relative traversal crashes at `/`).
- Benign values: `Pet.Store` / `2021-10-01-preview` unchanged; `src/models/a.ts` unchanged;
  protobuf `foo.bar.baz` unchanged.

## Not verified / to confirm while building

- INJ-A/INJ-B reproduce and are fixed by the oracle (built next).
- The verifier image binding of pnpm workspace `node_modules` and a cold rebuild.
- Docker image size/time on this VM.

## Scope outside the advisory (one line)

- The excluded packages (csharp/java/python emitters) and the emitter-framework/http-client-js
  writer path show the same class of name->path writing but are outside this advisory's OpenAPI3
  version/name protection; noted only, not built on.

## Build and verification log (appended while building)

- Toolchain in the image: node:22.20.0-bookworm-slim, pnpm 11.10.0 (packageManager), full
  `pnpm install --frozen-lockfile --ignore-scripts`, ordered builds of the toolchain and the
  packages the tests touch.
- `git rev-parse HEAD` is required by the compiler's `gen-manifest`; the source stage keeps the
  pinned .git through the build and the final baseline step removes it; the verifier's test.sh
  creates an empty commit when the restored tree has no .git (the artifact excludes it).
- Hidden suites run under plain Node with a small JUnit-emitting runner (`tests/support/runner.ts`)
  because the compiler dynamically imports emitters and vitest's transform cannot handle the Alloy
  JSX runtime they pull in. The project's own tests run under vitest from their packages.
- Local nop (pinned+injection): security 23/23 fail, functional 108/108 pass.
- Local oracle: security 23/23 pass, functional 108/108 pass.
- Wrong-fix patches validated locally (applied to the injection tree, rebuilt, both groups run):
  see the SUMMARY block printed by validate-checks.sh; each security_fail leaves functional 0 and
  each functional_fail breaks a coupled behaviour.

## Local wrong-fix validation (injection tree, rebuild of every fixed package, both groups)

Each row is a check patch applied to the injection tree; counts are security/functional failures.

| check | security fail | functional fail | expected |
|---|---|---|---|
| sf_published_only | 10 | 0 | security_fail |
| sf_version_only | 19 | 0 | security_fail |
| sf_no_openapi3 | 7 | 0 | security_fail |
| sf_no_asset_emitter | 4 | 0 | security_fail |
| sf_no_graphql | 4 | 0 | security_fail |
| sf_no_protobuf | 2 | 0 | security_fail |
| sf_no_index | 2 | 0 | security_fail |
| sf_no_descriptor | 2 | 0 | security_fail |
| sf_crash_unsafe | 19 | 0 | security_fail |
| sf_file_only | 4 (dots-only shapes) | 0 | security_fail |
| sf_slash_only | 8 | 0 | security_fail |
| ff_overbroad_dots | 0 | 37 | functional_fail |
| ff_refuse_all | 2 | 71 | functional_fail |
| ff_flatten_paths | 7 | 24 | functional_fail |
| pass_hardening | 0 | 0 | pass |
| pass_alt_containment | 0 | 0 | pass (after fixing absolute-root handling) |

## Gate results

- static: PASSED
- nop: PASSED (pinned+injection image: every security test fails, every functional test passes)
- oracle: PASSED (3 identical runs, reward 1.0)
- patches: PASSED (16/16 check patches behave as declared; the blind patch is written later by the
  blind-fix step and is declared in the manifest without a file, so the patches stage skips it)
- End UTC: 2026-10-29T19:21:26Z
- Failures found and fixed while gating: the compiler's manifest step needs a git HEAD (kept .git
  through the image build; the verifier creates an empty commit because the artifact excludes
  .git); pnpm's dependency-status auto-install aborted without a TTY (disabled with
  --config.verify-deps-before-run=false and CI=true); stale temp/*.tsbuildinfo in the artifact made
  tsc skip emitting declarations (temp/.turbo excluded and cleared before the rebuild).
- Not verified: the two target models' runs (not run per the build brief); the blind fix (next step).
