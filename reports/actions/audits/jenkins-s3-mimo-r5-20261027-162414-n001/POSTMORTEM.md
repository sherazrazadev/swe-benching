# Post-run audit: jenkins-s3__mTceCk9

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.0.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.0 is driven by two regressions in the project's own test-module hudson.util.RobustReflectionConverterTest (testRestInterfaceFailure fail, testCliFailure error). Per build-notes these pass on the vulnerable tree, the oracle and the alternative fix. The model rewrote exactly the paths they exercise: REST config.xml and CLI update-job reach AbstractItem.updateByXml, which now has rollback-by-reload, and doConfigDotXml, which now turns failures into a 400. The model never ran that test-module class, only the core-module class of the same name. Even without the functional failures, 4 of 10 security tests fail for real reasons. The model's forbidden list omits jenkins.security.ResourceDomainRootAction$Redirection and $InternalResourceRequest, so both request-routing objects are still recreated. Its XStreamTypeCheck takes the element type from the field's generic signature without resolving type variables against the concrete class, so a DescribableGroupViewProperty<Entry> still keeps an AttackType. It also over-blocks every hudson.Plugin subclass, which drops the legitimate Plugin payload in the plugin-wrapper test. The grader is fair. The exact stack trace for the two functional failures was not available (test-stdout tail is empty), hence medium confidence.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| bench.SecurityRoutingObjectsTest::requestRedirectionIsNotRecreated | fail | genuine-fail | True | True |
| bench.SecurityRoutingObjectsTest::internalResourceRequestIsNotRecreated | fail | genuine-fail | True | True |
| bench.SecurityRoutingObjectsTest::pluginWrapperIsNotRecreated | fail | genuine-fail | True | True |
| bench.SecurityGenericGroupTypeTest::unrelatedTypeInGroupEntriesIsNotKept | fail | genuine-fail | True | True |
| hudson.util.RobustReflectionConverterTest::testRestInterfaceFailure | fail | genuine-fail | True | True |
| hudson.util.RobustReflectionConverterTest::testCliFailure | fail | genuine-fail | True | True |

**Lookup or leak:** None found. The transcript and the full agent log contain no access to /tests, .htests or the hidden suite names, and no network lookups. The model designed its own deny-list approach, which differs from upstream's readResolve guards.

**Evidence:**
- grading/results.json: security fails = GenericGroup, Redirection, InternalResourceRequest, PluginWrapper; functional: RobustReflectionConverterTest testCliFailure=error, testRestInterfaceFailure=fail -> score.py gives reward 0 when any functional test fails
- build-notes.md 'Gate': nop passes all 14 functional tests incl. 3 RobustReflectionConverterTest; oracle 24/24; alt_correct_fix passes, so a correct fix at a different layer passes
- changes.patch ~L611-667: forbidden prefixes and hierarchies contain no ResourceDomainRootAction classes; they include 'hudson.Plugin' and hudson.Plugin.class
- changes.patch ~L516-520 / L561: forbidden-type check inside the per-field try in doUnmarshal/determineType means the payload is silently dropped, not refused
- changes.patch XStreamTypeCheck.collectionElementType: Types.erasure of the field's type argument, no TypeVariable resolution; fix.patch L170-195 resolves T against runtimeClass
- changes.patch L22-55: AbstractItem.updateByXml rollbackFromConfigFile + doConfigDotXml 400 conversion, the paths exercised by RobustReflectionConverterTest REST/CLI tests
- transcript.md L278, L372, L474: model ran only core-module RobustReflectionConverterTest; it never ran the test-module class that the grader uses
- run.json: no tool calls during grading window; exception_info null; grading/test-stdout.tail.txt empty (exact functional stack traces unavailable)
- instruction.md: property 2 explicitly covers objects that route/dispatch requests 'even when supplied under a field whose declared type would otherwise admit it'; 'close the properties, not the examples'

**Recommended action:** Accept reward 0.0 as a genuine model failure. Optionally keep the verifier's functional log (mvn-functional.log) in future postmortems so the exact RobustReflectionConverterTest stack trace can be confirmed.
