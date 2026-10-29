# Post-run audit: plugins-s4__k4ZdozV

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.4286.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

The model added per-container fields for init and ephemeral containers. It also extended the three per-container rules (privileged, root user, privilege escalation) to cover all three container lists. The init-container detection tests pass for real. Four security tests fail, for two reasons, and the model is responsible for both. (1) Naming: the model published the new fields as ka.req.pod.init_containers.* and ka.req.pod.ephemeral_containers.*. The instruction says the new fields must use the existing per-container naming 'with the container list's own key in place of the regular list's key'. The regular list's key is 'containers' and the other lists' keys are 'initContainers' and 'ephemeralContainers', so the expected names are ka.req.pod.initContainers.* and ka.req.pod.ephemeralContainers.*. The reference fix uses those names, and the catalogue and extraction tests check them. Because of the naming, three tests fail even though the model's extraction logic itself looks correct. (2) Ephemeral request: the instruction asks to cover 'every container list a request can carry' and says the requirements 'cover the whole shipped detection'. The model's own extraction code reads the pods/ephemeralcontainers request shape, where the list sits at requestObject.ephemeralContainers. But every rule it changed still requires 'kcreate', and that request is an update, so no shipped rule fires for a privileged ephemeral container added that way. A correct fix would have to add or extend a rule for that request, as the reference fix does. Infra: run.json shows no exception and no tool calls during grading. test-stdout.tail.txt is empty, but results.json is complete (21 results) and its reward (3/7 security = 0.4286) matches. No contamination was found. Untested weakness: the model added 'and not ka.req.pod.init_containers.image.repository in (k8s_audit_privileged_images)' and the same clause for ephemeral containers. As a result, a pod whose init containers all use trusted images will suppress the alert for an untrusted privileged regular container. No hidden test checks this, so it does not change the reward, but it means a passing score here would overstate the fix.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| TestSecPrivilegedEphemeralContainerReported | fail | genuine-fail | True | True |
| TestSecFieldCatalogueCoversEveryContainerList | fail | genuine-fail | True | True |
| TestSecInitContainerValuesExtracted | fail | genuine-fail | True | True |
| TestSecEphemeralContainerValuesExtracted | fail | genuine-fail | True | True |

**Lookup or leak:** None found. The agent ran 'ls -la / /root /opt /tests' and a find for '*test*' looking for hidden test artifacts (transcript.md:51). The later find (transcript.md:184) turned up only its own /logs/agent files. It never read any zz_* test or test.sh content. Its network attempts were Go module downloads for the readme tool, which failed with EOF (transcript.md:158). No upstream fix was fetched; the repo has a single 'Starting project' commit (transcript.md:144).

**Evidence:**
- evidence/instruction.md:21-25 - 'under its existing per-container naming with the container list's own key in place of the regular list's key'
- evidence/instruction.md:32 - 'These requirements cover the whole shipped detection, not only the example above.'
- evidence/final-code/changes.patch:782-785 - model's cases 'ka.req.pod.init_containers.args' / 'ka.req.pod.ephemeral_containers.args'
- evidence/final-code/changes.patch:1551-1558 - Create Privileged Pod still gated on 'kevt and pod and kcreate'; no rule added for the ephemeralcontainers subresource
- evidence/final-code/changes.patch:1556-1558 - new 'and not ka.req.pod.init_containers.image.repository in (...)' clauses let a trusted init image suppress the alert for an untrusted privileged regular container (untested)
- evidence/solution/fix.patch:389-390 - reference names the fields with containerListFields("initContainers", ...) / ("ephemeralContainers", ...)
- evidence/solution/fix.patch:463-469 - reference adds 'Add Privileged Ephemeral Container' rule on pod_subresource and kmodify
- evidence/tests/security/zz_sec_test.go:122 - catalogue test builds names as 'ka.req.pod.' + list + '.' + suffix with list=initContainers/ephemeralContainers
- evidence/tests/security/zz_sec_test.go:44-47 - ephemeral detection event uses Verb update, Subresource ephemeralcontainers
- evidence/transcript.md:145-152 - model searched for naming hints, found camelCase segments already exist (ka.req.role.rules.apiGroups), still chose snake_case
- evidence/grading/results.json - 3/7 security pass, 14/14 functional pass, reward 0.4286
- evidence/run.json - exception_info null, tool_calls_during_grading []

**Recommended action:** Keep the reward 0.4286 as a valid model-failed result. Optional: state the expected field names explicitly in the instruction (e.g. 'ka.req.pod.initContainers.*') to remove any doubt about 'the container list's own key'. Also add a functional test where a trusted-image init container sits alongside an untrusted privileged regular container, so the allowance-widening bug is caught.
