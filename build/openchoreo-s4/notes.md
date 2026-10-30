# openchoreo-s4 — build notes

Started: 2026-10-29T17:14:07Z (driver start); builder session began 2026-10-29T17:14Z
Ended: 2026-10-29T18:23Z

Advisory: GHSA-C5F6-2RM9-2W8G / CVE-2026-73840 / GO-2026-6360 — webhook signature verification that
fails open (CWE-287 / CWE-290 / CWE-345). Repo openchoreo/openchoreo. Pinned 8b1835244bae,
published fix f540553db714 (the other two listed commits are backports to release branches and were
not used). Pattern A+B, track injected.

## Levers, one line each

1. **L1 (coupled, how-type).** `webhook_handler.go:59,66-80` never forwards a credential for the
   Bitbucket branch (the branch asks for no signature header and the extractor has no case for one,
   and the generated request parameters have no field for it), so a fix that only makes the
   validator reject the empty token also rejects every genuine delivery. Reason to skip: the report
   shows an unsigned forgery, so "reject the empty credential" looks complete.
2. **L2 (how-type, missing authority).** `service.go:56,83-111` turns a missing/empty
   `bitbucket-secret` into an empty HMAC key; an empty key is a key anyone can sign with. A fix that
   keeps the allow-empty path (and an HMAC helper without an empty-secret guard, like the pinned
   GitHub validator) still accepts a forged digest. Reason to skip: "no secret configured is an
   operations problem, not an authentication decision".
3. **L3 (how-type, shape).** The hosting service must be classified from the same normalised form
   the matcher uses (`webhook_processor.go:332-347`). Location forms the parser cannot see a host
   in (scheme-less `github.com/org/repo`, `ssh://` forms) make a plausible check return no service
   and skip the rule. Reason to skip: "no host, so the service cannot be inferred — skip".
4. **L4 (how-type, route where protection never existed).** `webhook_processor.go:147-160`
   decides every build by repository matching alone; the service that authenticated the delivery is
   never compared with the hosting service. Reason to skip: it is component selection, not
   authentication.
5. **S1 (injected, second validation implementation).** A Bitbucket Data Center compatibility
   provider (`provider.go:45`, `bitbucket_server.go:28-33`) returns nil for an unsigned Data
   Center-shaped delivery before the Cloud validation runs. Reason to skip: a compatibility path for
   a different product, in provider plumbing the report never mentions.
6. **S2 (injected, second sink path, how-type).** `webhook_processor.go:74` +
   `dependents.go:22-74` rebuild components that declare a build dependency on a matched component
   without applying the hosting-service rule. Reason to skip: dependency rebuilds are a feature, not
   an authentication decision.

## Every sibling candidate considered

1. Fourth provider in `git.GetProvider` selected by a new header — needs the touched detection
   function and the generated parameter layer. Rejected as a site; kept as the wrapper shape (S1).
2. Fail-open copies in `git/gitlab.go` — an empty GitLab token cannot be delivered (detection needs
   a non-empty header) and the service fails closed first. Rejected: unreachable.
3. Second caller of `webhookProcessor.ProcessWebhook` (replay/backfill CLI or admin route) — needs
   a new OpenAPI operation and generated bindings. Rejected: unreachable offline.
4. "Test / simulate webhook" endpoint calling the service directly — same generated-route problem
   and the route would have to be named in the instruction. Rejected.
5. Legacy repository extension aliases in `controller.ExtractComponentRepositoryPaths` — the same
   value feeds the match and the check. Rejected: no divergence.
6. Repository URL defaults from the workflow schema — same variable on both paths. Rejected.
7. Repository alias ConfigMap at match time — the check still sees the component's own URL.
   Rejected.
8. Looser `matchesRepository` (suffix/wildcard) — widens matching, the hosting rule still applies.
   Rejected.
9. `GitSecret`-based fallback secret — the call site would be inside the function the published fix
   rewrites. Rejected.
10. `WorkflowRunTrigger` second implementation / MCP `TriggerWorkflowRun` — a different protection
    (user-level authorisation), out of the advisory's scope. Rejected.
11. A "ping"/handshake short-circuit in the handler — returns before any build. Rejected.
12. Observer alert-webhook receiver — different product path, own authentication. Out of scope.
13. Branch/app-path filter variants — not authentication. Rejected.
14. **Picked S1**: Bitbucket Data Center compatibility wrapper in the provider factory (second
    implementation of the guarded operation, untouched file, plausible legacy assumption).
15. **Picked S2**: dependent-build fan-out in the processor (second sink path, new file, called from
    a function the published fix never edits, plausible "rebuild dependents" feature).

## Gate results (run one stage at a time)

- static: PASSED (no warnings; the blind patch and FAIRNESS.md are the only absences).
- nop: PASSED — 9 security tests all fail on the pinned+injected tree, 9 functional tests all pass.
- oracle: PASSED — 3 trials, each reward 1.0 and identical.
- patches: PASSED — all 14 checks behaved as declared (security_fail: miss-fail-closed 0.889,
  miss-provider-check 0.667, miss-shape 0.889, miss-compat 0.889, miss-dependents 0.889,
  crash-as-refusal 0.0, wrong-object 0.667, one-provider 0.889, check-after-adjustment 0.667;
  functional_fail: naive-bitbucket 0.0, refuse-all 0.0, adjacent-api 0.0; pass: hardening 1.0,
  alternative 1.0). The first patches run failed with an infra verdict because the miss-shape
  checks patch did not compile (a stray import removal in the variant generator); fixed, the
  variant re-verified, the patch regenerated and the stage re-run.

## What I verified

- Every security route reproduces on the pinned + injected tree through the real generated HTTP
  router and handler: 9/9 security tests fail there, 9/9 functional tests pass there.
- The reference fix scores 1.0: 9/9 security and 9/9 functional pass (JUnit + score.py pipeline
  exercised locally, reward 1.0).
- Each lever has a wrong-fix patch that leaves the matching security test failing while every
  functional test passes (results below), and the coupled L1 lever has a patch that breaks only
  functional tests.
- The project's own tests for the affected area (`internal/openchoreo-api/services/autobuild`,
  `internal/openchoreo-api/api/handlers`) pass at pinned + injection, both locally (18.7 s) and
  inside the environment image build. They are not used as a grading group: the published fix
  necessarily rewrites service_test.go, webhook_handler_test.go and webhook_processor_test.go
  because those tests encode the vulnerable behaviour.
- `hidden_test_leaks` and `exact_status_asserts` from the gate report nothing; the conformance
  check reports "conforming".
- Variant results (security pass/fail, functional pass/fail):
  - naive-bitbucket 9/0, 7/2 (functional fail, coupled L1)
  - miss-fail-closed 8/1, 9/0 (L2)
  - miss-provider-check 6/3, 9/0 (L4)
  - miss-shape 8/1, 9/0 (L3)
  - miss-compat 8/1, 9/0 (S1)
  - miss-dependents 8/1, 9/0 (S2)
  - refuse-all 8/1, 0/9 (functional fail)
  - crash-as-refusal 0/1 (binary aborted), 9/0
  - wrong-object 6/3, 9/0
  - one-provider 8/1, 9/0
  - check-after-adjustment 6/3, 9/0
  - adjacent-api 8/1, 7/2 (functional fail)
  - hardening 9/0, 9/0 (pass)
  - alternative 9/0, 9/0 (pass; signature carried in the request context instead of the generated
    parameters, hand-rolled host extraction)

## What I could not verify / unknowns

- Whether Bitbucket Cloud really sends `X-Hub-Signature` with `sha256=<hex>`: taken from the
  published fix's own comments and the pinned GitHub implementation; no external documentation
  consulted.
- Whether a solve that implements the check in a *new* middleware registered only in
  `cmd/openchoreo-api/main.go` would be observed: the hidden harness wires the generated router with
  the product's raw-body middleware (as the existing handler tests do), not `main()`.
- Repository size: the pinned tree is ~39 MB of source; the module cache is ~2.5 GB.
