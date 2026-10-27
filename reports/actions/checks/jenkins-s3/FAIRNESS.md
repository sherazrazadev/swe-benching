# FAIRNESS — jenkins-s3

## 1. Per-test fairness

| Test (file::name) | What it asserts | Covering instruction sentence | Could a correct fix fail it? | Risk |
|---|---|---|---|---|
| security/SecurityViewPropertyTypeTest.java::unrelatedTypeInViewPropertiesIsNotKept | POST a view config with a legitimate + out-of-type property; status < 500; 2xx keeps only `LegitViewProperty`, 3xx/4xx applies nothing | Property 1: "Every element of a setting collection must be an instance of the element type that the collection is declared to hold." | No. Drop-and-continue (2xx) and whole-document refusal (4xx) both pass; a dispatcher-layer refusal passes too. | low |
| security/SecurityJobElementTypeTest.java::unrelatedTypeInJobBuildersIsNotKept | Same for `builders`, with a legitimate `Shell` first | Property 1 | No. Exact-class checking fails, but that is a wrong fix (caught by functional). | low |
| security/SecurityJobElementTypeTest.java::unrelatedTypeSelectedByClassAttributeIsNotKept | Attack supplied via `class="…"`; no builder kept | Property 1 + "however a value is supplied" | No. | low |
| security/SecurityNodePropertyTypeTest.java::unrelatedTypeInNodePropertiesIsNotKept | Injected node property in an agent document is not kept; agent survives | Property 1 | No. | low |
| security/SecurityCopyOnWriteJobPropertiesTest.java::unrelatedTypeInJobPropertiesIsNotKept | `Job.properties` (CopyOnWriteList) keeps only `LegitJobProperty`, or applies nothing on refusal | Property 1 | No. | low |
| security/SecurityGenericGroupTypeTest.java::unrelatedTypeInGroupEntriesIsNotKept | `DescribableList<T,Descriptor<T>>` on a generic base, bound by `Group` to `Entry`, keeps only `Entry` | Property 1 + "whatever kind of object it configures" | No. A fix that erases `T` to its bound is a wrong fix (`missing_generic` fails exactly here); resolving through the concrete configured class is the literal reading of "declared to hold". | medium |
| security/SecurityPersistedSettingsTypeTest.java::unrelatedTypeInPersistedSettingsIsNotKept | `PersistedList<ManagedSetting>` keeps only `ManagedSetting` | Property 1 | No. | low |
| security/SecurityRoutingObjectsTest.java::requestRedirectionIsNotRecreated | `Redirection` under an `Object` payload is not recreated (2xx payload null, or 4xx nothing applied) | Property 2: "must never recreate … an object that exists only to route or dispatch a request" | No. 4xx refusal accepted; 2xx must keep the carrying property, which paragraph 4 requires. | low |
| security/SecurityRoutingObjectsTest.java::internalResourceRequestIsNotRecreated | `InternalResourceRequest` under the `Object` payload is not recreated | Property 2 | No. | low |
| security/SecurityRoutingObjectsTest.java::pluginWrapperIsNotRecreated | `PluginWrapper` nested in a legitimate `Plugin` payload is not recreated; the `Plugin` survives on 2xx | Property 2: "describe, load or manage a plugin" | No. Dropping the legitimate `Plugin` on 2xx violates "the rest of the document must still be applied"; refusal (4xx) passes. | medium |
| functional/FunctionalViewPropertyTest.java::legitimateViewPropertyBinds | Legitimate property binds with its value | "Everything that works today must keep working exactly as today. Legitimate configuration values bind and are saved as before…" | No. A correct fix keeps instances/subtypes of the permitted type. | low |
| functional/FunctionalViewPropertyTest.java::emptyViewPropertiesStillLoad | `<properties/>` is accepted | Same + "empty collections … still load" | No. | low |
| functional/FunctionalJobElementsTest.java::legitimateJobElementsBind | `Shell`, `LegitJobProperty`, `ParametersDefinitionProperty` all bind | Same + "plugin-provided subtypes and any other value that is an instance of the permitted element type" | No. | low |
| functional/FunctionalJobElementsTest.java::jobWithoutCollectionsStillLoads | A bare job document is accepted | "existing objects that specify nothing keep loading" | No. | low |
| functional/FunctionalNodePropertyTest.java::legitimateNodePropertyBinds | Legitimate node property binds | "Everything that works today must keep working exactly as today" | No. | low |
| functional/FunctionalGenericGroupTest.java::legitimateGroupEntryBinds | `Group` with an `Entry` binds | Same | No. Requires the same type-variable resolution as the security counterpart. | medium |
| functional/FunctionalPersistedSettingsTest.java::legitimateSettingBinds | Two `ManagedSetting` values bind in order | Same | No. | low |
| functional/FunctionalPayloadTest.java::legitimatePayloadBinds | A plain `Entry` under an `Object` field binds | Same; property 2 only forbids routing/plugin objects | No. Blocking all untyped-field values is a wrong fix. | low |
| functional/FunctionalPayloadTest.java::absentPayloadStaysAbsent | Absent payload stays null, label kept | "absent values still load" | No. | low |
| (project) test/src/test/java/hudson/util/RobustReflectionConverterTest.java::{testCliFailure, testRestInterfaceFailure, +1} | Existing robust-converter error handling over CLI/REST is unchanged | "Everything that works today must keep working exactly as today" + standard expert knowledge: do not regress existing converter tests | No; only fixes that change error semantics (e.g. refuse-all) fail. | low |
| (project) core/src/test/java/hudson/util/DescribableListTest.java (2 methods) | Existing `DescribableList` conversion contract | Same | No. | low |

## Leniency (quality; non-blocking)

- **P1** wrong fixes (catcher): view-only (`upstream_only`: 4 tests); DescribableList-only (CopyOnWrite/Generic/Persisted); exact-class (`overbroad_exact_class`: functional); signature-only erasure (`missing_generic`: GenericGroup); missing PersistedList (`missing_persisted`); missing CopyOnWriteList (`missing_copyonwrite`); whole-collection abort (`crash_as_refusal`: five legit-first tests); refuse-all (`refuse_all`: functional).
- **P2**: published-guards-only (`missing_redirection`: Redirection); field-type-only checks (Redirection/InternalResourceRequest arrive under `Object`).
- **Traps**: T1→CopyOnWrite, T2→GenericGroup, T3→PersistedSettings, T4→Redirection (each caught by its `missing_*` patch).
- **Uncaught**: (1) aborting at the first bad element — legitimate siblings are always first (ViewProperty, CopyOnWrite, GenericGroup, Persisted tests); (2) view-path-only routing guard (`SecurityRoutingObjectsTest::submit` posts only `view/<name>/config.xml`); (3) denylist of exactly the three classes.

## Hints (quality)

- "including plugin-provided subtypes" → "any value that is an instance of the permitted element type".
- "empty collections and absent values still load" → "documents that specify no value keep loading".
- "Fix the problem and its close variants" → "Fix the problem".

## Required: generalize (surface descriptions)

- "a job, a view, an agent" → "an object".
- "submitted for a view … the view's setting collections" → "submitted for an object … its setting collections".
- "request-routing or plugin-handling machinery" → delete; property 2 states the outcome.

## Realism (quality)

T1/T4 are real upstream code; T2 is plausible generic code; T3 is plausible but most synthetic (`PersistedList` as a job property). T4's test-only `PayloadProperty` carrier is a realistic untyped-field shape; the routing classes are real. Nothing looks planted.

## Verdict

READY. Property 1 literally covers every collection route; property 2 covers the routing/plugin objects under an untyped field. Oracle, alt (post-conversion layer) and blind fixes score 24/24. Tests accept 4xx-refuse or 2xx-drop, so both allowed refusal forms pass. No correct fix fails a test.

Human review: confirm "declared to hold" requires resolving a type variable through the concrete subclass (GenericGroup), and that dropping a legitimate parent on 2xx is a wrong fix, not a correct one (pluginWrapper).

GATE_A: READY
NEEDS_HUMAN_REVIEW: YES
