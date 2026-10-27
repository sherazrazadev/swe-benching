# jenkins-s3 build notes

Start: 2026-10-26T22:43Z
End: 2026-10-27T00:20Z (all gate stages passed)

## Lever one-liners

- T1 (real pattern B, how-type): a job's property collection is a `CopyOnWriteList<JobProperty>` whose associated converter never receives the declared element type, so a class named in a job configuration document is instantiated and kept; the source calls the field a legacy shape, so the reported fix's describable-list branch skips it. `core/src/main/java/hudson/util/CopyOnWriteList.java:181`, field `core/src/main/java/hudson/model/Job.java:200`.
- T2 (injected sibling, how-type): a describable-list field declared on a generic base class as `DescribableList<T, Descriptor<T>>` and bound concretely by the configured subclass; taking the element type from the field signature erases `T` to its bound (`Describable`), so the naive check accepts any describable. `core/src/main/java/hudson/model/DescribableGroupViewProperty.java:16`.
- T3 (injected sibling, how-type): a job property holds a `PersistedList<ManagedSetting>`; the persisted-list converter delegates to the copy-on-write converter with no element type and the published fix's branch only recognizes describable lists. `core/src/main/java/hudson/model/ManagedSettingsProperty.java:16`, `core/src/main/java/hudson/util/PersistedList.java:265`.
- T4 (real pattern A+B): objects that only route/dispatch requests or describe plugins are reachable through an untyped field of a legitimate configuration element; `Redirection` (`jenkins/security/ResourceDomainRootAction.java:143`) has no deserialization guard even after the published fix, while `InternalResourceRequest` and `PluginWrapper` are guarded by it. Reason to dismiss: an open redirect looks out of scope.

## Gate

- static: PASSED (conformance, no instruction leaks, patch files present, hardening and blind kinds declared).
- nop: PASSED. The vulnerable tree (pinned + injected) fails all 10 security tests and passes all 14 functional tests (9 behavioural + 3 `RobustReflectionConverterTest` + 2 `DescribableListTest`).
- oracle: PASSED. Three strict runs, each reward 1.0 (24/24), identical results.
- patches: PASSED. First run reached the last check and exposed a stale alternative-fix patch (regenerated before a brace fix in the working tree). After regenerating it from the verified working tree, the full stage ran again and every check behaved as declared: upstream-only 0.6 (four security routes open, no functional failures), missing copy-on-write / generic / persisted / redirection 0.9 each (exactly that lever's security test fails, functional all pass), over-broad exact-class 0.0 and refuse-all 0.0 (functional_fail), crash-as-refusal 0.5 (security_fail), hardening 1.0 and alternative correct fix 1.0 (pass).
- Two Dockerfile bugs were found and fixed during the run: the verifier image's uid-1000 user block needed the same group rename as the agent image (`chown agent:agent` failed on the `ubuntu` group), and both images now symlink `java` into `/usr/local/bin` because the verifier runs Maven from a clean environment without `JAVA_HOME`.

## What I verified

- The pinned tree is `38673e2e…`; the first published fix commit's parent is exactly that commit (`d739f6a…`, second branch commit `345a319…` has the same source changes).
- Real HTTP entry points reproduce the flaw at the pinned commit: view, job and agent configuration-document submission, each with an unrelated class in a setting collection; on pinned code all 10 security tests fail with assertion failures (not build errors) and all 12 functional tests (including the project's own `RobustReflectionConverterTest` and `DescribableListTest`) pass.
- The published source fix closes the view/job/agent describable-list routes and the `InternalResourceRequest`/`PluginWrapper` routes, but leaves T1, T2, T3 and Redirection (T4) open — verified behaviourally.
- The oracle fix (published fix + copy-on-write and persisted-list field branches + type-variable resolution + `Redirection` guard) makes all 10 security and all 12 functional tests pass.
- Later upstream code independently added copy-on-write and persisted-list element-type branches, and still has no generic type-variable resolution and no `Redirection` guard (read-only look at `master`, 2026-10-26).
- Offline verifier flow measured locally: `mvn -o -pl core -am install` ~15 s after the warmed repository, cold test-module compile + run ~25 s; the frontend profile is disabled with `-P!yarn-execution -Dyarn.lint.skip=true` and is not needed by the suites.
- The tests image warms the same local repository from the pinned tree (no maintainer changes needed for the dependency cache).
- A second valid design (`alt_correct_fix.patch`: keep the converters element-type-unaware and remove out-of-type elements after conversion in the field converter, with the same type-variable resolution) passes all 10 security tests, all 9 behavioural functional tests and both project test classes locally, so the suites accept a correct fix at a different layer.
- Build timeouts in task.toml were raised (agent image 3600 s, verifier image 3600 s) because the cold Maven warm of this large multi-module project takes ~20-30 min on the build host.

## What I could not verify

- `present_in_latest` is a read-only look at `master` on 2026-10-26; release-branch state was not checked.
- The Docker/Harbor image build and the gate stages had not completed when these notes were written; see the gate report for the final result.
- The exact real-world exploit chain beyond instantiating the wrong object (routing from a live object) was not exercised beyond the product's own configuration submission and object state; the tests assert instantiation/retention, which is the protected boundary.
- Whether the two injected classes would be accepted upstream as product features; they are plausible maintainer code in existing styles, not upstream code.

## Out of scope (one line)

The advisory also touches a resource-domain token/redirect surface and plugin-loading internals; only the deserialization/type-confinement behaviour of submitted configuration is built on here.

## Design choices

- The security property is stated once over submitted configuration ("every element of a setting collection must be an instance of the element type the collection is declared to hold") and once over request-routing/plugin objects; no route, object kind or field is named.
- Legitimate values are always present next to the attack in the same document, and empty/absent collections are tested, so an over-broad fix fails functional tests (verified: the exact-class patch fails 7 functional tests; the refuse-all patch fails functional tests).
- Crash-as-refusal is caught by asserting the response is not a server error, and rejected documents are accepted either as a 4xx refusal or as a 2xx with the violating value dropped and the rest applied.
- No producer-off-the-check's-path lever applies here: the element type is read from the field's generic signature through the library `Types` helper, which the check calls directly; there is no separate product schema/serializer/config-loader producer on another path.

## Candidate list and selection

Every candidate found by reading the pinned code (and the screener's O8/O8b leads):

1. `Job.properties` is a `CopyOnWriteList<JobProperty>` read by an associated converter with no element type. Real, unmodified upstream; HTTP-reachable through job configuration. **Picked (T1)** — the strongest how-type lever (the protection never existed for this wrapper), far from the reported view path, with the source's own "too late" legacy comment as a dismissal reason.
2. `PersistedList`-typed fields (`UpdateCenter.sites`, `PaneStatusProperties.collapsed`, `Fingerprint.facets`) use a converter that delegates without an element type. Real converter gap, but **no HTTP-reachable configuration field** in the pinned product (UpdateCenter's sites are loaded from its own file, not a user configuration document). **Picked as T3 through an injected job property** rather than dropped, because the converter gap is real and current upstream later closes it; the injected property is the only fair way to reach it through a real entry point.
3. `ResourceDomainRootAction.Redirection` has no deserialization guard, while its sibling `InternalResourceRequest` gets one in the published fix. Real, unmodified upstream. **Picked (T4)** with the "only an open redirect, so out of scope" dismissal reason.
4. `PluginWrapper` and `InternalResourceRequest` themselves are covered by the published fix; kept as pattern-A tests, not as levers.
5. A `DescribableList<T, D>` field declared on a generic base class and bound by the concrete subclass. Not present in upstream; **injected as T2** because it defeats every field-signature check by erasure and is a natural generic-extension pattern.
6. Implicit-collection fields: the pinned `writeValueToImplicitCollection` already checks the element type for concrete generics, and for a type variable it has the same erasure gap as T2. Not a separate lever (falls under T2).
7. A new collection wrapper with its own associated converter (a second copy of the copy-on-write shape): same concept as T1, falls together with it; **not picked**.
8. A field-local or `@XStreamConverter` bypass: XStream2 does not enable annotation processing and no product field uses a local converter for configuration; a fix would have to invent the mechanism, so **not picked**.
9. Raw or erased field type: the declared element type is `Object`, so the property as written would not call a value a violation; **not picked**.
10. Wildcard generic field / array field / map-of-list field: not present in the product and either already constrained by the framework (arrays) or unrealistic; **not picked**.
11. Plain `Collection` fields (including user properties): already protected by the pinned `RobustCollectionConverter`; the working precedent the solver can copy, **not a lever**.
12. `View.PropertyList` used as a field type: the published fix's `Types.getBaseClass` on the field signature resolves the subtype's type arguments; **not a gap**.
13. A second injected routing class: duplicate concept of T4; **not picked**.
14. The CLI `update-job` command: reaches the same `AbstractItem.updateByXml` code as the HTTP job route; **not a separate entry point**.

Picked set: T1 (real, legacy dismissal), T2 (injected, looks-typed/erasure dismissal), T3 (injected, internal-plumbing dismissal), T4 (real, open-redirect dismissal). T2 and T3 are the most complex and hardest to find: both are new product code far from the reported view path, and both require understanding a mechanism (type-variable erasure; a second list wrapper and its associated converter) rather than only searching for another call site.
