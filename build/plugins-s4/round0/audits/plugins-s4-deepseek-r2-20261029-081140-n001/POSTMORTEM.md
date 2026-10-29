# Post-run audit: plugins-s4__h4kPo6r

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.7143.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

The model built a clean, generic per-list extractor and field catalogue for initContainers/ephemeralContainers (no ephemeral host_port), and extended all three per-container rules (privileged, run_as_user, allow_privilege_escalation) to the init and ephemeral lists. All 5 init-container and catalogue security tests and all 14 functional tests pass. Both failures are the same gap: ephemeral containers are attached through the pods/ephemeralcontainers subresource (verb update), and the request object carries the list at top level (requestObject.ephemeralContainers). The model only reads requestObject.spec.<list> and only extended rules gated on `pod and kcreate`, so it never handles the one route that actually adds ephemeral containers. Its ephemeral terms in the pod-create rules do almost nothing in practice. The instruction covers this generally ('every container the request would run ... wherever that container is declared', 'whole shipped detection', 'close variants'). The repo also shows the shape: the shipped 'EphemeralContainers Created' rule reads %jevt.value[/requestObject/ephemeralContainers/0/name], and the model grepped and saw that line (transcript.md:24, :32). The reference fix handles both the top-level fallback and a subresource rule. Confidence is medium, not high, because the test uses the legacy top-level `EphemeralContainers` kind. A fix aimed only at the modern Pod-shaped subresource payload (spec.ephemeralContainers) would still fail the extraction half. Since the repo itself documents the top-level path, I treat this as a fair demand. No contamination and no infra problems.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| TestSecPrivilegedEphemeralContainerReported | fail | genuine-fail | True | True |
| TestSecEphemeralContainerValuesExtracted | fail | genuine-fail | True | True |
| TestFuncTrustedImageExceptionStillSuppresses | pass | genuine-pass | True | True |

**Lookup or leak:** None found. No WebFetch/WebSearch or network fetches in the transcript. Git history is a single squashed 'Starting project' commit (transcript.md:50). The model wrote and later deleted its own scratch test zz_local_check_test.go (transcript.md:145, :199). That file was its own work, not the hidden tests, which are staged only at grading time. No netguard.log is present. The grading window had no agent tool calls (run.json timing.tool_calls_during_grading = []).

**Evidence:**
- evidence/grading/results.json:4,9 - the only failures are TestSecPrivilegedEphemeralContainerReported and TestSecEphemeralContainerValuesExtracted
- evidence/tests/support/zz_support_test.go:198-207 - subresource request object has top-level 'ephemeralContainers' (kind EphemeralContainers)
- evidence/tests/security/zz_sec_test.go:41-50 - attack event is Verb update, Subresource ephemeralcontainers
- evidence/final-code/changes.patch:13-20 - ephemeral term added only under `kevt and pod and kcreate`
- evidence/final-code/changes.patch:424-429 - extraction path fixed to requestObject.spec.<listKey>, no top-level fallback
- evidence/transcript.md:24,32 - model saw shipped rule 'EphemeralContainers Created' using %jevt.value[/requestObject/ephemeralContainers/0/name]
- evidence/solution/fix.patch:266-277 - reference getContainerValues falls back to requestObject.<list> for ephemeralContainers
- evidence/solution/fix.patch:463-469 - reference adds 'Add Privileged Ephemeral Container' rule on pod_subresource + kmodify
- evidence/instruction.md:14-16,32 - 'every container the request would run ... wherever that container is declared'; 'whole shipped detection'
- evidence/build-notes.md:25-32 - L1 lever: pods/ephemeralcontainers subresource with top-level payload shape
- evidence/run.json:12-19 - no tool calls during grading window; exception_info null
- evidence/grading/test-stdout.tail.txt - empty (no infra error visible; results.json complete)

**Recommended action:** Accept reward 0.7143 as a fair measure (model-failed on the ephemeral-container subresource route). Optional task hardening: (1) also accept the modern Pod-shaped pods/ephemeralcontainers payload (requestObject.spec.ephemeralContainers on update) alongside the legacy top-level shape, or state in the instruction that requests may carry the list outside the pod spec. (2) Add a test that an untrusted privileged init container next to a trusted regular image is still reported. The current tests and oracle both miss that bypass of the trusted-image allowance.
