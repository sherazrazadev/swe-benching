# kyverno-s3 — build notes (injected track, pattern A+B)

start_utc: 2026-10-27T09:55:41Z

## Advisory and pinned tree

- GHSA-8p9x-46gm-qfx2 / GHSA-cvq5-hhx3-f99p, kyverno/kyverno, CWE-863.
- Pinned commit 99260bd2900290d7d898933c421d2a51d01172a6 (parent of the first published fix).
- Published fixes: eba60fa856c7 (apiCall URLPath confinement through the loader factory),
  e0ba4de4f1e0 (same change on another branch), bbf3e5c01391 (ConfigMap namespace confinement,
  later tree; its source change is applied to the pinned tree).
- Verified locally: checkout builds; the published diffs touch apiCall.go, loaders/apicall.go,
  factories/contextloaderfactory.go and (later) loaders/configmap.go only.

## Security property (written once, over the outcome)

A policy that belongs to a namespace must not make data from outside that namespace, or
cluster-scoped data, available to its evaluation, however the data is declared. A cluster-scoped
policy keeps its current unrestricted access. A refusal is a client error and leaves the policy
context unchanged.

Every lever below falls under this sentence as written; the instruction never names a route.

## Levers

- L1 — pattern A, published fix site, HOW (shape a plausible check mishandles + coupled
  must-keep-working). The namespace guard on a declared API path must run after variable
  substitution and on the resolved path: dot segments, a namespace-name prefix, an all-namespace
  list path, a cluster-scoped object path, and a write must all be refused, while own-namespace
  core/group reads, post-substitution own-namespace reads and cluster-scoped policies keep working.
  Reason to dismiss: the report shows one literal path, so a substring/prefix check looks enough;
  cluster-scoped reads look like the same feature. Sites: pkg/engine/apicall/apiCall.go:60-81,
  pkg/engine/factories/contextloaderfactory.go:20-30, pkg/engine/context/loaders/apicall.go:26-51.
- L2 — pattern A, published far site (the B advisory), second implementation. The typed ConfigMap
  loader takes the namespace from the policy entry with no comparison to the policy namespace; an
  empty/substituted namespace falls back to `default`. Reason to dismiss: ConfigMaps are typed,
  non-secret shared configuration, so the typed lookup looks like a different feature from the raw
  API path the report describes. Site: pkg/engine/context/loaders/configmap.go:65-95.
- L3 — pattern B, INJECTED, route where the protection never existed / HOW (effective path is
  composed, not declared). A new typed context source reads a Kubernetes object or collection from
  group/version/resource/namespace/name and composes the API path itself. No declared URLPath
  exists for a urlPath check to see; the guard must cover the built path after substitution.
  Reason to dismiss: it is a newer, typed convenience that looks unrelated to the raw path the
  report names, and it has no URLPath field at all. Sites: new
  pkg/engine/context/loaders/resource.go (flaw), wiring in
  pkg/engine/factories/contextloaderfactory.go, new API field in api/kyverno/v1/common_types.go.
- L4 — pattern B, INJECTED, HOW (wrong object: the guard decides on the requested namespace, the
  data source returns an object from another one). The client-backed ConfigMap resolver falls back
  to the shared `default` namespace when the requested namespace has no such object, so a
  namespace-request check passes while a foreign object's data is bound. Reason to dismiss: the
  resolver is a low-level shared helper and the loader's request looks namespace-checked.
  Site: pkg/engine/context/resolvers/resolvers.go (flaw); the check must cover the object actually
  returned, wherever the fix places it.

## Candidate sites/routes considered (from the screener's O8/O8b plus a full search)

Real, unmodified upstream:
1. apiCall URLPath (pkg/engine/apicall/apiCall.go:57-81; executor.go:44-57) — chosen (L1).
2. ConfigMap context entry (pkg/engine/context/loaders/configmap.go:65-107) — chosen (L2).
3. Outbound service call lends Kyverno's service-account token (pkg/engine/apicall/executor.go:143-166)
   — real and strong, but a different protection (credential lending) that would need a second
   property; left out to keep one coherent property and one fair contract.
4. Cleanup controller builds the loader with a nil policy
   (pkg/controllers/cleanup/controller.go:169-183) — real, but a caller-wiring/where-type lever whose
   context only feeds deletion conditions, and its harness lives in another package; not chosen.
5. GlobalContextEntry reference reads whatever the cluster-scoped entry holds
   (pkg/engine/context/loaders/globalcontext.go:97-140) — rejected: a GlobalContextEntry is a
   cluster-admin grant; calling it a namespaced-policy leak is a fairness risk.
6. Global-context external API executor (pkg/globalcontext/externalapi/entry.go:78-104) — rejected:
   cluster-scoped controller machinery, no namespaced policy input.
7. Global-context k8sresource watched namespace (pkg/globalcontext/k8sresource/entry.go:40-52) —
   rejected: choosing the watched namespace is a cluster-admin action, not a policy read.
8. Image-registry pull-secret lookup (pkg/engine/context/loaders/imagedata.go:89;
   pkg/engine/factories/registryclientfactory.go:25-49) — rejected: the secret lister is fixed to one
   namespace, not selected by the policy; registry data is not Kubernetes namespace data.
9. CLI local context loader wrapper (cmd/cli/kubectl-kyverno/store/contextloader.go:13-40) —
   rejected: it forwards the policy to the shared factory, so it is an extra entry point into L1, not
   a separate gap.
10. ConfigMap resolver chain (pkg/engine/context/resolvers/resolvers.go; pkg/engine/api/resolver.go) —
    used as the host of L4.
11. Policy validation (pkg/validation/policy/validate.go:1321-1340, 1399-1409) — rejected as a lever:
    admission-time rejection is not the data path; the property must hold where data is fetched.
12. Background/reports engine construction (cmd/internal/engine.go:28-53) — an entry point into the
    same factory; not a separate gap.
13. Policy match namespace checks (pkg/engine/utils/match.go:184; pkg/engine/internal/match.go:54) —
    rejected: the earlier advisory's policy-matching protection, not context data.

Injection candidates (O8b + own search):
A. New typed context source composing its own API path — CHOSEN (L3). How-type; the guard must
   understand the mechanism (a built path), not just find a declared field.
B. ConfigMap resolver shared-namespace fallback — CHOSEN (L4). How-type; wrong object.
C. A second factory caller/option with an empty policy identity — rejected: where-type wiring; the
   published factory change already centralizes identity, and a nil-policy caller duplicates the
   real cleanup route already considered.
D. GlobalContextEntry namespace confinement — rejected (fairness, admin grant; see 5/7).
E. Image-registry pull-secret namespace — rejected (fixed lister; not policy-selected).
F. A cross-policy context-result cache keyed by entry name — rejected: no such cache exists; a
   package-level cache would be contrived and can flake.
G. A second ConfigMap-like loader for Secrets — rejected: it repeats the ConfigMap concept (falls
   together with L2) and Kyverno has no policy-readable Secret context source.
H. Admission-time defaulting of context namespaces — rejected: not the data path.

Why L3 and L4 beat the rest: both are HOW-type, reachable through the same real entry point the
hidden suites drive (the shared context-loader factory and the real resolver implementation), placed
in files the published fixes never touch (a new loader file and resolvers.go), and each has its own
dismissal reason (a typed source with no URLPath; a low-level resolver whose request looks checked).
Together with L1/L2 they cover four independently-fixable mechanisms.

## Planned hidden suites (entry point: factories.DefaultContextLoaderFactory -> Load, deferred
loading disabled; the real client-backed resolver for L4)

Security: cross-namespace path; dot segment; namespace-prefix collision; all-namespace list;
cluster-scoped object; substituted namespace; cross-namespace write; ConfigMap cross-namespace;
ConfigMap empty substitution; typed source cross-namespace; typed source cluster-wide; typed source
substituted namespace; ConfigMap requested in the policy namespace but resolvable only in the
shared namespace (L4).

Functional: own-namespace core/group/substituted path reads; cluster policy unrestricted path read;
own-namespace ConfigMap; cluster-policy defaulted namespace; cluster-policy cross-namespace
ConfigMap; own-namespace typed source core+group; cluster policy unrestricted typed source;
own-namespace ConfigMap resolved exactly through the real resolver; plus the project's own tests for
the touched packages.

## Status

built; gate results below.

## Local verification (before the container gate)

- The pinned checkout builds. The injection applies cleanly to a pristine checkout of 99260bd
  with `git apply -p1`, and `solution/fix.patch` applies on top with `patch -p1`.
- Pinned + injection (nop tree): all 13 security tests fail, all 11 functional tests pass.
  Project tests `go test ./pkg/engine/apicall ./pkg/engine/context/loaders ./pkg/engine/factories
  ./pkg/engine/context/resolvers -count=1` and `./pkg/validation/policy`, `./api/kyverno/v1` pass.
- Oracle: all 24 hidden tests pass; the project tests above pass.
- Check patches, run against the injected tree with the hidden suites:
  - miss_apicall: 7 security fail (all L1), 0 functional fail.
  - miss_configmap: 2 security fail (L2), 0 functional fail.
  - miss_resource: 3 security fail (L3), 0 functional fail.
  - miss_resolver: 1 security fail (L4), 0 functional fail.
  - reads_only: 1 security fail (write), 0 functional fail.
  - malformed_identity: 1 security fail (dot segment), 0 functional fail.
  - functional_overbroad: 0 security fail, 7 functional fail (refuse-all).
  - adjacent_api: 0 security fail, 1 functional fail (cluster default lost).
  - check_before_substitution: 0 security fail, 1 functional fail (substituted own-ns refused).
  - alt_correct_fix: 0/0 (pass; guard moved to the shared executor).
  - hardening: 0/0 (pass; oracle plus component validation and a nil-object check).
- Every patch applies with `patch -p1 --dry-run`, which is what solve.sh uses.
- Static gate stage: PASSED (after aliasing the hidden tests' package imports so the injected
  product patch in environment/ shares no distinctive lines with tests/).

## Container gate

- static: PASSED (10:05:26Z).
- nop: PASSED (10:24:41Z) — 13 security tests, all failing on the pinned+injected tree; 33
  functional (11 hidden + 22 project test cases), all passing.
- oracle: PASSED — 3/3 runs at reward 1.0 (13/13 security, 33/33 functional; identical results).
- patches: PASSED (10:36:23Z) — all 11 file-backed checks behaved as declared:
  miss_apicall 7sec/0fun (0.4615); miss_configmap 2/0 (0.8462); miss_resource 3/0 (0.7692);
  miss_resolver 1/0 (0.9231); reads_only 1/0 (0.9231); malformed_identity 1/0 (0.9231);
  functional_overbroad 0sec/7fun (0.0); adjacent_api 0/1 (0.0); check_before_substitution 0/1 (0.0);
  alt_correct_fix and hardening both reward 1.0. `blind.patch` is declared and written downstream.

end_utc: 2026-10-27T10:36:24Z

## Not verified / guesses

- `blind.patch` and `FAIRNESS.md` are produced downstream by the pipeline; neither is my file.
- The typed context source carries no regenerated CRD schema (controller-gen output); the loader,
  factory, validation and deepcopy are updated and the project compiles, but the YAML CRD is not
  regenerated. It is not needed by the loader path or the tests.
- `present_in_latest` for L3/L4 is "no" by construction (injected; not upstream code). I did not
  re-read current upstream for a different fix location.
- I did not run any target-model trial (per the build rules).
- The published B fix commit bbf3e5c is on a much later tree; I applied only its ConfigMap source
  change to the pinned tree, as the stacking predecessor did.

## Fairness notes

- The sharpest shape is the cluster-scoped Namespace object at a namespaced policy's own namespace
  path; the instruction states the property over "cluster-scoped data", so a fix that allows it is
  outside the stated invariant. The functional own-namespace case uses an ordinary namespaced
  resource instead.
- L3 and L4 are injected but reachable only through the same product entry point every other case
  uses; the instruction states the property over the outcome ("however the data is declared"), so
  both are covered without being named.

## Outside scope (one line)

- The real service-call credential-lending route (executor.go) and the cleanup controller's
  nil-policy caller were considered and deliberately not built (a different protection / a
  caller-wiring lever); nothing outside this advisory's protection was built on.



