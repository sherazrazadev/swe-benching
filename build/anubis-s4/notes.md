# anubis-s4 build notes

Start (UTC): 2026-10-29T11:42:36Z (build driver; work began immediately after)
End (UTC): 2026-10-29T12:33:54Z

## Task

One task from the advisory `GHSA-6WCG-MQVH-FCVG / CVE-2026-62314 / GO-2026-6639`
(techarohq/anubis, CWE-284 access control), pinned at `9f479f578a6dff8f531a049bbdf87619eb92bf9f`
with published fix `276b537776b281b1c4e01421435bc03ade3d8fc4`. Pattern `A+B`, track
`injected`.

The flaw in one line: when Anubis authorizes requests for a fronting proxy, policy rules that
decide on the request URL resolve the *internal* authorization call instead of the client's
request target that the proxy forwards.

## Levers (one line each)

- **T1** (A, published fix): regex path rules read only one forwarding field, so a deployment
  whose proxy uses the other standard field never matches the rule.
  `lib/policy/checker.go:110-125`. Reason to dismiss: the report shows one path rule and the
  primary field already works, so the secondary field reads like another proxy's concern.
- **T2** (A far site / second implementation, published fix): the expression engine resolves
  `path` itself and the deployment mode produced at policy loading is never threaded into it.
  `lib/policy/celchecker.go:61-90`, `lib/policy/policy.go:182`. Reason to dismiss: expression
  rules are a different kind of rule from the reported path rules.
- **T3** (input shape, how-type; real, **not** in the published fix): the forwarded request target
  carries the client's query string, so an anchored path rule misses `/admin?x=1`, while a
  parameter rule still needs that string. `lib/policy/checker.go:110-125`,
  `lib/policy/celchecker.go:73-74`. Reason to dismiss: the published tests show a prefix-shaped
  regex matching a target that carries a query, so the shape looks handled.
- **T4** (B, protection never existed): the expression engine's parameter value resolves the
  internal call's own query, so parameter rules never match in this deployment.
  `lib/policy/celchecker.go:77-78`. Reason to dismiss: the advisory names the path; a separate
  parameter value looks out of scope, and proxies are often assumed not to forward query strings.
- **I1** (injected): a whole-URL expression value resolves the internal call's request URI.
  `lib/policy/celchecker.go:75-76`, `lib/policy/expressions/environment.go:28`. Reason to
  dismiss: a newer convenience attribute that looks like it mirrors the path.
- **I2** (injected): a prefix path matcher copies the regex matcher's original shape and reads
  only the primary forwarding field. `lib/policy/prefixchecker.go:22-31`,
  `lib/policy/policy.go:164`. Reason to dismiss: the report is about path regexes, and a prefix
  match is unaffected by a query string.

## Sibling candidates found before picking

1. Expression-engine `query` in authorization-service mode — real upstream gap; picked as **T4**.
2. New whole-URL expression value — injected; picked as **I1**.
3. Variable declarations in the expression environment — same site as I1 (new attributes are
   registered there and resolved per name).
4. New `path_prefix` config matcher — injected; picked as **I2**.
5. Config-level query matcher (new rule field) — realistic, but the same concept as T4 and no
   extra mechanism; rejected as a duplicate.
6. Expression-engine `host` (returns the internal call's host) — real and still unresolved
   upstream, but the advisory's protection is path-based; rejected as a scope stretch.
7. `constructRedirectURL` already reads a forwarded target ungated — not an access-control
   decision; rejected.
8. `ogtags:allow` early return keys on the internal request URL — a separate whole-policy bypass,
   outside this advisory per the screener; rejected.
9. Thresholds: the screener suggested a `path` expression in a threshold is silently skipped.
   Checked at the pinned tree: the threshold environment declares only `weight`, so such a policy
   fails to load (`undeclared reference to 'path'`), not a runtime bypass. Rejected; the
   screener's lead was wrong.
10. Repeated-slash normalisation of the forwarded path — a real later upstream hardening, but an
    encoding/normalisation variant; rejected.
11. Client-supplied primary forwarding field in a deployment whose proxy does not set it — a real
    ambiguity, but the project's design assumes the proxy sets it; rejected as out of scope.

Why the picks beat the rest: T1 and T2 are the published fix's own sites (realism, and the
report leads near them); T3 is how-type, survives the published fix and is confirmed by a later
upstream security fix; T4 is a real route where the protection never existed; I1 and I2 are the
two most plausible maintainer leftovers, reachable through the real entry point, covered by the
one property, with distinct reasons to skip.

## What the property covers

One property, stated once in `instruction.md`: a rule that decides on the client's request URL
must be decided on the URL the client requested, whatever part of it the rule reads. Read
literally it covers every lever above and all their tests. The coupled must-keep-working value
is the direct-deployment containment: a request Anubis receives itself must ignore client
forwarding information, so a fix that always trusts the forwarded target fails the functional
suite.

## Verified

- Reproduced every security failure at the pinned tree through the real HTTP authorization
  endpoint (page-level and expression rules, both forwarding fields, query-bearing targets).
- Reference fix: security 9/9, functional 14/14. Nop tree: security 0/9, functional 14/14.
- Each check patch applied to the injected tree and behaved as declared; see
  `../work/anubis-s4/check_validation.json`.
- Project tests: `go test ./lib/policy ./lib/config` at pinned+injection; `go test ./...` at
  pinned+injection with the embedded assets built.
- The alternative fix (normalise the request URL once at the policy entry) scores 1.0 and keeps
  the project's own tests passing.
- Static gate: PASS (no warnings).
- Nop gate: PASS — 9 security tests, all failing on the vulnerable tree; 14 functional tests, all
  passing (trial `anubis-s4-nop-1793275415`).
- Oracle gate: PASS — three runs, reward 1.0, identical results.
- Patches gate: PASS — all 13 non-blind checks behaved as declared (security_fail: 8,
  functional_fail: 3, pass: 2). The blind pass patch is declared in the manifest and produced
  later by run_blindfix.

## Could not verify / guesses

- Repo size in MB was not measured; image build resource assumptions come from the build host.
- `present_in_latest` for the expression-engine parameter value is from a read of upstream
  `main` on 2026-10-29 (`cr.URL.Query()` still used); no release tag was checked.
- Nothing about the target models' behaviour was measured here; trials run later.
- Docker image build and verifier behaviour were verified only through the gate runs on this host.

## Scope notes

- The advisory's named X-Original-URI containment (GHSA-6wcg, PR #1616) is already in the pinned
  tree; this task builds on the follow-up fix (#1630).
- Outside the advisory, not built: `ogtags:allow` early return (`lib/anubis.go:243`) is a separate
  whole-policy bypass.
- Source and KB repositories were not committed or published.
