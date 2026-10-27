# Post-run audit: jenkins-s3__DwmAaHB

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.0.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.0 reflects the model's work. The model's fix (DeclaredTypeFilter after field conversion, a name/prefix-based MachineryTypes blocklist limited to org.kohsuke.stapler.*, jenkins.security.stapler.* and hudson.Plugin*, and a RefusedXmlException that remaps refusals to 400) left three security routes open. Redirection and InternalResourceRequest (jenkins.security.ResourceDomainRootAction$*) are not in its blocklist. Its type filter erases the type variable T of a generic base-class DescribableList to its bound, so an unrelated Describable passes. The fix also broke the project's own functional test RobustReflectionConverterTest::testRestInterfaceFailure. That test passed on the vulnerable tree and with the oracle, and the model changed exactly its path (AbstractItem.updateByXml error handling). The model only ran the core-module RobustReflectionConverterTest, never the test-module one. A single functional failure forces reward 0 under the threshold scoring. One security item (pluginWrapperIsNotRecreated) is borderline: the model refused hudson.Plugin itself, and the instruction does not clearly say whether a Plugin object counts as plugin-handling machinery. That item does not change the outcome. The agent timed out at 7200 s with no tool calls inside the grading window (run.json timing), so the graded code equals the harvested code. No contamination was found.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| bench.SecurityGenericGroupTypeTest::unrelatedTypeInGroupEntriesIsNotKept | fail | genuine-fail | True | True |
| bench.SecurityRoutingObjectsTest::requestRedirectionIsNotRecreated | fail | genuine-fail | True | True |
| bench.SecurityRoutingObjectsTest::internalResourceRequestIsNotRecreated | fail | genuine-fail | True | True |
| bench.SecurityRoutingObjectsTest::pluginWrapperIsNotRecreated | fail | instruction-ambiguity | False | True |
| hudson.util.RobustReflectionConverterTest::testRestInterfaceFailure | fail | genuine-fail | True | True |

**Lookup or leak:** None found. The transcript shows only local exploration of /workspace and /opt/m2, local compiles and core-module test runs. It shows no access to /tests or .htests, no references to bench.* hidden test classes, and no network fetches. The agent ran with no network (task.toml [agent] network_mode = no-network). The fix is original: a name blocklist plus a post-conversion filter, not the upstream readResolve approach.

**Evidence:**
- evidence/grading/results.json: 4 security fails (GenericGroup, Redirection, InternalResourceRequest, PluginWrapper), 1 functional fail (RobustReflectionConverterTest::testRestInterfaceFailure); reward 0.0
- evidence/tests/score.py:61-62: any functional failure gives reward 0.0
- evidence/final-code/changes.patch MachineryTypes: FORBIDDEN_NAME_PREFIXES = {"org.kohsuke.stapler.", "jenkins.security.stapler.", "hudson.Plugin"}; no ResourceDomainRootAction entry
- evidence/final-code/changes.patch DeclaredTypeFilter.typeArgument: Types.erasure(Types.getTypeArgument(baseType, index, Object.class)); no type-variable resolution against result.getClass()
- evidence/tests/harness/Group.java:8 'class Group extends DescribableGroupViewProperty<Entry>'; build-notes.md:9 describes the T erasure lever
- evidence/solution/fix.patch: extractElementType resolves TypeVariable via runtimeClass; readResolve guards on Redirection, InternalResourceRequest and PluginWrapper only (Plugin itself kept)
- evidence/tests/security/SecurityRoutingObjectsTest.java:76-79 requires payload instanceof Plugin on the 2xx path
- evidence/build-notes.md:16 nop passes all 14 functional tests; :18,26 oracle and alt-fix pass 24/24
- evidence/run.json timing: agent_end 06:24:36, tool_calls_during_grading [] (graded code is final harvested code); AgentTimeoutError at 7200 s
- evidence/transcript.md:552-555 run ends while the agent was still writing its own unit tests

**Recommended action:** Keep reward 0.0 as a model-failed result. As an optional task-quality follow-up, consider stating whether a hudson.Plugin instance itself counts as plugin-handling machinery, or let pluginWrapperIsNotRecreated accept a 2xx with payload dropped. This would not change this trial's outcome.
