# Findings to fix (plugins-s4) — owner-requested fairness check, 2026-10-29

Treat each item like a "Required" change from the fairness review.

## L1 (pods/ephemeralcontainers subresource) tests use a request shape Kubernetes no longer sends — test fault

- Both L1 tests build their payload with `zzEphemeralSubresourceObject` (tests/support/zz_support_test.go:200-207):
  `kind: "EphemeralContainers"` with a top-level `ephemeralContainers` list. That is the alpha-era API removed in
  Kubernetes 1.22. Since then the subresource takes a **Pod**: the audit log's requestObject carries the list at
  `requestObject.spec.ephemeralContainers` (current kubectl `debug` patches `spec.ephemeralContainers` via
  `pods.Patch(..., "ephemeralcontainers")`). Nothing in the pinned product code, tests or fixtures handles the
  legacy shape; the only hint is the stale rule output at rules/k8s_audit_rules.yaml:394.
- Verified in Docker (pinned tree + injection.patch): the oracle WITHOUT its top-level `ephemeralContainers`
  fallback (correct for the Pod shape, keeps the subresource rule) FAILS both L1 tests on the legacy payload
  (`rule set does not report this request` zz_sec_test.go:49; `ephemeralContainers.privileged: value not
  available` :267) and PASSES both with a Pod-shaped `update` payload.
- Required change (tests only, keep the lever): make the subresource payload a Pod (`kind: "Pod"`,
  `spec.ephemeralContainers`); preferably add a `patch`-verb variant whose body is
  `{"spec":{"ephemeralContainers":[…]}}`. Do NOT require the legacy top-level shape (accept it optionally or drop
  it). Keep requiring that a shipped rule reports the privileged subresource request (update/patch, not only
  create) and that `ephemeralContainers.*` fields are extracted for it. The reference fix must still pass; a
  Pod-only fix must pass too. Add a check patch `pass_pod_only` (expect pass) = the oracle minus the legacy
  top-level fallback.
