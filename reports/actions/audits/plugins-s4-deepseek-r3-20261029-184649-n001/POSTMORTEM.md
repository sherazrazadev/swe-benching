# Post-run audit: plugins-s4__CczNvUv

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.8571.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

The model added ka.req.pod.initContainers.* and ka.req.pod.ephemeralContainers.* fields to the catalogue, with correct extraction. Ephemeral containers get no host_port field, and their list is also read from the top level of the request object. In all three per-container rules (privileged, run-as-root, privilege escalation), it OR-ed in the init and ephemeral lists. However, every rule still requires `kcreate`. Kubernetes only adds ephemeral containers through an update or patch on the pods/ephemeralcontainers subresource, so a privileged ephemeral container added that way never triggers any rule. The only failing test, TestSecPrivilegedEphemeralContainerReported, checks exactly that request. The instruction covers this case: 'a value carried by any container must be reported, wherever that container is declared', 'for every container the request would run', 'These requirements cover the whole shipped detection'. The model had also seen the existing 'EphemeralContainers Created' rule, which uses `pod_subresource and kmodify` (transcript.md:26), so it knew this request path existed. The reference fix adds an 'Add Privileged Ephemeral Container' rule for that path. The test does not demand a particular rule name, layer or status code: any shipped rule that fires on the bad request and not on the benign one passes. No infra problems and no sign of contamination. The 6/7 security score is a fair measure of the model's work.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| TestSecPrivilegedEphemeralContainerReported | fail | genuine-fail | True | True |

**Lookup or leak:** None found. The agent wrote and later deleted its own scratch tests (zz_tmp_test.go, zz_sweep_test.go; transcript.md:151-235). Their names look like the hidden helpers, but their contents are the agent's own. Nothing shows it reading evidence/tests or fetching upstream code. There is no netguard log. The instruction says there is no network access.

**Evidence:**
- evidence/grading/results.json:4 TestSecPrivilegedEphemeralContainerReported fail; all other 21 tests pass
- evidence/tests/security/zz_sec_test.go:41-59 bad/benign events use Verb update/patch, Subresource ephemeralcontainers
- evidence/tests/support/zz_support_test.go:342-356 assertion only needs any rule firing for bad but not benign; rule name/layer irrelevant
- evidence/final-code/changes.patch:663-667 privileged rule still requires `kevt and pod and kcreate`
- evidence/solution/fix.patch:463-469 reference adds 'Add Privileged Ephemeral Container' with `pod_subresource and kmodify and ka.target.subresource in (ephemeralcontainers)`
- evidence/transcript.md:26 agent saw existing rule 'EphemeralContainers Created' using `pod_subresource and kmodify`
- evidence/instruction.md:13-15,28 'wherever that container is declared' / 'cover the whole shipped detection'
- evidence/run.json:12-19 no tool calls during grading window, exception_info null

**Recommended action:** Accept the reward of 0.8571 as a valid result: the model missed the ephemeral-container update/patch request path. No changes to the task are needed.
