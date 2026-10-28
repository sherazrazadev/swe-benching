# vault-secrets-webhook-s2 — build notes

Start (UTC): 2026-10-27T19:15:00Z
Pinned: 71cfbb8907b2b7197e892570975428a447e615be
Fix:    76db45976fee0f54cafd94dffa425e6b542f65a0
Track:  injected; Pattern B (+ published pattern-A far site)

## What the product does
`bank-vaults/vault-secrets-webhook` is a Kubernetes mutating admission webhook. For Pods it
injects the vault-env/agent sidecars and env; for Secrets, ConfigMaps and unstructured objects it
resolves `vault:` references **itself** by constructing a Vault client and, when an object names a
ServiceAccount, minting a token for it and attaching it to the client. It also fetches image
metadata from the container registry while mutating a Pod.

At the pinned commit `pkg/common/addr.go` + `policy.go` already contain `ValidateObjectAddr`,
`AddrPolicy`, `ResolveObjectSkipVerify`, `SplitAndTrim` and their unit tests, but no production
code calls them. The published fix wires them into `newVaultClient` and `parseVaultConfig`.

## Candidate sibling sites / routes (every one found)
Into the webhook's own outbound Vault connection:
1. `pkg/webhook/webhook.go:196-235 newVaultClient` — address + skip-verify for /secrets,
   /configmaps, /objects. Published fix site.
2. `pkg/webhook/config.go:107-111` vault-addr provenance; `config.go:147-151` vault-skip-verify.
   Published fix sites.
3. `pkg/webhook/registry.go:162-196 getImageConfig` — object `registry-skip-verify` sets
   `InsecureSkipVerify` on the webhook's registry transport; reached from /pods via
   `pod.go:279 -> registry.go`. **Real, unmodified upstream; published fix never touches it;
   still ungated at current upstream (8b20f56).**
4. `pkg/webhook/webhook.go:213-235 vault-tls-secret` — object names a CA secret, but it is read
   from `mw.namespace` (the webhook's namespace), so the object cannot plant the CA. Dismissed.
5. `pkg/webhook/pod.go:87-96, 327-335` VAULT_ADDR/VAULT_SKIP_VERIFY env propagation — the webhook
   does not dial; the workload does, with its own SA. Dismissed as a security route; must keep
   working (functional).
6. `pkg/webhook/webhook.go:252-257` vault-path / auth-method / namespace options — no destination
   or TLS change. Dismissed.
7. `pkg/webhook/webhook.go:259-302` SA-token mint — credential issuance, not a connection; only
   its ordering relative to the address check matters (covered by the published fix).

Injected candidates (upstream-fix-untouched files only):
A. `pkg/webhook/pod.go` — best-effort Vault health probe before injecting the agent/ct sidecar; a
   second outbound Vault client built from the object-supplied address and skip-verify. Chosen.
B. `pkg/webhook/registry.go` — the real second transport above. Chosen (as the real Pattern-B row).
C. an object-supplied `vault-ca-url` fetch of CA PEM — new annotation; plausible but a new feature
   surface with no upstream grounding. Not chosen.
D. make `vault-tls-secret` read from the object namespace — would have to change the existing
   upstream security property and lives in webhook.go, which the published fix touches. Not chosen.
E. duplicate client construction in secret.go/configmap.go/object.go — no natural reason a
   maintainer would duplicate the factory. Not chosen.

## Levers (each with a different reason a solver would dismiss it)
- L1 address/provenance (published landing site; HOW-type via the coupled operator channel):
  the object `vault-addr` drives the client and the SA token. Reason to dismiss: "the annotation is
  a documented feature that must be trusted" / a fix that validates everywhere breaks the operator
  default and the documented pod propagation. Sites webhook.go:204, config.go:107.
- L2 object skip-verify (published far site, config.go:147-151; HOW-type separate TLS property):
  reason to dismiss: "the address was the reported problem; this is a separate documented TLS
  feature, and the address is already checked."
- L3 registry skip-verify (Pattern B, real unmodified upstream, registry.go:185-188; HOW-type
  route where the protection never existed): reason to dismiss: "a separate, documented feature
  for private registries with self-signed certificates; different annotation and transport."
- L4 injected pod health probe (pod.go; HOW-type second implementation): reason to dismiss: "the
  pod path only propagates the address to the workload; the webhook never dials it." It is
  object-address + object-skip-verify bearing blind SSRF/TLS weakening.

All four fall under one property, stated once in instruction.md. Chosen sibling picks beat C/D/E
because they are reachable through the real /pods entry point, need no new annotation or feature
surface, and are exactly where a maintainer would plausibly have left the same gap.

## Sites / routes / input shapes the security tests cover
- /secrets, /configmaps, /objects: object-supplied Vault address + object-supplied service account
  => attacker never receives the request; loopback, userinfo-bearing, query and fragment forms.
- /secrets: object-supplied skip-verify against an operator-configured self-signed TLS Vault.
- /pods: object registry-skip-verify against a self-signed TLS registry (no command in container).
- /pods: object address/skip-verify via the agent health probe (agent/ct annotation).

## Coupled must-keep-working (functional)
- Operator-configured `vault_addr` is trusted and the mutation completes end to end (local fake
  Vault), even though it is a loopback address.
- A Pod carrying a non-operator `vault-addr` still mutates and still receives it in its container
  env; the operator skip-verify default still applies.
- Operator `vault_skip_verify` and operator `registry_skip_verify` still take effect with no
  object annotation.
- The project's own tests (pkg/common, pkg/webhook) pass.

## To verify / could not verify
- Verified in scratch on the pinned tree: object address dials attacker (2 requests, SA token
  path), skip-verify true accepts a self-signed TLS peer, registry skip-verify serves /v2/,
  injected probe dials /v1/sys/health.
- Not verified yet: Docker image build and the full gate (run below).

## Built and verified locally (before the gate)
- environment/injection.patch adds the pod-path Vault health probe (pkg/webhook/pod.go).
- solution/fix.patch is a diff against pinned+injected: published source fix (provenance + guard +
  skip-verify policy + defaults) plus the registry gate and the probe guard.
- Security suite (8 functions, 11 testcases with 3 shape subtests) fails on pinned+injected and passes on the oracle.
- Functional suite (5 functions) passes on pinned+injected and on the oracle; the project's own
  pkg/webhook + pkg/common tests pass in both states.
- check patches verified locally: s_fail_addr, s_fail_skipverify, s_fail_registry, s_fail_probe,
  s_fail_failopen -> security fails / functional passes; p_fail_refuse_all -> security passes /
  functional fails; p_pass_hardening and p_pass_alternative -> all pass.
- Every check patch applies with patch -p1 to the injected tree.

## Gate runs (this build)
- static: PASSED.
- nop: PASSED (11 security testcases fail on pinned+injected, 59 functional testcases pass).
- oracle: PASSED 3/3 (reward 1.0, 70/70 each).
- patches: running (s_fail_addr, s_fail_skipverify, s_fail_registry, s_fail_probe,
  s_fail_failopen, p_fail_refuse_all, p_pass_hardening, p_pass_alternative; p_blind is supplied
  later by the blind-fix step).
- Images: environment and verifier images share the pinned+injected tree; the verifier restores
  only /workspace and runs fully offline. All test peers are loopback httptest servers.

## Patches stage result (2026-10-27)
- s_fail_addr, s_fail_skipverify, s_fail_registry, s_fail_probe, s_fail_failopen: each leaves a
  security test failing with all functional tests passing.
- p_fail_refuse_all: security passes, functional fails (operator address, pod propagation and the
  project's Vault-client metrics test).
- p_pass_hardening: reward 1.0 (oracle plus extra metadata-host and opaque-URL defence).
- p_pass_alternative: reward 1.0 (per-mutator address guard + registry check in the pod path).
- p_blind.patch: intentionally not written here; the blind-fix step supplies it.

## End (UTC)
2026-10-27T20:11:01Z
