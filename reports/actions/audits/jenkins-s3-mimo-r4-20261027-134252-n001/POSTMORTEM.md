# Post-run audit: jenkins-s3__9GWzsoL

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.0.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.0 fairly reflects the code at the 2-hour cutoff. Under the threshold rule, the two errors in the project's own RobustReflectionConverterTest (these pass on the vulnerable tree and with the oracle fix) are enough to give 0. Four security tests also fail. The model spent about 1h46m reading and designing, with 5-13 minute gaps between tool calls. It wrote all of its code in the last ~13 minutes (first Write at 15:34:53, timeout at 15:48:29), compiled once and never ran a test. Its last message says it was moving on to 'the HTTP layer — rollback and 4xx for refused submissions', which it never wrote. So its new ForbiddenTypeException, a CriticalXStreamException that aborts the whole document, most likely surfaces as a server error. The time limit cut the work short, but the code also has a design gap that more time on the same plan would not have closed. Its forbidden-type policy covers only Stapler/servlet classes and hudson.Plugin*/UpdateCenter. It never looked at jenkins.security.ResourceDomainRootAction, so the Redirection and InternalResourceRequest routing objects are still recreated. The tests accept either a 4xx refusal with nothing applied, or a 2xx where the bad value is dropped and the rest applied, exactly as the instruction says. The reference fix (readResolve guards plus element-type converter branches) is consistent with the instruction and tests. I found no contamination. Confidence is medium, not high: the verifier logs are outside the audit folder, so the exact failure messages for the job-property test and the two RobustReflectionConverterTest errors could not be read. Their attribution to the model's untested converter changes is an inference.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| bench.SecurityRoutingObjectsTest::requestRedirectionIsNotRecreated | fail | genuine-fail | True | True |
| bench.SecurityRoutingObjectsTest::internalResourceRequestIsNotRecreated | fail | genuine-fail | True | True |
| bench.SecurityRoutingObjectsTest::pluginWrapperIsNotRecreated | fail | genuine-fail | True | True |
| bench.SecurityCopyOnWriteJobPropertiesTest::unrelatedTypeInJobPropertiesIsNotKept | fail | genuine-fail | True | True |
| hudson.util.RobustReflectionConverterTest::testCliFailure | fail | genuine-fail | True | True |
| hudson.util.RobustReflectionConverterTest::testRestInterfaceFailure | fail | genuine-fail | True | True |

**Lookup or leak:** None found. The transcript shows no access to /tests or .htests and no curl, wget or github requests. The model worked only from /workspace sources and javap on local jars. Its design is its own (ForbiddenTypes/ElementTypes helpers) and does not resemble the upstream readResolve guards. The run had no tool calls during the grading window (run.json timing.tool_calls_during_grading = []), so the graded code is the code at the timeout.

**Evidence:**
- evidence/run.json: exception AgentTimeoutError 'Agent execution timed out after 7200.0 seconds'; agent_end 15:48:29; tool_calls_during_grading []
- agent/claude-code.txt: first tool call 13:48:33; first Write 15:34:53 (CriticalXStreamException.java); last tool call 15:47:26. ~1h46m of reading and design with 5-13 minute gaps, then all code written in ~13 minutes
- evidence/transcript.md:366-375: one core compile succeeds, then 'Core compiles. Now the HTTP layer — rollback and 4xx for refused submissions.' The transcript ends there, and no test was ever run
- evidence/final-code/changed_files.tsv: no View.java/AbstractItem.java/Computer.java changes, so the planned 4xx refusal handling was never implemented
- evidence/final-code/changes.patch:1203 (ForbiddenTypeException javadoc): 'the web layer reports it as a client error (4xx)' is a claim with no implementation behind it
- evidence/final-code/changes.patch ForbiddenTypes.isRequestRouting: only 'org.kohsuke.stapler.' / 'io.jenkins.servlet.' and Stapler classes, nothing for jenkins.security.ResourceDomainRootAction$Redirection / $InternalResourceRequest
- evidence/tests/security/SecurityRoutingObjectsTest.java:31-38: accepts a 4xx with nothing applied, or a 2xx with the payload nulled. Only <500 is required
- evidence/instruction.md property 2: 'must never recreate ... an object that exists only to route or dispatch a request, or to describe, load or manage a plugin ... even when it is supplied under a field whose declared type would otherwise admit it'
- evidence/build-notes.md 'Gate': nop passes all functional tests including the 3 RobustReflectionConverterTest tests; oracle 24/24 three times; alternative correct fix at a different layer also 1.0
- evidence/solution/fix.patch:191-211: readResolve guards on Redirection and InternalResourceRequest, consistent with the instruction and tests
- evidence/grading/results.json: 6/10 security pass, 12/14 functional pass, reward 0.0 (threshold: any functional failure gives 0)

**Recommended action:** Accept reward 0.0 as a model failure. If timeouts are reported separately (TIMEOUT_POLICY=exclude), list this run as a timeout. The partial code also had a real coverage gap (ResourceDomainRootAction routing objects) and broke existing tests, so this is not purely a time-limit artifact. To confirm the exact failure messages of SecurityCopyOnWriteJobPropertiesTest and the two RobustReflectionConverterTest errors, read the verifier logs (verifier/functional.log, security.log), which are outside this audit folder. No task change is needed.
