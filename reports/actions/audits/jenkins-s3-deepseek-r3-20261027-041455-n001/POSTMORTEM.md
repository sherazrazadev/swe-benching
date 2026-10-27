# Post-run audit: jenkins-s3__FMEhYKA

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.6.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.6 (6/10 security, 14/14 functional) is a fair grade of the model's work. The model closed the element-type gaps for copy-on-write, persisted, describable and plain lists. It missed three things. (1) It takes the element type from erasure of the field signature, so for DescribableList<T,...> declared on a generic base the bound becomes Describable and AttackType is kept. (2) Its deny-list never covers ResourceDomainRootAction$Redirection or $InternalResourceRequest; the transcript never looks at that class. (3) Its deny-list rejects every hudson.Plugin subclass, so the legitimate Plugin$DummyImpl payload is lost instead of only its PluginWrapper being dropped. All four failing properties are stated in the instruction, and the oracle and an alternative-layer fix pass them. No contamination or infra fault.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| bench.SecurityGenericGroupTypeTest::unrelatedTypeInGroupEntriesIsNotKept | fail | genuine-fail | True | True |
| bench.SecurityRoutingObjectsTest::requestRedirectionIsNotRecreated | fail | genuine-fail | True | True |
| bench.SecurityRoutingObjectsTest::internalResourceRequestIsNotRecreated | fail | genuine-fail | True | True |
| bench.SecurityRoutingObjectsTest::pluginWrapperIsNotRecreated | fail | genuine-fail | True | True |
| functional group (bench.Functional* + RobustReflectionConverterTest + DescribableListTest) | pass | lenient-test | True | True |

**Lookup or leak:** None found. The hidden tests live only in the separate verifier image (tests/Dockerfile 'Nothing in this directory is ever visible to the agent'; test.sh locks /tests). The transcript shows no access to /tests or .htests and no network or upstream lookup: it only greps, reads and javaps local sources and jars. The patch is clearly not the upstream fix: it uses a ThreadLocal element-type stack and a global deny-list, with no readResolve guards. run.json shows 0 agent events after agent_end and no tool calls during the grading window.

**Evidence:**
- evidence/grading/results.json: security fails = GenericGroupType, Routing(redirection, pluginWrapper, internalResourceRequest); all 14 functional pass; reward 0.6
- evidence/run.json: agent_events_after_end 0, tool_calls_during_grading []; exception_info null
- evidence/final-code/changes.patch:281-296 getCollectionElementType uses Types.erasure(Types.getTypeArgument(baseType,0,Object.class)) with no type-variable resolution
- evidence/final-code/changes.patch:425-444 REJECTED_TYPES list includes Plugin.class and Descriptor.class but no ResourceDomainRootAction inner classes
- evidence/transcript.md:220 probe output 'Collection base=java.util.Collection<T> arg0=T erasure=interface hudson.model.Describable'
- grep of evidence/transcript.md for 'ResourceDomain|Redirection|InternalResourceRequest' returns no hits
- evidence/instruction.md: 'must never recreate ... an object that exists only to route or dispatch a request, or to describe, load or manage a plugin ... even when it is supplied under a field whose declared type would otherwise admit it'
- evidence/tests/security/SecurityRoutingObjectsTest.java: submit() accepts status>=300 if nothing is applied; pluginWrapper case asserts payload instanceof Plugin and getWrapper()==null
- evidence/solution/fix.patch: readResolve guards on PluginWrapper, Redirection, InternalResourceRequest plus extractElementType resolving TypeVariable against runtime class, which is consistent with the instruction and tests
- evidence/build-notes.md: oracle 1.0 x3; alternative fix at a different layer scores 1.0; missing generic/redirection levers each fail exactly their test
- evidence/grading/test-stdout.tail.txt is empty, so the exact assertion messages are not visible; this does not undermine the verdict

**Recommended action:** Keep the 0.6 as a model-failed result. Optionally strengthen the functional suite with a case that reloads a persisted Descriptor/GlobalConfiguration or Plugin configuration. Global deny-lists of Descriptor or Plugin would then score 0 under the threshold rule instead of partial credit.
