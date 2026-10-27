# Post-run audit: jenkins-s3__or2tVRU

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.6.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.6 (6/10 security, 14/14 functional). Three of the four security failures are the model's own misses under a fair grader: its denylist leaves out ResourceDomainRootAction$Redirection and $InternalResourceRequest, though the instruction says request-routing objects must never be recreated. Its element-type check also erases a type variable to its bound, so the generic group property keeps AttackType. The fourth failure, pluginWrapperIsNotRecreated, is questionable. The model deliberately refuses every hudson.Plugin subtype, so Plugin$DummyImpl is dropped. The test requires that Plugin$DummyImpl be kept as a 'legitimate plugin element', which the instruction never says and arguably contradicts: property 2 bans objects that exist only to describe, load or manage a plugin. A fair score would be about 0.7 rather than 0.6. The verdict (not solved, model-failed) stands either way.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| bench.SecurityGenericGroupTypeTest::unrelatedTypeInGroupEntriesIsNotKept | fail | genuine-fail | True | True |
| bench.SecurityRoutingObjectsTest::requestRedirectionIsNotRecreated | fail | genuine-fail | True | True |
| bench.SecurityRoutingObjectsTest::internalResourceRequestIsNotRecreated | fail | genuine-fail | True | True |
| bench.SecurityRoutingObjectsTest::pluginWrapperIsNotRecreated | fail | instruction-ambiguity | False | False |

**Lookup or leak:** None found. The transcript shows only local inspection of /workspace sources and the project's own tests. There is no access to /tests or .htests, no bench.* hidden-test names, and no web, curl, wget or github fetches. There is no netguard.log. The model's design (denylist plus element-type prechecks, snapshot/restore) differs from the upstream fix (readResolve guards), so it shows no sign of being copied.

**Evidence:**
- evidence/grading/results.json: 4 security failures (GenericGroup, Redirection, InternalResourceRequest, PluginWrapper); all 14 functional pass; reward 0.6
- evidence/run.json: tool_calls_during_grading [] and agent_events_after_end 0, so there is no timing or infra issue; exception_info null
- evidence/final-code/changes.patch:358-376 getTypeArgument returns Types.erasure(Types.getTypeArgument(base, index, Object.class)), with no type-variable resolution against the runtime class (cf. fix.patch extractElementType)
- evidence/final-code/changes.patch:~599-605 PROHIBITED_PREFIXES lists 'hudson.Plugin', 'org.kohsuke.stapler.', 'jenkins.security.stapler.' and nothing for ResourceDomainRootAction
- evidence/final-code/changes.patch:~620-624 isProhibitedFromConfiguration returns true for Plugin.class.isAssignableFrom(type), which blocks Plugin$DummyImpl
- evidence/tests/security/SecurityRoutingObjectsTest.java pluginWrapperIsNotRecreated: assertTrue(property.payload instanceof Plugin, "the legitimate plugin element must still be applied")
- evidence/instruction.md property 2: 'never recreate ... an object that exists only to route or dispatch a request, or to describe, load or manage a plugin ... even when it is supplied under a field whose declared type would otherwise admit it'
- evidence/solution/fix.patch: guards only PluginWrapper, Redirection and InternalResourceRequest via readResolve; resolves type variables in extractElementType
- evidence/build-notes.md: the upstream-only fix scores 0.6, and each lever's test fails independently, so the suite discriminates as designed except for the Plugin-kept assertion
- evidence/transcript.md:583-603 final summary: the model deliberately denylisted 'plugin machinery (Plugin, PluginManager, PluginWrapper, ...)'

**Recommended action:** Keep the run as model-failed (not solved). Fix SecurityRoutingObjectsTest.pluginWrapperIsNotRecreated so that it accepts a fix that also refuses the Plugin placeholder: assert only that no PluginWrapper is recreated (payload == null, or a Plugin whose getWrapper() is null). Alternatively, state in the instruction that Plugin instances themselves are legitimate values. Then re-verdict. This run's partial reward would likely become 0.7, and the solved/unsolved outcome stays the same.
