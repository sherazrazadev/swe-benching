# Post-run audit: plugins-s4__6DPkdut

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.7143.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

The model (mimo-v2.6-pro) did a careful fix for the pod-spec route. It added ka.req.pod.initContainers.* and ka.req.pod.ephemeralContainers.* fields with the right shape (no ephemeral host_port), made extraction generic per list, kept the regular-list and deprecated fields unchanged, and extended the Privileged, Running As Root and Privilege Escalation rules to cover init and ephemeral lists. That is why 5/7 security and 14/14 functional tests pass. Both failures come from one gap: adding an ephemeral container through the pods/ephemeralcontainers subresource. That request is an update and carries the list at the top level, requestObject.ephemeralContainers. The model only reads requestObject.spec.<list>, and every rule it changed still requires kcreate, so this route is neither extracted nor reported. The instruction covers the route in general terms: 'every container the request would run ... wherever that container is declared', 'every container list a request can carry', and 'These requirements cover the whole shipped detection'. It never names the route. The model read the whole shipped rules file, and according to the build notes that file already has an 'EphemeralContainers Created' rule that reads /requestObject/ephemeralContainers (I could not see that text because the transcript output is truncated). The reference fix handles both shapes and adds an update/patch rule. A thorough expert fix would reach this route, so the failures are the model's own shortfall under a fair grader. Confidence is medium, not high, for two reasons. First, the top-level 'EphemeralContainers' object is the older Kubernetes API shape: newer clusters send a Pod object to this subresource. But the model's rules would not fire on an update of either shape, so the rule-firing failure stands either way. Only the extraction test turns purely on payload shape. Second, the transcript is truncated. No infra problems: the grading results are complete, no tool calls happened during the grading window, and no exception was recorded. No contamination was seen. One note on passing tests: the model also widened the trusted-image allowance on the HostNetwork, HostPid, HostIPC and sensitive-mount rules, so a trusted image in an init or ephemeral container now suppresses an alert for an untrusted regular container. That arguably breaks 'the existing trusted-image allowance remains the only exception'. No test checks it, but it could only lower the score, so it does not inflate the reward.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| TestSecPrivilegedEphemeralContainerReported | fail | genuine-fail | True | True |
| TestSecEphemeralContainerValuesExtracted | fail | genuine-fail | True | True |

**Lookup or leak:** None seen. The transcript shows only local workspace exploration (fields.go, extract.go, the rules yaml, CI workflows, sibling k8saudit plugins), offline go build and test runs (GOPROXY=off), and the model's own temporary test file. It did not read the hidden tests or the solution, made no web or network fetches, and did not copy the upstream fix.

**Evidence:**
- evidence/grading/results.json:4,9 - only TestSecPrivilegedEphemeralContainerReported and TestSecEphemeralContainerValuesExtracted fail; all 14 functional tests pass
- evidence/tests/security/zz_sec_test.go:41-50 - the ephemeral test uses Verb update, Subresource ephemeralcontainers, Request zzEphemeralSubresourceObject
- evidence/tests/support/zz_support_test.go:198-207 - the subresource payload puts ephemeralContainers at the top level of requestObject
- evidence/final-code/changes.patch:414 - extraction path is always 'requestObject','spec',listKey
- evidence/final-code/changes.patch:1065-1069,1156-1160 - every modified rule keeps 'kevt and pod and kcreate'; no update or subresource rule added
- evidence/solution/fix.patch:266-277 - reference falls back to requestObject.ephemeralContainers; fix.patch:463-469 adds an 'Add Privileged Ephemeral Container' rule on pod_subresource and kmodify
- evidence/instruction.md:14-16,21-25,32 - 'every container the request would run ... wherever that container is declared'; 'every container list a request can carry'; 'cover the whole shipped detection'
- evidence/build-notes.md:25-32,77-78 - L1 lever: the subresource payload shape; the existing EphemeralContainers Created rule uses the top-level path
- evidence/transcript.md:13 - the model read the full k8s_audit_rules.yaml
- evidence/run.json:12-19 - tool_calls_during_grading is empty and exception_info is null
- evidence/final-code/changes.patch:1078-1121 - widened trusted-image allowance on hostNetwork/PID/IPC/sensitive-mount rules (not tested)

**Recommended action:** Accept the 0.7143 reward as a fair measure: the model missed the pods/ephemeralcontainers route. Optional task improvements: (1) also test the current Kubernetes subresource shape, a Pod object with spec.ephemeralContainers on update, so the extraction test does not hinge only on the older top-level shape; (2) add a functional test that a trusted image in an init or ephemeral container does not suppress alerts for an untrusted regular container on the host-namespace and sensitive-mount rules.
