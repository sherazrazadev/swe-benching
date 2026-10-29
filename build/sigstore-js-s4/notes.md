# sigstore-js-s4 — build notes

Start (UTC): 2026-10-29T00:47:45Z
End (UTC): 2026-10-29T01:13:05Z

Task: attach-an-attestation credential binding in `sigstore/sigstore-js`. Pinned
`a063789da477ab9bb9ad266878f095e36a264804`; published fix `85c58380758b97ce1b74ef470e55cc21f9d3aa89`
(only `packages/oci/src/credentials.ts` plus its regression test).

## The task in one paragraph

The security property is stated once in `instruction.md`: a credential stored for one registry is
bound to that registry, so the tool may use only the credential stored for the image's registry, at
lookup time and at the registry it addresses. The tests drive the public `@sigstore/oci` API the
CLI's `attach` command composes (`getRegistryCredentials` → `attachArtifactToImage`), never an
internal helper. Security tests use harmless marker credentials and assert the marker is never
returned for, or presented to, another registry. Functional tests keep every accepted stored form,
both extra credential sources and the Docker Hub alias flow working, and run the project's own
`credentials.test.ts` for the package.

## Levers (one line each)

- T1 (main, how-type, real upstream route): the credential is selected for the host parsed from the
  image reference but the request is addressed through a separable suffix-based Docker Hub rule, so
  a host ending in `docker.io` gets its credential sent to `registry-1.docker.io`
  (`packages/oci/src/image.ts:232-234`; still present in upstream main `e77ae769`).
  Reason to dismiss: it reads as a deliberate Docker Hub special case with a moby source reference,
  and the published fix never touches it.
- T2 (how-type, coupled values / shapes): exact-looking comparisons on the raw stored key must keep
  resolving `https://<registry>/v1`, `host:port` and Docker Hub aliases, while a key that merely
  contains the target (including inside a stored path) must not resolve
  (`packages/oci/src/credentials.ts:49-53`).
  Reason to dismiss: the tempting `key === registry` fix passes the reported example and quietly
  breaks the legacy forms the project's own test already asserts.
- T3 (injected sibling, second credential source): the container registry auth file has its own
  key matching copied from the Docker-config lookup (`packages/oci/src/containers-auth.ts:56`).
  Reason to dismiss: a separate compatibility source, not the reported Docker-config path.
- T4 (injected sibling, second source, different mechanism): the credential helper is chosen by
  matching its stored registry key against the target by substring
  (`packages/oci/src/credential-helpers.ts:33`).
  Reason to dismiss: the helper is an external tool and the protocol takes the registry as input,
  so it reads as "the helper decides", not as credential selection.

Injected code (realistic, no deceptive names): `containers-auth.ts` (container-runtime auth-file
support) and `credential-helpers.ts` (Docker `credHelpers`/`credsStore` support), both called from
`getRegistryCredentials` as fallbacks, each with the pre-fix substring key matching. Neither is
touched by the published fix.

## Sites/routes the tests cover

- Docker config `auths` selection: key contains target; port-bearing key vs port-less target; target
  matching a stored path.
- Network destination identity: `notdocker.io` credential must not reach `registry-1.docker.io`.
- Container auth-file source: `ghcr.io` credential must not resolve for `cr.io`.
- Credential-helper source: helper named for `ghcr.io` must not answer for `cr.io`.
- Functional: plain, scheme/path, port, Docker Hub alias, identity token, headers, independent
  registries, no-credential error; exact auth-file entry and precedence; exact helper and
  store-wide helper; plain-registry and Docker-Hub attach flows; the project's own 8 credentials
  tests.

## Gate results (stages run in order, one at a time)

- `--only static`: PASSED. Patch files, metadata, conformance, instruction leak terms, hidden-test
  isolation and the wrong-fix catalogue all clean; no warnings.
- `--only nop`: PASSED. Untouched injected tree: security 0/6 pass (all six exploits succeed),
  functional 31/31 pass, reward 0.0.
- `--only oracle`: PASSED. Three concurrent reference-fix runs, each security 6/6 + functional 31/31,
  reward 1.0, identical results across runs.
- `--only patches`: PASSED. `published-only` 3 security fail; each `miss-*` exactly its one security
  test; `strip-port` the port test; `fallback-open` three selection tests; `over-broad` four
  functional tests; `refuse-all` sixteen functional tests; `hardening` and `alternative` reward 1.0.
  `blind.patch` is declared and skipped until the blind-fix step writes it.

## Verified locally (scratch clone, before the gate)

- Pinned+injected tree: security 0/6 (all six exploits succeed), functional 31/31 pass.
- Reference fix: security 6/6, functional 31/31; `tsc --build packages/oci/tsconfig.json` clean;
  all 56 `packages/oci/src/__tests__/*.test.ts` tests pass.
- Variant matrix: `published-only` leaves the network-identity and both injected-source tests
  failing; each `miss-*` leaves exactly its one test; `strip-port` leaves the port test;
  `fallback-open` leaves three selection tests; `over-broad` breaks four functional tests;
  `refuse-all` breaks sixteen; `hardening` and `alternative` score 1.0.
- Patches were generated against the injected tree and re-applied from a clean pinned checkout with
  `patch -p1`.
- Current upstream main (`e77ae769`) still has the suffix-based Docker Hub destination rule, so T1 is
  a live gap, not a historical one.

## Could not verify

- No trials were run (instruction: do not run target models). Whether DeepSeek/MiMo fail 3/3 is
  unknown at build time; the gate proves only correctness, nop and variant behaviour.
- The blind patch and `FAIRNESS.md` are produced by later pipeline steps; `blind.patch` is declared
  in the manifest but not written here.
- The repository size in MB was not recorded by the screener; the image installs the whole npm
  workspace, which is acceptable at ~1 GB of dependencies.
- Upstream later added origin-scoped fetch helpers for the Location/redirect and bearer-token realm
  routes (after the pinned commit, not part of this advisory's fix); their exact release boundary was
  not determined.

## Outside this advisory's protection (not built on)

- `packages/oci/src/registry.ts` blob-upload `Location` forwarding: confirmed leaking at the pinned
  commit with a nock test; it is protocol cross-origin forwarding and needs an origin-scoping
  protection, not this selection property. Upstream later addressed it.
- `packages/oci/src/registry.ts` bearer-token realm: Basic credentials / password posted to the
  challenge's realm host; protocol-mandated token service, same origin-scoping protection.
- `packages/oci/src/credentials.ts` returns the global `HttpHeaders` map for every registry; an
  adjacent header-scoping question, not credential selection.
- `packages/sign/src/identity/ci.ts` sends a bearer token to an env-supplied URL; unrelated
  subsystem.

## Fairness concerns I see

- T1 needs the solver to audit how the request's registry identity is produced, not just the
  reported lookup. The instruction states the property over "how the tool decides which registry a
  request is sent to", so it is covered literally, but it is the hardest lever.
- The helper tests use a stand-in helper binary. The product passes `env: process.env` explicitly and
  the verifier also puts the stand-in on PATH, so a correct rewrite that drops either mechanism
  still resolves it; a rewrite that drops helper invocation entirely is an over-restriction and is
  caught by the functional tests as intended.
- The project test copy in `tests/project/` has its upstream license header removed only because the
  leak check treats shared comment boilerplate as test content; semantics are unchanged.

## Pattern B register

Rows appended to `build/audit/uncovered-routes.tsv`: T1 (real, present in latest), T3 and T4
(injected), and the two investigated-but-not-built real routes (Location and bearer realm, both
outside this advisory's protection).
