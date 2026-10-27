# Post-run audit: jenkins-s3__zWjTRnt

Auditor: sub-agent, Claude Opus 5.5, effort high; grading audited: original; reward 0.6.

**Trustworthy:** True  **Attribution:** model-failed  **Confidence:** medium

Reward 0.6 = 6/10 security tests passing with all 14 functional tests passing. Three of the four security failures are the model's own misses, and the grader was fair on them: (1) no type-variable resolution, so DescribableList<T,...> declared on the generic base erases to Describable and AttackType is kept; (2, 3) ResourceDomainRootAction$Redirection and $InternalResourceRequest are not in the model's deny-list, and the transcript never mentions ResourceDomainRootAction. The fourth failure (pluginWrapperIsNotRecreated) is debatable. The model chose to reject hudson.Plugin itself as plugin machinery, so the carrier Plugin$DummyImpl was dropped with a 2xx response. The test, however, requires a Plugin payload to be kept ('legitimate plugin element must still be applied'), and the instruction never says that. Under the instruction's 'describe, load or manage a plugin' wording, rejecting Plugin is a defensible reading. So the fair score is arguably 0.7 rather than 0.6. Either way the task is unsolved because of genuine model misses. No sign of hidden-test access or upstream lookup.

| Test | Outcome | Verdict | Stated in instruction | Correct fix would pass |
|---|---|---|---|---|
| bench.SecurityGenericGroupTypeTest::unrelatedTypeInGroupEntriesIsNotKept | fail | genuine-fail | True | True |
| bench.SecurityRoutingObjectsTest::requestRedirectionIsNotRecreated | fail | genuine-fail | True | True |
| bench.SecurityRoutingObjectsTest::internalResourceRequestIsNotRecreated | fail | genuine-fail | True | True |
| bench.SecurityRoutingObjectsTest::pluginWrapperIsNotRecreated | fail | instruction-ambiguity | False | True |
| bench.SecurityCopyOnWriteJobPropertiesTest / SecurityJobElementTypeTest / SecurityNodePropertyTypeTest / SecurityPersistedSettingsTypeTest / SecurityViewPropertyTypeTest (6 passes) | pass | genuine-pass | True | True |

**Lookup or leak:** None found. The transcript shows no reads of /tests or .htests, no curl/wget, and no network fetches; the only 'github' hit is the .github directory listing (transcript:4). The fix is home-grown, a deny-list plus converter checks, and differs from the upstream/reference readResolve approach.

**Evidence:**
- grading/results.json: 4 security fails (GenericGroup, Redirection, InternalResourceRequest, PluginWrapper); all 14 functional pass; reward 0.6
- run.json: tool_calls_during_grading=[], agent_events_after_end=0, exception_info=null
- final-code/changes.patch XStream2SecurityUtils.getTypeArgument: 'Types.erasure(Types.getTypeArgument(baseType, index, Object.class))', no TypeVariable resolution (reference fix.patch:163-183 resolves it)
- final-code/changes.patch XStream2.isRejectedType: list includes 'Plugin.class.isAssignableFrom(type)', no ResourceDomainRootAction classes
- tests/security/SecurityRoutingObjectsTest.java:76-77 requires payload instanceof Plugin on 2xx; instruction.md property 2 bans objects that 'describe, load or manage a plugin', which does not clearly exclude hudson.Plugin
- solution/fix.patch:188-213 adds readResolve guards to Redirection and InternalResourceRequest; build-notes.md T2/T4 describe the generic-erasure and Redirection levers the model missed
- transcript.md: 0 mentions of ResourceDomainRootAction/Redirection/InternalResourceRequest/TypeVariable

**Recommended action:** Keep the run as model-failed (unsolved). Optionally note that pluginWrapperIsNotRecreated punishes rejecting hudson.Plugin itself, which the instruction does not forbid. Consider having that test use a carrier that is plainly not plugin machinery, or state in the instruction that plugin entry-point instances are legitimate values. That would make the fair security fraction 7/10 (0.7) for this trial.
