# tinyauth-s4 build notes

Started: 2026-10-30T17:47:03Z (UTC). Builder: Claude Code (build-v1), pattern A, injected track.

Repo: tinyauthapp/tinyauth. Pinned 79bcccbe43a28bc392dae432a91210ca297fb854.
Published fixes: e75605b2c534ec83525a33603e16d76baca13399 (domain-check helper; the advisory
fix) and 80bc87188ec3aabc5104c249eaa7b997973b9275 (later provider rework).

## Scope and the one security property

Report leads to the static per-app ACL lookup: a per-app rule is selected by raw string
equality of the request host and the configured app address, with a first-label app-name
fallback. A spelling difference makes the rule invisible; the rule then abstains and the
default `allow` policy admits any authenticated user (fail-open).

One property, written once over the outcome:

> No signed-in user may be let through to an application whose access rule does not admit
> them, however the application is named in the request (capitalization, trailing dot,
> explicit/implied port, internationalized spelling) and however the rule itself names it,
> including rules provided before the request arrived. A user the rule admits is still let
> through.

The property is over "every rule the service has been given"; it names no source, route or
stage. Every sibling and shape below falls under it literally.

## Levers (each with a different reason a solver skips/mishandles it)

L1 (MAIN, how-type; injected; producer off the check's path). A third ACL source injected as
a plausible maintenance addition: a mounted-ConfigMap label provider. It builds an index in
a background resync (infrastructure), and `GetLabels` only reads that index. The resync
registers an app only when the mount's `hosts` list contains the app's declared address by
exact string; the index and the lookup are keyed by raw strings. A mount declaring
`APP.example.com` with app address `app.example.com` never enters the index, so the rule is
invisible and the request fail-opens. Fixing only the lookup cannot help (no entry), and
fixing only the resync cannot help for a request spelled in the other case; both are needed.
Dismissal: it is a separate opt-in source, the report shows the static config, and models
trace only into what the check calls, not back to where its index came from.

L2 (where-type; REAL upstream far site; second implementation). `internal/service/docker_service.go`
has its own copy of the exact-domain + first-label comparison for Docker container labels.
Opt-in `LABEL_PROVIDER=docker`. Testable end-to-end with a fake Docker Engine API over a unix
socket (the authority is stubbed, the product code is real). Dismissal: a separate opt-in
feature; the report's example is the static config, so a shallow fix stops there.

L3 (how-type; coupled must-keep-working value; REAL upstream). The first-label app-name
fallback and exact-address precedence. A fix that replaces the fallback with canonical exact
equality is "obvious" and breaks deployments addressed by short name (including deeper
subdomains); a fix that only case-folds the exact comparison leaves the fallback bypass
(`MYAPP.example.com` vs app `myapp`). Functional tests keep the fallback and precedence; a
security test drives the uppercase fallback.

L4 (where-type; the reported landing point). The static config lookup itself (the shortcut
fix is lowercase/EqualFold on the exact compare only).

L5 (REAL upstream far site, not exercised offline). Kubernetes `GetLabels` + the ingress
cache producer (`updateFromItem` exact `slices.Contains(hosts, domain)` and raw index keys).
The oracle fixes it; the verifier has no cluster API and cannot drive it, so no hidden test
depends on it. Noted, not counted as a lever.

## Full candidate list (screener O8/O8b + own search)

Real code that decides which per-app rule applies, or feeds that decision:
1. internal/service/access_controls_service.go:40-53 static lookup (reported landing).
2. internal/service/access_controls_service.go:56-72 static-then-provider dispatch.
3. internal/service/docker_service.go:71-114 Docker label provider (chosen, L2).
4. internal/service/kubernetes_service.go:365-386 K8s GetLabels cache lookup (oracle only, L5).
5. internal/service/kubernetes_service.go:141-173 K8s raw-domain/app-name indexes.
6. internal/service/kubernetes_service.go:237-276 ingress resync registration gate (producer;
   oracle only, no cluster offline).
7. internal/controller/oauth_controller.go:313-366 isRedirectSafe (second hostname consumer;
   at pinned already EqualFold and fail-closed; not an ACL fail-open; refactored by the fix,
   covered functionally by the project's own oauth tests; rejected as a lever).
8. internal/service/oidc_service.go:387 trusted redirect URI exact match (fail-closed client
   allowlist; out of scope per screener; rejected).
9. internal/utils/app_utils.go:15-53 GetCookieDomain (cookie host normalisation, not an ACL
   decision; rejected).
10. internal/utils/decoders/label_decoder.go:7-17 generic label decoder (reused by L1; no
    trust decision of its own; not a separate site).
11. internal/bootstrap/service_bootstrap.go:72-139 provider selection (extension point for L1;
    wiring, not a decision).
12. internal/controller/proxy_controller.go:379-476 three host producers (ForwardAuth header,
    AuthRequest parsed URL, ExtAuthz request host). Same sink; the shapes are normalisation
    variants of the reported input; used as shape coverage, not as a lever.
13. internal/model/config.go Apps/App schema + internal/utils/loaders (file/env/flag routes for
    the same schema). Same lookup sink; a second loader adds no separate comparison.
14. internal/service/policy_engine.go:83-96 + access_controls_rules.go:38-40 default-policy
    fail-open when ACLs are nil. This is the impact mechanism, not a site to fix separately.

Injected-sibling candidates considered:
A. Third label provider "configmap" (file/mount-backed), mirroring the Docker/k8s provider
   shape, with a background resync building the index. CHOSEN (L1): most complex, two coupled
   sites (producer + check), realistic (K8s ConfigMap mounts; the project already hosts two
   label providers), testable offline, and its two sites give different dismissal reasons.
B. Fourth proxy-context extractor for another dialect (HAProxy etc.) supplying a different host
   shape. REJECTED: same sink, and the only new failure is a normalisation variant of the
   stated input (models catch these); no new mechanism.
C. Second decoder for ConfigMap/API feeding model.Apps. REJECTED as a separate sibling: the
   decoder has no trust decision; the provider that uses it is A.
D. Compose-file provider. REJECTED: same concept as A (file-backed labels), redundant.
E. Built-in default app merged into NewDefaultConfiguration. REJECTED: contrived; no plausible
   user-facing reason for a default app rule, and it is a defaults route with a trivial fix.
F. Hot reload/save path for apps config. REJECTED: no separate comparison, and hiding a whole
   new reload feature is unfair rather than difficult.
G. ACL cache decorator keyed differently from the lookup. REJECTED: order-dependent and
   subsumed by the lookup fix; flaky.

Picked: A (both its sites) as the injected sibling, plus the real Docker far site (L2) and the
real coupled fallback (L3). The candidate list above is complete for this repository.

## Sites, routes, shapes covered by hidden tests

Routes (all real entry point: HTTP to /api/auth/:proxy, through the built server):
- traefik/caddy ForwardAuth (x-forwarded-host header) - landing and Docker/ConfigMap routes.
- nginx AuthRequest (x-original-url URL) and envoy ExtAuthz (request Host) - shape coverage.
Shapes: mixed case; trailing dot; explicit port; internationalized spelling (on the static
lookup); mixed case on the name fallback. Rule sources: static config, Docker labels,
ConfigMap mount.

Coupled must-keep-working (functional): exact address match; short-name fallback incl. deeper
subdomain; exact address beats short name; default policy for uncovered hosts; a matching
rule's response headers/basic auth; Docker and ConfigMap legitimate use.

## Oracle and wrong fixes

Oracle = upstream e75605b helper (pkg/validators) + static lookup + OAuth redirect refactor,
extended to the real Docker/Kubernetes providers, the injected ConfigMap lookup and the
injected ConfigMap resync producer.
Wrong fixes: per-lever security_fail (no-Docker, no-producer, no-ConfigMap, static-case-only),
a functional_fail over-broad exact-only fix, a refuse-all and a crash-as-refusal patch, the
required hardening and alternative pass patches. Blind patch and FAIRNESS.md are left for the
later stages as instructed.

## Verified so far

- Pinned tree builds (`go build ./...`) with a placeholder frontend dist; the project's own
  service+controller tests pass at the pinned commit.
- The static-config bypass reproduces end-to-end through the built binary over a unix socket:
  an authenticated user not in the app's allow list is admitted for `APP.example.com`, for
  `app.example.com:443` and for `App.Example.Com.`, and is refused for the exact address.
- The Docker label provider bypass reproduces end-to-end with a fake Docker Engine API over a
  unix socket: exact address refused, `APP.example.com` admitted.
- The injected ConfigMap provider reproduces both failure modes end-to-end: a mixed-case
  request when the mount declares the host in lower case (lookup), and an exact-case request
  when the mount declares the host in upper case (producer).
- The reference fix passes 15/15 security and 13/13 functional tests; the injected pinned tree
  gives 0/15 security and 13/13 functional. The alternative design (a `NormalizeHost` helper in
  `internal/utils`, no `pkg/validators`) and the hardening variant both pass 15/15 and 13/13.
- Wrong-fix matrix (local, same suites the verifier runs):
  - sf-no-docker: 3 security failures (the Docker tests), 0 functional.
  - sf-no-configmap: 4 security failures (the ConfigMap tests), 0 functional.
  - sf-no-producer: 2 security failures (the two mount-host tests), 0 functional.
  - sf-static-case-only: 11 security failures, 0 functional.
  - sf-canonicalize-after-lookup: 15 security failures, 0 functional.
  - ff-exact-only: 2 security and 3 functional failures (short-name fallback removed).
  - refuse-all: 12 functional failures, 0 security.
  - crash-as-refusal: 15 security and 7 functional failures (refusals became 500s).
- `injection.patch` applied to the pinned archive reproduces the injected tree byte-for-byte;
  `fix.patch` applied on top reproduces the reference tree byte-for-byte.

## As built

- Manifest: build/tinyauth-s4/manifest.json. Checks: build/tinyauth-s4/checks/*.patch.
- Blind patch and FAIRNESS.md are intentionally absent (written by the later stages).

## Gate results (run 2026-10-30, stages in order)

- static: PASSED. Conformance clean, no leak terms, no hidden-test content in environment/,
  no exact-status assertions in security tests. Only the not-yet-written blind patch and
  FAIRNESS.md remain.
- nop: PASSED. 15/15 security tests fail on the pinned+injected tree, 13/13 functional pass;
  reward 0.0 (metrics passed 13/28).
- oracle: PASSED 3/3 independent runs, reward 1.0 each, 15/15 security and 13/13 functional,
  identical results across runs.
- patches: PASSED all 10 readable checks:
  - sf-no-producer: security_fail (2 ConfigMap tests), functional green.
  - sf-no-configmap: security_fail (4 ConfigMap tests), functional green.
  - sf-no-docker: security_fail (3 Docker tests), functional green.
  - sf-static-case-only: security_fail (11 tests), functional green.
  - sf-canonicalize-after-lookup: security_fail (15 tests), functional green.
  - ff-exact-only: functional_fail (3 short-name tests; also 2 security).
  - refuse-all: functional_fail (12 tests).
  - crash-as-refusal: functional_fail (7 tests; also 15 security).
  - pass-hardening: pass, reward 1.0.
  - pass-alt: pass, reward 1.0.
- End: 2026-10-30T18:23:43Z.

## Unknowns / unverified

- Kubernetes cluster path cannot be exercised offline; fixed in the oracle but no hidden test
  depends on it (the injected ConfigMap producer is the tested stand-in for the same mechanism).
- The OAuth redirect comparison is refactored by the oracle (as in the published fix) but no
  security assertion targets it; at the pinned commit it is already case-insensitive and
  fail-closed, so it is not a lever.
- Whether the two target models fail 3/3 is not measured here; that is the trial stage.
